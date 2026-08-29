import { chromium } from "playwright";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { join } from "node:path";
import { runLayerA } from "../src/layers/layerA-scanners.js";
import { runBaseline } from "../src/agents/baseline.js";

/**
 * Record baseline (claude-sonnet-5) fixer cassettes over the adversarial corpus.
 * Run once with a key:
 *   A11YFORGE_MODE=record FIXER_MODEL=anthropic/claude-sonnet-5 npx tsx eval/record-baseline.ts
 * Thereafter the baseline replays offline for free. Scanner findings come from the
 * same deterministic runLayerA({url}) used at scoring time, so the cassette key matches.
 */

const DIR = join(process.cwd(), "corpus", "adversarial");
const OUT = join(process.cwd(), "out", "baseline");

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const slugs = readdirSync(DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  try {
    for (const slug of slugs) {
      const html = readFileSync(join(DIR, slug, "index.html"), "utf8");
      const url = pathToFileURL(join(DIR, slug, "index.html")).href;
      const scanner = await runLayerA({ url }, { browser });
      const run = await runBaseline(html, scanner);
      writeFileSync(join(OUT, `${slug}.html`), run.html, "utf8");
      console.log(`${slug}: scanner=${scanner.length} findings → fixed ${run.html.length} bytes`);
    }
  } finally {
    await browser.close();
  }
  console.log("done — cassettes recorded under cassettes/, fixed HTML under out/baseline/");
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
