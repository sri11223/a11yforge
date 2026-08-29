import { chromium, type Browser } from "playwright";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Render an HTML string to a PNG for the report's visual before/after. Deterministic-ish:
 * fixed viewport, no animations. Used to show a page pre/post fix. (Screenshots capture
 * VISUAL state — the whole point of A11yForge is that many failures are invisible here,
 * so pair these with the SR transcript, not in place of it.)
 */

export interface ShotOptions {
  browser?: Browser;
  width?: number;
  height?: number;
  fullPage?: boolean;
}

export async function screenshotHtml(html: string, outPng: string, opts: ShotOptions = {}): Promise<void> {
  const browser = opts.browser ?? (await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] }));
  const ctx = await browser.newContext({
    viewport: { width: opts.width ?? 1000, height: opts.height ?? 700 },
    reducedMotion: "reduce",
  });
  const page = await ctx.newPage();
  const dir = mkdtempSync(join(tmpdir(), "a11yforge-shot-"));
  const file = join(dir, "page.html");
  writeFileSync(file, html, "utf8");
  try {
    await page.goto(pathToFileURL(file).href, { waitUntil: "load" });
    await page.screenshot({ path: outPng, fullPage: opts.fullPage ?? true });
  } finally {
    await ctx.close();
    if (!opts.browser) await browser.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Convenience: render before + after HTML to two PNGs (e.g. original vs advanced-fixed). */
export async function beforeAfter(
  beforeHtml: string,
  afterHtml: string,
  beforePng: string,
  afterPng: string,
  opts: ShotOptions = {},
): Promise<void> {
  const browser = opts.browser ?? (await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] }));
  try {
    await screenshotHtml(beforeHtml, beforePng, { ...opts, browser });
    await screenshotHtml(afterHtml, afterPng, { ...opts, browser });
  } finally {
    if (!opts.browser) await browser.close();
  }
}
