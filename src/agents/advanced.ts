import * as cheerio from "cheerio";
import type { Browser } from "playwright";
import type { Finding, Layer } from "../types.js";
import { complete } from "../llm/openrouter-client.js";
import { buildTargetedFixMessages, extractHtml } from "./fix-prompt.js";
import { route } from "./router.js";
import { snapshot, checkRegression } from "./regression-guard.js";
import { findAltGrounding, queueForReview, type ReviewItem } from "./human-checkpoint.js";
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

export async function runAdvanced(html: string, opts: AdvancedOptions = {}): Promise<AdvancedResult> {
  const maxRetries = opts.maxRetries ?? 3;
  const memory: FixMemory = opts.memory ?? new Map();
  let working = html;
  const fixes: AdvFix[] = [];
  const reviewQueue: ReviewItem[] = [];
  let memoryHits = 0;

  const initial = await scanAll(working, { browser: opts.browser });
  const targets = orderFindings(allFindings(initial));

  for (const target of targets) {
    // Re-scan: a previous whole-page fix may already have resolved this.
    const cur = await scanAll(working, { browser: opts.browser });
    const curAll = allFindings(cur);
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
        queueForReview({ pageId: opts.pageId, finding: target, selector: target.selector ?? "", reason: "ungrounded alt" });
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
        const raw = (await complete({ role: "fixer", messages: buildTargetedFixMessages(working, target, feedback) })) as string;
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
      const vall = allFindings(vscan);
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

  return { html: working, fixes, reviewQueue, memoryHits };
}
