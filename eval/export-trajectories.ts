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
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
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
        md.push(`### ${f.layer} [${f.wcag}] \`${f.selector ?? ""}\` → **${f.outcome}** (${f.strategy})`);
        if (f.iterations.length === 0) md.push(`- ${f.note ?? "resolved by an earlier whole-page fix / escalated"}`);
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
    `# A11yForge — runtime agent trajectories\n\nThe advanced agent's decision traces (detected issues → route → fix → verify → accept/escalate). Raw JSONL alongside each Markdown file. Reproduced offline via \`A11YFORGE_MODE=replay\`.\n\n${index.join("\n")}\n`,
    "utf8",
  );
  console.log("Wrote docs/trajectories/");
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
