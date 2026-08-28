import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { chromium, type Browser } from "playwright";
import { pathToFileURL } from "node:url";
import { join } from "node:path";
import { readdirSync } from "node:fs";
import { runLayerA } from "../src/layers/layerA-scanners.js";
import type { Finding } from "../src/types.js";

/**
 * Layer A wired for real (axe-core + pa11y). These tests prove two things:
 *  1. Layer A genuinely catches definite mechanical failures (placeholder-as-label,
 *     via pa11y — which axe misses: the two-engine payoff).
 *  2. The gap holds through the REAL layer: the five scanner-invisible pages, plus
 *     heading-skip, produce ZERO Layer-A findings.
 */

const ADVERSARIAL_DIR = join(process.cwd(), "corpus", "adversarial");
const B_EXCLUSIVE = [
  "keyboard-trap-modal",
  "css-reorder",
  "positive-tabindex",
  "live-region-missing",
  "skip-link-broken",
];
const ALL_PAGES = readdirSync(ADVERSARIAL_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

let browser: Browser;
beforeAll(async () => {
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
});

function urlFor(slug: string): string {
  return pathToFileURL(join(ADVERSARIAL_DIR, slug, "index.html")).href;
}
async function scan(slug: string): Promise<Finding[]> {
  return runLayerA({ url: urlFor(slug) }, { browser });
}

describe("Layer A catches genuine mechanical failures", () => {
  it(
    "placeholder-as-label: flagged by pa11y even though axe misses it",
    async () => {
      const findings = await scan("placeholder-as-label");
      expect(findings.length).toBeGreaterThan(0);
      // The missing-label failure is a WCAG name/label criterion...
      expect(findings.some((f) => f.wcag === "4.1.2" || f.wcag === "1.3.1")).toBe(true);
      // ...and it comes from pa11y, not axe (single-vendor scanning would miss it).
      expect(findings.every((f) => f.source.includes("pa11y"))).toBe(true);
      expect(findings.some((f) => !f.source.includes("axe-core"))).toBe(true);
    },
    60_000,
  );
});

describe("the gap holds through the real Layer A", () => {
  for (const slug of B_EXCLUSIVE) {
    it(
      `${slug}: zero Layer-A findings`,
      async () => {
        const findings = await scan(slug);
        expect(findings, `unexpected Layer-A findings: ${JSON.stringify(findings)}`).toEqual([]);
      },
      60_000,
    );
  }

  it(
    "heading-skip: zero Layer-A findings (only a warning-level signal, not a conformance error)",
    async () => {
      const findings = await scan("heading-skip");
      expect(findings).toEqual([]);
    },
    60_000,
  );

  it(
    "across the whole corpus, only placeholder-as-label yields Layer-A findings",
    async () => {
      const withFindings: string[] = [];
      for (const slug of ALL_PAGES) {
        const findings = await scan(slug);
        if (findings.length) withFindings.push(slug);
      }
      expect(withFindings).toEqual(["placeholder-as-label"]);
    },
    240_000,
  );
});

describe("Layer A output is deterministic", () => {
  it(
    "same page yields byte-identical findings across runs",
    async () => {
      const a = await scan("placeholder-as-label");
      const b = await scan("placeholder-as-label");
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    },
    60_000,
  );
});
