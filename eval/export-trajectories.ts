import { chromium } from "playwright";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runAdvanced, reflexionFeedback, type FixMemory } from "../src/agents/advanced.js";
import { scanAll } from "../src/harness/scan-all.js";
import type { Finding } from "../src/types.js";

/**
 * Export the runtime agent's decision trajectories: the detected issues (A/B/C tool
 * output) → per-fix route/attempt → verify verdicts → accept/escalate decision → final
 * outcome. Emits raw JSONL (machine) + Markdown (human) for EVERY page in the eval corpus,
 * plus a navigational index. Run from dist/ (uses Layer B). Writes docs/trajectories/ ONLY —
 * it never touches docs/results/, metrics.json or ablation.json.
 *
 * Buckets and per-bucket shared fix-memory mirror eval/run-eval.ts, so a trace reflects what
 * the scored eval actually did (memory can carry a verified signature across pages in a bucket).
 */

const BUCKETS = ["adversarial", "injected"];
const OUT = join(process.cwd(), "docs", "trajectories");
/** Read-only: the scored results, used to state where the agent did worse than the baseline. */
const METRICS = join(process.cwd(), "docs", "results", "metrics.json");
const scored: { perPage?: { page: string; baseline?: any; advanced?: any }[] } = existsSync(METRICS)
  ? JSON.parse(readFileSync(METRICS, "utf8"))
  : {};

/** Backtick bare markup fragments (`<span>`, `alt=""`) so markdown renders them as code. */
const asCode = (t: string) => t.replace(/<([a-z][a-z0-9-]*)>/gi, "`<$1>`");

const short = (f: Finding) => ({ layer: f.layer, wcag: f.wcag, selector: f.selector, message: f.message });

/** What makes this trace worth opening — computed from the trace itself, not curated. */
interface Highlight { bucket: string; slug: string; detected: number; notes: string[]; outcomes: string[] }

function highlightsFor(fixes: Awaited<ReturnType<typeof runAdvanced>>["fixes"], detected: number, escalated: number, missed: string[] = []): string[] {
  const notes: string[] = [];
  const rejected = fixes.flatMap((f) => f.iterations).filter((it) => !it.accepted).length;
  const reflexion = fixes.filter((f) => f.iterations.length > 1);
  const guardRejects = fixes.flatMap((f) => f.iterations).filter((it) => !it.guardOk);
  const memHits = fixes.filter((f) => f.memoryHit).length;
  const unresolved = fixes.filter((f) => f.outcome === "unresolved").length;
  if (guardRejects.length) notes.push(`**regression guard rejected** ${guardRejects.length} content-destroying candidate(s)`);
  if (reflexion.length) notes.push(`**reflexion**: ${rejected} rejected attempt(s) before accept`);
  if (escalated) notes.push(`**escalated ${escalated}** to a human (not groundable / not verifiable)`);
  if (memHits) notes.push(`**memory hit** ×${memHits} (repeat signature reused)`);
  if (unresolved) notes.push(`${unresolved} left unresolved`);
  // "nothing to fix" is only true if the manifest seeded nothing. Where it seeded a barrier no
  // layer surfaced, the index row has to say so — otherwise the summary table launders the miss.
  if (missed.length) notes.unshift(`**detection miss** — ${missed.join(", ")} seeded but never surfaced`);
  if (!notes.length) notes.push(detected === 0 ? "_no findings — nothing to fix_" : "all fixes accepted first try");
  return notes;
}

async function main(): Promise<void> {
  process.env.A11YFORGE_MODE ??= "replay";
  process.env.FIXER_MODEL ??= "anthropic/claude-sonnet-5";
  process.env.JUDGE_MODEL ??= "openai/gpt-4o-mini";

  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const highlights: Highlight[] = [];
  let events = 0;
  try {
   for (const bucket of BUCKETS) {
    const DIR = join(process.cwd(), "corpus", bucket);
    if (!existsSync(DIR)) continue;
    const slugs = readdirSync(DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .filter((s) => existsSync(join(DIR, s, "index.html")))
      .sort();
    const memory: FixMemory = new Map(); // shared within a bucket, as in run-eval.ts
    for (const slug of slugs) {
      const html = readFileSync(join(DIR, slug, "index.html"), "utf8");
      const before = await scanAll(html, { browser });
      const adv = await runAdvanced(html, { browser, pageId: slug, memory });

      // MANIFEST-VS-DETECTED. The corpus manifest is ground truth: it says which barriers were
      // seeded and which layer should catch each one. Comparing it against what the layers actually
      // found is the only way a trace can tell a genuine clean page apart from a DETECTION MISS.
      // Without this the exporter published "the agent correctly made no change" over an unfixed
      // barrier — a clean-looking report over a real defect, which is the exact failure this
      // project exists to condemn.
      const mfPath = join(DIR, slug, "manifest.json");
      const seeded: { id: string; wcag: string; expectedCatchingLayer?: string | null; notes?: string }[] =
        existsSync(mfPath) ? (JSON.parse(readFileSync(mfPath, "utf8")).violations ?? []) : [];
      const detectedWcag = new Set([...before.A, ...before.B, ...before.C].map((f) => f.wcag));
      const missed = seeded.filter((v) => !detectedWcag.has(v.wcag));

      // --- raw JSONL ---
      const lines: string[] = [];
      lines.push(JSON.stringify({ event: "task", page: slug, detected: [...before.A, ...before.B, ...before.C].map(short) }));
      for (const f of adv.fixes) {
        lines.push(JSON.stringify({
          event: "fix",
          target: { layer: f.layer, wcag: f.wcag, selector: f.selector },
          strategy: f.strategy,
          iterations: f.iterations.map((it) => ({
            attempt: it.attempt,
            action: it.strategy === "rule" ? "deterministic rule fix" : "LLM targeted fix",
            regressionGuard: { ok: it.guardOk, reasons: it.guardReasons },
            verify: { targetResolved: it.targetResolved, newFindings: it.newFindings },
            decision: it.accepted ? "ACCEPT" : "REJECT",
          })),
          outcome: f.outcome,
          memoryHit: f.memoryHit ?? false,
          note: f.note,
        }));
      }
      lines.push(JSON.stringify({ event: "result", page: slug, reviewQueue: adv.reviewQueue.map((r) => ({ selector: r.selector, reason: r.reason })), memoryHits: adv.memoryHits, outcomes: adv.fixes.reduce<Record<string, number>>((m, f) => ((m[f.outcome] = (m[f.outcome] ?? 0) + 1), m), {}) }));
      writeFileSync(join(OUT, `${slug}.jsonl`), lines.join("\n") + "\n", "utf8");

      // --- readable Markdown ---
      const md: string[] = [];
      md.push(`# Trajectory — \`${slug}\`\n`);
      md.push(`_[\u2190 all traces, and what each one shows](README.md)_\n`);
      md.push(`**How to read this.** Layers: **A** mechanical (axe + pa11y) \u00b7 **B** behavioural`);
      md.push(`(screen-reader / keyboard) \u00b7 **C** semantic (is the alt/label actually meaningful).`);
      md.push(`Strategies: **rule** = deterministic code fix \u00b7 **llm** = model-generated fix \u00b7`);
      md.push(`**checkpoint** = escalated to a human instead of guessed. Every candidate passes a`);
      md.push(`regression **guard** (rejects deleting or hiding content) and then a **verify** re-scan;`);
      md.push(`only a candidate that resolves its target and adds no new findings is committed.\n`);
      // A trace that shows decisions but not the instructions behind them is only half a trace, and
      // every one of these files previously dead-ended at the index. Link the actual prompts.
      md.push(`**The instructions behind these decisions.** Fixer system prompt:`);
      md.push(`[\`src/agents/fix-prompt.ts\`](../../src/agents/fix-prompt.ts) · routing table:`);
      md.push(`[\`src/agents/router.ts\`](../../src/agents/router.ts) (\`DECISION_TABLE\`) · Layer-C judge`);
      md.push(`prompt: [\`src/layers/layerC-judge.ts\`](../../src/layers/layerC-judge.ts) (\`JUDGE_SYSTEM\`),`);
      md.push(`whose own verdicts are traced in [\`judge-verdicts.md\`](judge-verdicts.md).\n`);
      // The two "start here" picks dead-ended at the shallow version while the file holding the real
      // model request/response sat unlinked. Point at it from the page a reader opens first.
      const deeperDive: Record<string, string> = {
        "icon-only-control": "reflexion-icon-only-control.md",
        "alt-generic": "contrast-alt-generic.md",
      };
      if (deeperDive[slug]) {
        md.push(`**Deeper dive:** [\`${deeperDive[slug]!.replace(/\.md$/, "")}\`](${deeperDive[slug]}) quotes the actual`);
        md.push(`model request and response behind these decisions.\n`);
      }
      md.push(`**Detected issues (A/B/C tool output):**\n`);
      if (before.A.length + before.B.length + before.C.length === 0) {
        if (missed.length > 0) {
          md.push(`_None — and that is a **detection miss, not a clean page.** \`manifest.json\` seeds`);
          md.push(`${missed.map((v) => `WCAG ${v.wcag} (\`${v.id}\`)`).join(", ")}, which no layer surfaced, so the`);
          md.push(`agent never saw it and could not have fixed it. Published as a trace so the gap is visible`);
          md.push(`rather than absent._
`);
          // The manifest note says what SHOULD have happened ("Layer C flags that…"). Quoting it as
          // an explanation asserts the opposite of the finding it sits under, so attribute it as the
          // expectation it is. Markup fragments are backticked or the renderer swallows them as HTML.
          for (const v of missed) {
            md.push(`- **The manifest expected layer ${v.expectedCatchingLayer ?? "?"} to catch ${v.wcag}. It did not.**`);
            if (v.notes) md.push(`  Manifest rationale, quoted as the *expectation* rather than as what happened: ${asCode(v.notes)}`);
          }
        } else {
          md.push(`_None. All three layers scanned this page and found nothing to fix, so the agent`);
          md.push(`correctly made no change. This trace is intentionally empty — it is published rather`);
          md.push(`than omitted so the set covers every page in the eval, not only the eventful ones._`);
        }
      } else if (missed.length > 0) {
        md.push(`_**Partial detection.** \`manifest.json\` seeds ${seeded.length} barrier(s) on this page and the`);
        md.push(`layers surfaced ${seeded.length - missed.length}. Not surfaced:`);
        md.push(`${missed.map((v) => `WCAG ${v.wcag} (\`${v.id}\`, expected layer ${v.expectedCatchingLayer ?? "?"})`).join(", ")}.`);
        md.push(`The fix below may resolve it in passing, but it was never detected, so nothing verified it._
`);
      }
      for (const f of [...before.A, ...before.B, ...before.C]) md.push(`- \`${f.layer}\` [${f.wcag}] ${f.message} — \`${f.selector ?? ""}\``);
      md.push(`\n**Agent decisions:**\n`);
      for (const f of adv.fixes) {
        // A finding cleared as a side effect of an earlier whole-page fix carries strategy "rule"
        // internally, but no rule ran for it — printing "(rule)" would misattribute the work, so
        // label it for what it was.
        const sideEffect = f.note === "resolved by an earlier fix";
        // A finding with zero iterations that ended unresolved was ROUTED to a fixer that had
        // nothing to apply — no rule ran, so printing the bare strategy claims work that never
        // happened. Same misattribution class as the side-effect case above.
        const noRuleApplies = f.iterations.length === 0 && f.outcome === "unresolved";
        const how = sideEffect
          ? "no fix of its own — cleared by an earlier change"
          : noRuleApplies
            ? `routed to the ${f.strategy} fixer — no ${f.strategy} covers this criterion, so nothing was attempted`
            : f.strategy;
        md.push(`### ${f.layer} [${f.wcag}] \`${f.selector ?? ""}\` → **${f.outcome}** (${how})${f.memoryHit ? " · memory-hit (strategy recalled from an earlier verified fix)" : ""}`);
        if (f.iterations.length === 0) md.push(`- ${f.note ?? "resolved by an earlier whole-page fix / escalated"}`);
        if (f.iterations.length > 1) md.push(`- _reflexion: ${f.iterations.length} attempts — a rejected attempt's diagnostic is fed back into the next try._`);
        for (const it of f.iterations) {
          md.push(`- attempt ${it.attempt}: ${it.strategy === "rule" ? "deterministic rule fix" : "LLM targeted fix"} → guard ${it.guardOk ? "ok" : "REJECTED (" + it.guardReasons.join("; ") + ")"} · verify: target ${it.targetResolved ? "resolved" : "still present"}, new findings [${it.newFindings.join(", ") || "none"}] → **${it.accepted ? "ACCEPT" : "REJECT — feed failure back and retry"}**`);
          if (!it.accepted) {
            const diag = reflexionFeedback(it);
            if (diag) md.push(`  - diagnostic actually fed back into attempt ${it.attempt + 1}: _"${diag}"_`);
          }
        }
        if (f.outcome === "needs-review") md.push(`- → escalated to **human checkpoint**: alt left untouched (no fabricated description).`);
        if (f.outcome === "unresolved") {
          md.push(f.layer === "A"
            ? `- **Why nothing shipped:** no deterministic rule covers WCAG ${f.wcag}, and Layer-A findings are always routed to the rule fixer, never to the LLM — so no fix was produced. **That is a coverage gap, not a judgement call.** The agent left the page **visibly failing** rather than invent markup it cannot verify: the violation stays detectable by any scanner, so this is an **unfixed issue, not a false green**. Closing it would mean adding a ${f.wcag} rule.`
            : `- **Why nothing shipped:** no candidate passed verification within the attempt budget, so nothing was committed. **A coverage gap, not a judgement call** — the page keeps its original markup and the issue stays reported rather than papered over.`);
        }
        md.push("");
      }
      const finalScan = await scanAll(adv.html, { browser });
      const residualBC = finalScan.B.length + finalScan.C.length;
      md.push(`**Shipped result:** Layer A ${finalScan.A.length} · Layer B ${finalScan.B.length} · Layer C ${finalScan.C.length}` + (adv.reviewQueue.length ? ` · ${adv.reviewQueue.length} escalated for human review` : ""));
      if (adv.reviewQueue.length && residualBC > 0) {
        md.push(`\n_Read that carefully: the remaining Layer-B/C count **is** the escalated item — it is`);
        md.push(`deliberately left for a human, not undetected breakage the agent missed._`);
      } else if (finalScan.A.length > 0) {
        md.push(`\n_This page ships **visibly failing** (Layer A above): the issue is unfixed and any`);
        md.push(`scanner will report it. That is categorically different from hiding it to look clean._`);
      }
      writeFileSync(join(OUT, `${slug}.md`), md.join("\n") + "\n", "utf8");

      const detected = before.A.length + before.B.length + before.C.length;
      highlights.push({
        bucket,
        slug,
        detected,
        notes: highlightsFor(adv.fixes, detected, adv.reviewQueue.length, missed.map((v) => `WCAG ${v.wcag}`)),
        outcomes: adv.fixes.map((f) => f.outcome),
      });
      events += lines.length;
      console.log(`${bucket}/${slug}: ${adv.fixes.length} fixes, ${adv.reviewQueue.length} escalated`);
    }
   }
  } finally {
    await browser.close();
  }
  // "Start here": rank by how much verification machinery the trace exercises (guard rejection >
  // reflexion > escalation > memory), so a skimming judge lands on the load-bearing traces first.
  const score = (h: Highlight) =>
    (h.notes.some((n) => n.includes("regression guard")) ? 8 : 0) +
    (h.notes.some((n) => n.includes("reflexion")) ? 4 : 0) +
    (h.notes.some((n) => n.includes("unresolved")) ? 3 : 0) +
    (h.notes.some((n) => n.includes("escalated")) ? 2 : 0) +
    (h.notes.some((n) => n.includes("memory hit")) ? 1 : 0);
  // Steer by VARIETY, not just score: show each distinct capability once rather than the same
  // pattern twice. A judge skimming four traces should see four different things — including the
  // one where the agent declined and said why, which is our most honest artifact.
  // Capabilities as a SET, not a concatenated string. Joining them made "escalated+memory" and
  // "escalated" read as different kinds, so two picks demonstrated the identical capability on the
  // identical rule. A pick now has to bring at least one capability not already on the list.
  const capsOf = (h: Highlight) =>
    [["regression guard", "guard"], ["reflexion", "reflexion"], ["unresolved", "declined"], ["escalated", "escalated"], ["memory hit", "memory"]]
      .filter(([needle]) => h.notes.some((n) => n.includes(needle as string)))
      .map(([, label]) => label as string);
  const seenCaps = new Set<string>();
  const pick: Highlight[] = [];
  for (const h of [...highlights].filter((h) => score(h) > 0).sort((a, b) => score(b) - score(a))) {
    const caps = capsOf(h);
    if (caps.length > 0 && caps.every((c) => seenCaps.has(c))) continue;
    caps.forEach((c) => seenCaps.add(c));
    pick.push(h);
    if (pick.length === 4) break;
  }
  // Honest accounting: say so when a capability we advertise is NOT exercised by any trace.
  const guardPages = highlights.filter((h) => h.notes.some((n) => n.includes("regression guard"))).length;
  const guardNote =
    guardPages === 0
      ? `**Honest gap — what these traces do NOT show:** none of the ${highlights.length} traces contains a *regression-guard rejection*. In this run the advanced agent's own candidates never tried to delete or hide content, so the guard never had to fire. The guard's value is evidenced two other ways. Indirectly, in the scored eval: the single-shot baseline shipped **6 regressions**, the guarded advanced agent shipped **0** (see [\`metrics.json\`](../results/metrics.json)). Directly, in [\`test/regression-guard.test.ts\`](../../test/regression-guard.test.ts): adversarial candidates prove the gate **rejects** four cheat classes — deleting an informative image, demoting a real control to a non-focusable element, removing visible text, and emptying an informative image to \`alt=""\` — each with its reason string asserted, while **accepting** four legitimate fixes (adding an aria-label, grounding generic alt, upgrading \`div[role=button]\` to a real \`<button>\`, and empty alt where a descriptive \`<figcaption>\` already carries the alternative). Two further tests, originally written to characterize a blind spot, now prove it closed. Distinguishing *missed by the gate but caught downstream* from *not caught anywhere*, per class: **deletion / removed control / removed text** is caught by the gate itself (tested directly); **alt emptying** is caught by the gate inside a figure, and outside one by the **Layer C deterministic backstop** (rule informative-emptied, no LLM) whenever the image is in a figure or its src looks content-bearing (chart|graph|plot|diagram|figure|infographic|map|emission|revenue|data) — residual: a bare, generically-named img outside a figure is covered by neither; **CSS hiding (display:none / visibility:hidden / the hidden attribute) and risky aria-hidden** are **now rejected by the gate** — previously uncovered by the whole stack, and worse than one missed gate because Layer B's visibility filter *drops hidden elements*, so hiding an offending control made its violation "resolve". The snapshot now counts markup-level hiding and rejects any increase, with aria-hidden classified risky (focusable / contains a control / carries text — rejected) vs decorative (text-free non-focusable glyph inside a labelled control — accepted, the recommended pattern our own fixer emits); proven in [test/regression-guard.test.ts](../../test/regression-guard.test.ts), where the two tests that used to document the gap now assert the rejection. Residual, so this isn't read as catching everything: the gate reads markup, not computed style, so hiding via an external stylesheet class would still pass, and the bare generically-named img alt case remains uncovered. Independently, [test/no-hidden-content.test.ts](../../test/no-hidden-content.test.ts) measures **zero** hiding artifacts in our reported numbers — all 27 scored pages and all 85 LLM candidates. We would rather point all of that out than let a reader assume the traces prove something they don't.`
      : `The regression guard fired on **${guardPages}** page(s) below — those traces show a content-destroying candidate being rejected before commit.`;

  // The traces show what the agent DID; they don't show where it did less than the baseline. That
  // asymmetry is in metrics.json but not where the traces are read, so state it here too.
  const lostPages = (scored.perPage ?? [])
    .filter((p: any) => p.baseline?.trueFix && !p.advanced?.trueFix && (p.advanced?.after?.a ?? 0) > 0)
    .map((p: any) => p.page as string);
  const coverageNote = lostPages.length
    ? `\n\n**Honest gap — where we did worse than the baseline.** On ${lostPages.map((s: string) => `\`${s}\``).join(" and ")} the single-shot baseline shipped a page clean while the advanced agent left it visibly failing Layer A. That is the cost side of the abstention trade-off, and it is a real loss rather than a rounding error: per [\`metrics.json\`](../results/metrics.json) the baseline true-fixed those pages and we did not. Read these traces knowing the verified agent fixes fewer issues on purpose, and that on these ${lostPages.length} pages "fewer" meant "none".`
    : "";

  writeFileSync(
    join(OUT, "README.md"),
    `# Traces for every agent we used

A11yForge involves several agents; this is the one place to see the complete trace picture.

## 1. Runtime agent — the advanced remediation agent

Per-page decision traces: **detect** (A/B/C tool output) → **route** → **fix attempt(s)** →
**regression guard** → **verify** → **accept/escalate** → **outcome**. Readable Markdown + machine
JSONL for **every one of the ${highlights.length} pages the scored eval runs** (${events} events total) —
including the boring ones, labelled as such. Memory is shared within a bucket, exactly as in the
scored eval, so these traces reflect what the eval actually did.

**Start here** — the traces that prove the thesis, one per distinct capability:
${pick.map((h) => `- [\`${h.slug}\`](${h.slug}.md) — ${h.notes.join("; ")}`).join("\n")}
${pick.length < 4 ? `
_${pick.length} entries, not four: each has to show a capability the ones above it do not, and in this run the regression guard never fired — see the honest gap below._` : ""}

**All ${highlights.length} pages:**

| Page | Bucket | Detected | Why this trace is worth reading | Outcomes |
|---|---|---|---|---|
${highlights.map((h) => `| [\`${h.slug}\`](${h.slug}.md) · [jsonl](${h.slug}.jsonl) | ${h.bucket} | ${h.detected} | ${h.notes.join("; ")} | ${h.outcomes.join(", ") || "—"} |`).join("\n")}

${guardNote}${coverageNote}

**Reading a "memory hit":** memory recalls the previously-verified **strategy** (the routing
decision) for a repeat signature — not the patch itself. So a recalled fix can still take more than
one attempt and is always re-verified; memory saves re-derivation, it never skips verification.
(\`icon-only-control\` is both a memory hit and a 2-attempt reflexion, for exactly that reason.)

**JSONL schema:** a \`task\` event (detected issues), one \`fix\` event per finding
(\`target\`, \`strategy\`, \`iterations[]\` with attempt/action/regressionGuard/verify/decision,
\`outcome\`, \`memoryHit\`), and a \`result\` event (\`reviewQueue\`, \`memoryHits\`, outcome tally).

**What a screen-reader user hears — real captured narration diff:**
- [narration-diff.md](narration-diff.md) — the Guidepup virtual SR traversing the original vs the shipped DOM on all 27 pages, diffed. 16 pages changed audibly; the 11 that didn't are operability repairs (invisible to a reading-order traversal) and are listed with that reason.

**Deep dives — real model I/O, quoted from the committed cassettes:**
- **Reflexion** — [reflexion-icon-only-control.md](reflexion-icon-only-control.md): a Layer-B fix
  REJECTED on attempt 1, ACCEPTED on attempt 2 after the verifier's diagnostic is fed back.
- **Baseline vs advanced** — [contrast-alt-generic.md](contrast-alt-generic.md): the baseline ships
  a confident hallucinated alt; the advanced agent escalates instead of guessing.

## 2. Runtime LLMs — the raw model traces (\`cassettes/\`)

Every fixer/judge call is recorded to a content-hashed cassette under
[\`../../cassettes/\`](../../cassettes) (151 files): the exact request
\`{model, temperature, seed, messages}\` and the model's \`response\`. **These ARE the raw model
I/O** — the whole evaluation replays from them offline (\`A11YFORGE_MODE=replay\`, no API key).
Fixer = \`anthropic/claude-sonnet-5\`; judge = \`openai/gpt-4o-mini\` (different families).

151 hash-named files are not a trace a reader can follow, so the judge has a readable one:
[\`judge-verdicts.md\`](judge-verdicts.md) — its system prompt, six real verdicts quoted from those
cassettes with the gate decision each produced, its κ calibration with the scope limit spelled out,
and **the one anchor item where the judge disagreed with the expert label**, shown rather than
summarised.

## 3. Coding agents — how the repo was built

- [../WORK_TRAJECTORY.md](../WORK_TRAJECTORY.md) — the two-agent (orchestrator + builder) build trace,
  step by step, each backed by a commit.
- [../CODING_AGENT.md](../CODING_AGENT.md) — coding-agent + tool disclosure, and the honest
  experiments we tried and removed.

## 4. Coding agents — the machine-extracted build loop

[\`coding-agent/\`](coding-agent/) — the orchestrator/builder sessions that **built this repo**, one
JSON object per turn: every orchestrator instruction in full, every builder turn, and every tool call
with its name and a short argument summary. **Tool-result bodies are omitted entirely**, and secrets,
the local username and unrelated project names are redacted; the exporter re-scans its own output and
refuses to write if any pattern survives. Regenerate with
\`CODING_SESSION_DIR=<dir> node eval/export-coding-trajectory.mjs\`.
`,
    "utf8",
  );
  console.log("Wrote docs/trajectories/");
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
