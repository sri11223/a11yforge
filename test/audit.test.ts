import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { chromium, type Browser } from "playwright";
import { audit } from "../src/cli/audit.js";

/**
 * `audit` CLI on a tiny inline page that PASSES axe but is broken for SR/keyboard users.
 * Layer C runs offline (backstops only — no key), so this test needs no network/key.
 */

let browser: Browser;
beforeAll(async () => {
  process.env.A11YFORGE_MODE = "replay";
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
});

const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>demo</title></head>
<body>
  <h1>Demo</h1>
  <img src="hero.jpg" alt="image">
  <div role="button" aria-label="Play" onclick="void 0">&#9654;</div>
</body></html>`;

describe("a11yforge audit", () => {
  it("reports the gap: axe-clean but Layer B + Layer C flag it", async () => {
    const r = await audit("inline-demo", { browser, html: PAGE, noJudge: true });
    expect(r.scannerClean).toBe(true); // axe finds nothing
    expect(r.summary.behavioral).toBeGreaterThan(0); // icon control not keyboard-focusable
    expect(r.summary.semantic).toBeGreaterThan(0); // alt="image" (generic backstop, no LLM)
    expect(r.gap).toBe(true);
  });
});
