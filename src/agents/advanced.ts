import * as cheerio from "cheerio";
import type { Browser } from "playwright";
import type { Finding, Layer } from "../types.js";
import { complete } from "../llm/openrouter-client.js";
import { buildTargetedFixMessages, extractHtml } from "./fix-prompt.js";
import { route } from "./router.js";
import { snapshot, checkRegression } from "./regression-guard.js";
import { findAltGrounding, type ReviewItem } from "./human-checkpoint.js";
import { scanAll, type LayerScan } from "../harness/scan-all.js";

/**
 * Advanced agent: context → route → verify-loop[A,B,C] → regression guard →
 * human checkpoint → memory. The win is NOT raw fix-count (the base model is
 * strong) — it is that this agent NEVER ships a false-fix: every fix is re-verified
 * across all three layers before it is committed, and where a semantic alt cannot be
 * GROUNDED in the page's own markup it is escalated to needs-review instead of being
 * guessed. See docs/BRAINSTORM.md §1 and the Hot Take.
 */

export type Outcome = "true-fix" | "regressed" | "needs-review" | "unresolved";

export interface Iteration {
  attempt: number;
  strategy: "rule" | "llm";
  guardOk: boolean;
  guardReasons: string[];
  targetResolved: boolean;
  newFindings: string[];
  accepted: boolean;
  note?: string;
}

export interface AdvFix {
  layer: Layer;
  wcag?: string;
  selector?: string;
  strategy: "rule" | "llm" | "checkpoint";
  outcome: Outcome;
  attempts: number;
  iterations: Iteration[];
  note?: string;
}

export interface AdvancedResult {
  html: string;
  fixes: AdvFix[];
  reviewQueue: ReviewItem[];
  memoryHits: number;
}

export type FixMemory = Map<string, { strategy: string }>;

export interface AdvancedOptions {
  browser?: Browser;
  maxRetries?: number;
  memory?: FixMemory;
  pageId?: string;
  /**
   * Ablation gate: which layers the agent can SEE and verify against. A shallower
   * config (e.g. ["A"]) cannot detect or check the layers it omits, so it ships
   * false-compliances a deeper config catches. Defaults to the full ["A","B","C"].
   */
  layers?: Layer[];
}

const key = (f: { wcag?: string; selector?: string }) => `${f.wcag ?? "?"}|${f.selector ?? ""}`;
const sig = (f: Finding) => `${f.layer}:${f.wcag ?? "?"}:${(f.detail as { rule?: string })?.rule ?? (f.detail as { category?: string })?.category ?? ""}`;

/** Deterministic mechanical/semantic rule fixes (no LLM). Returns null if no rule applies. */
function applyRuleFix(html: string, f: Finding): { html: string; note: string } | null {
  const $ = cheerio.load(html);
  const el = f.selector ? $(f.selector).first() : $();
  if (!el.length) return null;

  // A: missing form-control name → aria-label from the (visible) placeholder.
  if (f.layer === "A" && (f.wcag === "1.3.1" || f.wcag === "4.1.2")) {
    if (!el.attr("aria-label") && !el.attr("aria-labelledby")) {
      const ph = (el.attr("placeholder") ?? "").trim();
      el.attr("aria-label", ph || "Input field");
      return { html: $.html(), note: `added aria-label from placeholder ("${ph || "Input field"}")` };
    }
  }

  // C: aria-label contradicts the visible label → drop it, fall back to the <label>.
  if (f.wcag === "2.5.3") {
    el.removeAttr("aria-label");
    return { html: $.html(), note: "removed contradicting aria-label; falls back to the visible <label>" };
  }

  // C: alt handling — grounded or empty-for-decorative, NEVER an invented description.
  if (f.wcag === "1.1.1") {
    const rule = (f.detail as { rule?: string })?.rule;
    if (rule === "decorative-alt" || rule === "redundant-alt") {
      el.attr("alt", "");
      return { html: $.html(), note: 'set alt="" (decorative / redundant with adjacent text)' };
    }
    if (rule === "generic-word" || rule === "filename-as-alt" || rule === "informative-emptied") {
      const g = findAltGrounding(html, f.selector ?? "");
      if (g.grounded) {
        // The alternative already exists in the markup (caption/heading/link) → empty alt
        // avoids duplication and does not invent anything the model cannot see.
        el.attr("alt", "");
        return { html: $.html(), note: `set alt="" — grounded by ${g.source} ("${g.text}")` };
      }
      return null; // ungrounded → caller escalates to needs-review (no guess)
    }
  }
  return null;
}

function allFindings(s: LayerScan): Finding[] {
  return [...s.A, ...s.B, ...s.C];
}
function orderFindings(fs: Finding[]): Finding[] {
  const rank: Record<Layer, number> = { A: 0, C: 1, B: 2 };
  return [...fs].sort((a, b) => rank[a.layer] - rank[b.layer] || (a.selector ?? "").localeCompare(b.selector ?? ""));
}

/**
 * Fixer LLM call with a timeout + bounded retry/backoff. On repeated failure it throws so the
 * caller can escalate that fix to human review rather than crashing the whole page. No-op on the
 * committed eval: in replay the cassette resolves on the first attempt, so no timeout/backoff runs.
 */
async function callFixer(messages: ReturnType<typeof buildTargetedFixMessages>, timeoutMs = 60_000, retries = 2): Promise<string> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const call = complete({ role: "fixer", messages }) as Promise<string>;
      const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`fixer timed out after ${timeoutMs}ms`)), timeoutMs); });
      return await Promise.race([call, timeout]);
    } catch (e) {
      lastErr = e;
      if (attempt < retries) await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export async function runAdvanced(html: string, opts: AdvancedOptions = {}): Promise<AdvancedResult> {
  const maxRetries = opts.maxRetries ?? 3;
  const memory: FixMemory = opts.memory ?? new Map();
  const gate = opts.layers ?? (["A", "B", "C"] as Layer[]);
  const inGate = (f: Finding) => gate.includes(f.layer);
  let working = html;
  const fixes: AdvFix[] = [];
  const reviewQueue: ReviewItem[] = [];
  let memoryHits = 0;

  const initial = await scanAll(working, { browser: opts.browser });
  const targets = orderFindings(allFindings(initial).filter(inGate));

  for (const target of targets) {
    // Re-scan: a previous whole-page fix may already have resolved this.
    const cur = await scanAll(working, { browser: opts.browser });
    const curAll = allFindings(cur).filter(inGate);
    const stillPresent = curAll.some((g) => key(g) === key(target));
    if (!stillPresent) {
      fixes.push({ layer: target.layer, wcag: target.wcag, selector: target.selector, strategy: "rule", outcome: "true-fix", attempts: 0, iterations: [], note: "resolved by an earlier fix" });
      continue;
    }

    const strategy = route(target);
    if (memory.has(sig(target))) memoryHits++;

    // Semantic alt with no grounding → escalate, never guess.
    if (target.layer === "C" && target.wcag === "1.1.1") {
      const rule = (target.detail as { rule?: string })?.rule;
      if ((rule === "generic-word" || rule === "filename-as-alt" || rule === "informative-emptied") && !findAltGrounding(working, target.selector ?? "").grounded) {
        reviewQueue.push({ pageId: opts.pageId, finding: target, selector: target.selector ?? "", reason: "alt text cannot be grounded in the page markup (no caption/heading/link); a confident description would be a hallucination" });
        fixes.push({ layer: "C", wcag: target.wcag, selector: target.selector, strategy: "checkpoint", outcome: "needs-review", attempts: 0, iterations: [], note: "ungrounded alt → human checkpoint" });
        continue;
      }
    }

    // Attempt loop with verify + regression guard.
    let feedback: string | undefined;
    const iterations: Iteration[] = [];
    let outcome: Outcome = "unresolved";
    let committed = false;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      let candidate: string | null;
      if (strategy === "rule") {
        const r = applyRuleFix(working, target);
        candidate = r?.html ?? null;
        if (candidate === null) {
          outcome = target.layer === "C" ? "needs-review" : "unresolved";
          break;
        }
      } else {
        let raw: string;
        try {
          raw = await callFixer(buildTargetedFixMessages(working, target, feedback));
        } catch (err) {
          // Transient LLM/network failure: escalate THIS fix to a human instead of throwing and
          // killing the whole page. (In replay the cassette resolves first try, so this never
          // fires — a no-op on the committed eval.)
          reviewQueue.push({ pageId: opts.pageId, finding: target, selector: target.selector ?? "", reason: `fixer call failed after retries (${(err as Error).message}); escalated to human review` });
          iterations.push({ attempt, strategy, guardOk: true, guardReasons: [], targetResolved: false, newFindings: [], accepted: false, note: "fixer call failed → needs-review" });
          outcome = "needs-review";
          break;
        }
        candidate = extractHtml(raw);
      }

      const guard = checkRegression(snapshot(working), snapshot(candidate));
      if (!guard.ok) {
        iterations.push({ attempt, strategy, guardOk: false, guardReasons: guard.reasons, targetResolved: false, newFindings: [], accepted: false, note: "regression guard rejected (content loss)" });
        feedback = `Your change removed or emptied content: ${guard.reasons.join("; ")}. Fix the issue WITHOUT deleting or hiding content.`;
        if (strategy === "rule") { outcome = "regressed"; break; }
        continue;
      }

      const vscan = await scanAll(candidate, { browser: opts.browser });
      const vall = allFindings(vscan).filter(inGate);
      const targetResolved = !vall.some((g) => key(g) === key(target));
      const newFindings = vall.filter((g) => !curAll.some((h) => h.id === g.id)).map((g) => `${g.wcag}@${g.selector}`);
      const accepted = targetResolved && newFindings.length === 0;
      iterations.push({ attempt, strategy, guardOk: true, guardReasons: [], targetResolved, newFindings, accepted });

      if (accepted) {
        working = candidate;
        outcome = "true-fix";
        committed = true;
        memory.set(sig(target), { strategy });
        break;
      }
      feedback = [
        targetResolved ? "" : "The target issue is still present after your change.",
        newFindings.length ? `Your change introduced NEW accessibility issues that must also be resolved: ${newFindings.join(", ")}.` : "",
      ].filter(Boolean).join(" ");
      if (strategy === "rule") { outcome = target.layer === "C" ? "needs-review" : "unresolved"; break; }
    }

    fixes.push({ layer: target.layer, wcag: target.wcag, selector: target.selector, strategy, outcome, attempts: iterations.length, iterations, note: committed ? undefined : "not committed" });
  }

  // Universal integrity invariant: NEVER ship an issue we could not verify-fix. If the page
  // ends Layer-A-clean but still carries residual B/C findings we did not resolve, escalate
  // them to human review rather than shipping a scanner-clean-but-still-broken page silently.
  // Gated by inGate so a shallower ablation config can only escalate what it can actually see
  // (a scanner-only gate still ships the false-compliances a deeper gate catches).
  const finalScan = await scanAll(working, { browser: opts.browser });
  if (finalScan.A.length === 0) {
    const queued = new Set(reviewQueue.map((r) => r.selector));
    for (const f of [...finalScan.B, ...finalScan.C].filter(inGate)) {
      const sel = f.selector ?? "";
      if (queued.has(sel)) continue;
      const reason = "could not verify a fix after retries; escalated to a human rather than shipping a scanner-clean-but-broken page";
      reviewQueue.push({ pageId: opts.pageId, finding: f, selector: sel, reason });
      queued.add(sel);
      const led = fixes.find((x) => (x.selector ?? "") === sel && x.wcag === f.wcag && (x.outcome === "unresolved" || x.outcome === "regressed"));
      if (led) { led.outcome = "needs-review"; led.strategy = "checkpoint"; led.note = "unresolved → human checkpoint (never shipped silently)"; }
    }
  }

  return { html: working, fixes, reviewQueue, memoryHits };
}
