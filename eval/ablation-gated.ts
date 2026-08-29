import { chromium, type Browser } from "playwright";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runAdvanced, type FixMemory } from "../src/agents/advanced.js";
import { scanAll } from "../src/harness/scan-all.js";
import { scorePage } from "../src/metrics/score.js";
import type { Layer } from "../src/types.js";

/**
 * Ablation: run the advanced verify-loop gated at {A}, {A,B}, {A,B,C} — a shallower
 * gate can neither see nor verify the omitted layers, so it ships false-compliances a
 * deeper gate catches. Every shipped output is judged by the FULL A/B/C harness (the
 * truth), so the false-fix counts are comparable. Replays cassettes (auto for safety).
 * Run from dist/. Writes out/ablation.json.
 */

const GATES: { label: string; layers: Layer[] }[] = [
  { label: "{A}", layers: ["A"] },
  { label: "{A,B}", layers: ["A", "B"] },
  { label: "{A,B,C}", layers: ["A", "B", "C"] },
];
const BUCKETS = ["adversarial", "injected"].map((b) => join(process.cwd(), "corpus", b));

async function main(): Promise<void> {
  process.env.A11YFORGE_MODE ??= "replay";
  process.env.FIXER_MODEL ??= "anthropic/claude-sonnet-5";
  process.env.JUDGE_MODEL ??= "openai/gpt-4o-mini";

  const browser: Browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const rows: Record<string, { falseFixPages: number; trueFixPages: number; needsReviewPages: number }> = {};
  for (const g of GATES) rows[g.label] = { falseFixPages: 0, trueFixPages: 0, needsReviewPages: 0 };

  try {
    for (const dir of BUCKETS) {
      if (!existsSync(dir)) continue;
      const slugs = readdirSync(dir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
        .filter((s) => existsSync(join(dir, s, "index.html")))
        .sort();
      for (const slug of slugs) {
        const html = readFileSync(join(dir, slug, "index.html"), "utf8");
        const before = await scanAll(html, { browser });
        for (const g of GATES) {
          const memory: FixMemory = new Map();
          const adv = await runAdvanced(html, { browser, pageId: slug, memory, layers: g.layers });
          const after = await scanAll(adv.html, { browser });
          const reviewSel = new Set(adv.reviewQueue.map((r) => r.selector));
          const s = scorePage(slug, `gate-${g.label}`, html, adv.html, before, after, reviewSel);
          if (s.falseFixPage) rows[g.label]!.falseFixPages++;
          if (s.trueFixPage) rows[g.label]!.trueFixPages++;
          if (adv.reviewQueue.length) rows[g.label]!.needsReviewPages++;
        }
        process.stdout.write(".");
      }
    }
    process.stdout.write("\n");
  } finally {
    await browser.close();
  }

  const ff = (l: string) => rows[l]!.falseFixPages;
  const result = {
    note: "Advanced verify-loop gated at increasing depth; outputs judged by the full A/B/C harness.",
    rows,
    caught: {
      byAddingB: ff("{A}") - ff("{A,B}"),
      byAddingC: ff("{A,B}") - ff("{A,B,C}"),
    },
  };
  mkdirSync(join(process.cwd(), "out"), { recursive: true });
  writeFileSync(join(process.cwd(), "out", "ablation.json"), JSON.stringify(result, null, 2) + "\n", "utf8");

  console.log("\nGATE       false-fix pages   true-fix pages   needs-review pages");
  for (const g of GATES) {
    const r = rows[g.label]!;
    console.log(`${g.label.padEnd(9)} ${String(r.falseFixPages).padStart(13)}   ${String(r.trueFixPages).padStart(14)}   ${String(r.needsReviewPages).padStart(17)}`);
  }
  console.log(`\nfalse-fixes caught by adding Layer B: ${result.caught.byAddingB}`);
  console.log(`false-fixes caught by adding Layer C: ${result.caught.byAddingC}`);
  console.log("Wrote out/ablation.json");
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
