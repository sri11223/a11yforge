import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { chromium, type Browser } from "playwright";
import { pathToFileURL } from "node:url";
import { join } from "node:path";
import { runLayerB } from "../src/layers/layerB-sr.js";
import type { Finding } from "../src/types.js";

/**
 * Layer B — the screen-reader/keyboard layer. Two guarantees:
 *  1. Catch what it should: each expected behavioral violation is flagged on the
 *     right page (the 5 B-exclusive pages + heading-skip + the operability bits).
 *  2. Don't cry wolf: pages where the behavioral dimension is actually fine
 *     (the alt-text/semantic pages) produce ZERO Layer-B findings.
 */

const DIR = join(process.cwd(), "corpus", "adversarial");
let browser: Browser;
beforeAll(async () => {
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
});

function scan(slug: string): Promise<Finding[]> {
  return runLayerB({ url: pathToFileURL(join(DIR, slug, "index.html")).href }, { browser });
}
const wcags = (f: Finding[]) => f.map((x) => x.wcag);

describe("Layer B catches behavioral violations", () => {
  it("keyboard-trap-modal: flags the trap (2.1.2) and the non-operable close (2.1.1)", async () => {
    const f = await scan("keyboard-trap-modal");
    expect(wcags(f)).toContain("2.1.2");
    expect(wcags(f)).toContain("2.1.1");
  });

  it("css-reorder: flags visual/reading order mismatch (1.3.2)", async () => {
    expect(wcags(await scan("css-reorder"))).toContain("1.3.2");
  });

  it("positive-tabindex: flags focus order mismatch (2.4.3)", async () => {
    expect(wcags(await scan("positive-tabindex"))).toContain("2.4.3");
  });

  it("live-region-missing: flags silent dynamic update (4.1.3)", async () => {
    expect(wcags(await scan("live-region-missing"))).toContain("4.1.3");
  });

  it("skip-link-broken: flags dead skip-link target (2.4.1)", async () => {
    expect(wcags(await scan("skip-link-broken"))).toContain("2.4.1");
  });

  it("heading-skip: flags skipped heading level (1.3.1)", async () => {
    expect(wcags(await scan("heading-skip"))).toContain("1.3.1");
  });

  it("icon-only-control: flags control not keyboard-focusable (2.1.1)", async () => {
    expect(wcags(await scan("icon-only-control"))).toContain("2.1.1");
  });

  it("div-button-no-keys: flags no keyboard activation (2.1.1)", async () => {
    expect(wcags(await scan("div-button-no-keys"))).toContain("2.1.1");
  });
});

describe("Layer B does not cry wolf on B-clean pages", () => {
  const CLEAN = [
    "alt-generic",
    "alt-is-filename",
    "informative-emptied",
    "aria-label-contradicts",
    "color-only-status",
    "redundant-alt-decorative",
    "placeholder-as-label",
  ];
  for (const slug of CLEAN) {
    it(`${slug}: zero Layer-B findings`, async () => {
      const f = await scan(slug);
      expect(f, `unexpected Layer-B findings: ${JSON.stringify(f.map((x) => x.id))}`).toEqual([]);
    });
  }
});

describe("Layer B actually engages the virtual screen reader (no silent fallback)", () => {
  it("css-reorder: findings carry a populated SR reading-order transcript", async () => {
    const f = await scan("css-reorder");
    const withSr = f.find((x) => Array.isArray((x.detail as { srReadingOrderSample?: unknown })?.srReadingOrderSample));
    expect(withSr, "no finding carried srReadingOrderSample — the virtual SR did not engage").toBeTruthy();
    const sample = (withSr!.detail as { srReadingOrderSample: string[] }).srReadingOrderSample;
    // A populated transcript proves the virtual SR actually ran (not the silent CDP fallback).
    expect(sample.length).toBeGreaterThan(0);
    // ...and it is a real SR announcement stream (roles/names), not empty strings.
    expect(sample.some((p) => /link|heading|banner|navigation|button|document/i.test(p))).toBe(true);
  });
});

describe("Layer B output is deterministic", () => {
  it("keyboard-trap-modal yields byte-identical findings across runs", async () => {
    const a = await scan("keyboard-trap-modal");
    const b = await scan("keyboard-trap-modal");
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
