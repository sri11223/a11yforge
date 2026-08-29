import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runAdvanced } from "../src/agents/advanced.js";
import { scanAll } from "../src/harness/scan-all.js";
import type { Finding } from "../src/types.js";

/**
 * Export the runtime agent's decision trajectories: the detected issues (A/B/C tool
 * output) → per-fix route/attempt → verify verdicts → accept/escalate decision → final
 * outcome. Emits raw JSONL (machine) + Markdown (human) per representative page. Run from
 * dist/ (uses Layer B). Writes docs/trajectories/.
 */

const CASES = ["icon-only-control", "alt-generic", "keyboard-trap-modal"];
const DIR = join(process.cwd(), "corpus", "adversarial");
const OUT = join(process.cwd(), "docs", "trajectories");

const short = (f: Finding) => ({ layer: f.layer, wcag: f.wcag, selector: f.selector, message: f.message });

async function main(): Promise<void> {
  process.env.A11YFORGE_MODE ??= "replay";
  process.env.FIXER_MODEL ??= "anthropic/claude-sonnet-5";
  process.env.JUDGE_MODEL ??= "openai/gpt-4o-mini";

  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const index: string[] = [];
  try {
    for (const slug of CASES) {
      const html = readFileSync(join(DIR, slug, "index.html"), "utf8");
      const before = await scanAll(html, { browser });
      const adv = await runAdvanced(html, { browser, pageId: slug });

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
      md.push(`**Detected issues (A/B/C tool output):**\n`);
      for (const f of [...before.A, ...before.B, ...before.C]) md.push(`- \`${f.layer}\` [${f.wcag}] ${f.message} — \`${f.selector ?? ""}\``);
      md.push(`\n**Agent decisions:**\n`);
      for (const f of adv.fixes) {
        md.push(`### ${f.layer} [${f.wcag}] \`${f.selector ?? ""}\` → **${f.outcome}** (${f.strategy})${f.memoryHit ? " · memory-hit (strategy recalled from an earlier verified fix)" : ""}`);
        if (f.iterations.length === 0) md.push(`- ${f.note ?? "resolved by an earlier whole-page fix / escalated"}`);
        if (f.iterations.length > 1) md.push(`- _reflexion: ${f.iterations.length} attempts — a rejected attempt's diagnostic is fed back into the next try._`);
        for (const it of f.iterations) {
          md.push(`- attempt ${it.attempt}: ${it.strategy === "rule" ? "deterministic rule fix" : "LLM targeted fix"} → guard ${it.guardOk ? "ok" : "REJECTED (" + it.guardReasons.join("; ") + ")"} · verify: target ${it.targetResolved ? "resolved" : "still present"}, new findings [${it.newFindings.join(", ") || "none"}] → **${it.accepted ? "ACCEPT" : "REJECT — feed failure back and retry"}**`);
        }
        if (f.outcome === "needs-review") md.push(`- → escalated to **human checkpoint**: alt left untouched (no fabricated description).`);
        md.push("");
      }
      const finalScan = await scanAll(adv.html, { browser });
      md.push(`**Shipped result:** Layer A ${finalScan.A.length} · Layer B ${finalScan.B.length} · Layer C ${finalScan.C.length}` + (adv.reviewQueue.length ? ` · ${adv.reviewQueue.length} escalated for human review` : ""));
      writeFileSync(join(OUT, `${slug}.md`), md.join("\n") + "\n", "utf8");

      index.push(`- [\`${slug}\`](${slug}.md) — ${adv.fixes.map((f) => f.outcome).join(", ")}`);
      console.log(`${slug}: ${adv.fixes.length} fixes, ${adv.reviewQueue.length} escalated`);
    }
  } finally {
    await browser.close();
  }
  writeFileSync(
    join(OUT, "README.md"),
    `# Traces for every agent we used

A11yForge involves several agents; this is the one place to see the complete trace picture.

## 1. Runtime agent — the advanced remediation agent

Per-page decision traces: **detect** (A/B/C tool output) → **route** → **fix attempt(s)** →
**regression guard** → **verify** → **accept/escalate** → **outcome**. Readable Markdown + machine
JSONL per page:

${index.join("\n")}

**JSONL schema:** a \`task\` event (detected issues), one \`fix\` event per finding
(\`target\`, \`strategy\`, \`iterations[]\` with attempt/action/regressionGuard/verify/decision,
\`outcome\`, \`memoryHit\`), and a \`result\` event (\`reviewQueue\`, \`memoryHits\`, outcome tally).

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

## 3. Coding agents — how the repo was built

- [../WORK_TRAJECTORY.md](../WORK_TRAJECTORY.md) — the two-agent (orchestrator + builder) build trace,
  step by step, each backed by a commit.
- [../CODING_AGENT.md](../CODING_AGENT.md) — coding-agent + tool disclosure, and the honest
  experiments we tried and removed.
`,
    "utf8",
  );
  console.log("Wrote docs/trajectories/");
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
