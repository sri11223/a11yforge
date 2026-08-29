import { chromium, type Browser } from "playwright";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runAdvanced } from "../src/agents/advanced.js";
import { screenshotHtml } from "../src/report/screenshot.js";

/**
 * Build the report's visual before/after PNGs: for a few illustrative pages, render the
 * ORIGINAL page (before) and the ADVANCED-agent output (after) at a fixed viewport.
 *
 * The point these images make is deliberately counter-intuitive: the before and after look
 * (near-)identical. A screenshot, like a scanner, cannot see a keyboard trap or a hallucinated
 * alt — which is exactly why axe passes these pages. Captions carry what actually changed.
 *
 * Deterministic path: the "after" HTML replays committed cassettes (A11YFORGE_MODE=replay), and
 * rendering uses the pinned Playwright Chromium at a fixed viewport with reduced motion. (Pixel
 * output can vary with host font rasterisation; the committed PNGs are generated in the pinned
 * image, and this script regenerates them.) Run from dist/: node dist/eval/build-shots.js
 */

const VIEWPORT = { width: 1000, height: 720 };
const OUT = join(process.cwd(), "docs", "assets", "shots");
const CORPUS = join(process.cwd(), "corpus", "adversarial");

// Force any hidden modal/overlay visible so the shot captures the dialog state (applied
// identically to before and after, so the comparison stays apples-to-apples).
const SHOW_OVERLAY = "<style>.overlay{display:flex !important}</style>";

interface Shot {
  slug: string;
  prep?: (html: string) => string;
}

const SHOTS: Shot[] = [
  { slug: "keyboard-trap-modal", prep: (h) => h.replace("</head>", `${SHOW_OVERLAY}</head>`) },
  { slug: "alt-generic" },
];

async function main(): Promise<void> {
  process.env.A11YFORGE_MODE ??= "replay";
  process.env.FIXER_MODEL ??= "anthropic/claude-sonnet-5";
  process.env.JUDGE_MODEL ??= "openai/gpt-4o-mini";

  const browser: Browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  try {
    for (const shot of SHOTS) {
      const original = readFileSync(join(CORPUS, shot.slug, "index.html"), "utf8");
      const advanced = (await runAdvanced(original, { browser, pageId: shot.slug })).html;
      const before = shot.prep ? shot.prep(original) : original;
      const after = shot.prep ? shot.prep(advanced) : advanced;
      await screenshotHtml(before, join(OUT, `${shot.slug}-before.png`), { browser, ...VIEWPORT, fullPage: false });
      await screenshotHtml(after, join(OUT, `${shot.slug}-after.png`), { browser, ...VIEWPORT, fullPage: false });
      console.log(`shot: ${shot.slug} (before + after)`);
    }
  } finally {
    await browser.close();
  }
  console.log(`Wrote PNGs to ${OUT}`);
}

main().catch((e: unknown) => { console.error(e); process.exitCode = 1; });
