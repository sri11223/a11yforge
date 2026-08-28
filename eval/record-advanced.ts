import { chromium } from "playwright";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runAdvanced, type FixMemory } from "../src/agents/advanced.js";

/**
 * Record advanced-agent runs over the corpus. Must run from compiled dist/ (the
 * verify-loop calls Layer B / page.evaluate, which breaks under tsx's esbuild shim):
 *   npx tsc
 *   A11YFORGE_MODE=record FIXER_MODEL=anthropic/claude-sonnet-5 JUDGE_MODEL=openai/gpt-4o-mini \
 *     node dist/eval/record-advanced.js [optional-slug]
 * A shared FixMemory carries verified fix signatures across pages (deterministic order).
 */

const DIR = join(process.cwd(), "corpus", "adversarial");
const OUT = join(process.cwd(), "out", "advanced");

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const only = process.argv[2];
  const slugs = readdirSync(DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((s) => !only || s === only)
    .sort();

  const browser = await chromium.launch();
  const memory: FixMemory = new Map();
  try {
    for (const slug of slugs) {
      const html = readFileSync(join(DIR, slug, "index.html"), "utf8");
      const res = await runAdvanced(html, { browser, memory, pageId: slug });
      writeFileSync(join(OUT, `${slug}.html`), res.html, "utf8");
      writeFileSync(
        join(OUT, `${slug}.fixes.json`),
        JSON.stringify({ fixes: res.fixes, reviewQueue: res.reviewQueue, memoryHits: res.memoryHits }, null, 2) + "\n",
        "utf8",
      );
      const counts = res.fixes.reduce<Record<string, number>>((m, f) => ((m[f.outcome] = (m[f.outcome] ?? 0) + 1), m), {});
      console.log(`${slug}: ${JSON.stringify(counts)} memHits=${res.memoryHits} review=${res.reviewQueue.length}`);
    }
  } finally {
    await browser.close();
  }
  console.log("done — cassettes under cassettes/, outputs under out/advanced/");
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
