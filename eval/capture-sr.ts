import { chromium } from "playwright";
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { join } from "node:path";

/**
 * Capture the virtual screen-reader spoken transcript for a few B-exclusive pages —
 * the "hear it" evidence for the report: the scanner passes, but the SR experience is
 * wrong (e.g. reading order reversed, or a control announced only as a symbol). Run from
 * dist/. Writes docs/results/sr-transcript.json.
 */

const require = createRequire(import.meta.url);
const BUNDLE = require.resolve("@guidepup/virtual-screen-reader/browser.js");
const DATA_URL = "data:text/javascript;base64," + Buffer.from(readFileSync(BUNDLE, "utf8")).toString("base64");

const PAGES = ["css-reorder", "keyboard-trap-modal", "live-region-missing"];

async function spokenFor(browser: import("playwright").Browser, slug: string): Promise<string[]> {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(pathToFileURL(join(process.cwd(), "corpus", "adversarial", slug, "index.html")).href);
  await page.addScriptTag({
    type: "module",
    content: `import { virtual } from "${DATA_URL}"; window.__vsr = virtual; window.__ready = true;`,
  });
  await page.waitForFunction("window.__ready === true", { timeout: 15000 });
  const log = await page.evaluate(async () => {
    const v = (window as unknown as { __vsr: { start: (o: unknown) => Promise<void>; next: () => Promise<void>; lastSpokenPhrase: () => Promise<string>; spokenPhraseLog: () => Promise<string[]>; stop: () => Promise<void> } }).__vsr;
    await v.start({ container: document.body });
    for (let i = 0; i < 80; i++) {
      const before = await v.lastSpokenPhrase();
      await v.next();
      const after = await v.lastSpokenPhrase();
      if (i > 2 && before === after) break;
    }
    const out = await v.spokenPhraseLog();
    await v.stop();
    return out;
  });
  await ctx.close();
  return log;
}

async function main(): Promise<void> {
  const browser = await chromium.launch();
  const result: Record<string, string[]> = {};
  try {
    for (const slug of PAGES) result[slug] = await spokenFor(browser, slug);
  } finally {
    await browser.close();
  }
  mkdirSync(join(process.cwd(), "docs", "results"), { recursive: true });
  writeFileSync(
    join(process.cwd(), "docs", "results", "sr-transcript.json"),
    JSON.stringify(
      {
        note: "Verbatim virtual-screen-reader spoken transcript (Guidepup) for pages that pass a WCAG axe scan. The reading order / announcements reveal what the scanner cannot see.",
        engine: "@guidepup/virtual-screen-reader",
        transcripts: result,
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );
  for (const slug of PAGES) console.log(`${slug}: ${result[slug]!.length} phrases`);
  console.log("Wrote docs/results/sr-transcript.json");
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
