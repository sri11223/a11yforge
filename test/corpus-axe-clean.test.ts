import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { chromium, type Browser } from "playwright";
import { AxeBuilder } from "@axe-core/playwright";
import { pathToFileURL } from "node:url";
import { join } from "node:path";
import { readdirSync, readFileSync } from "node:fs";
import { ManifestSchema } from "../src/types.js";

/**
 * Thesis-in-a-test: the five "scanner-can't-see-it" adversarial pages are broken
 * for keyboard / screen-reader users, yet a WCAG-conformance scan (axe) reports
 * ZERO violations. This mechanically proves "scanner-clean ≠ usable".
 *
 * Scope note: we assert against the WCAG 2.x A/AA success-criteria ruleset — the
 * standard compliance is legally measured against (and the basis of the accessiBe
 * claims). axe's own advisory "best-practice" rules (e.g. positive-tabindex,
 * skip-link target) are NOT WCAG success criteria and are out of this scope; even
 * where they would hint, they do not capture the actual severity Layer B measures.
 */

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

const SCANNER_INVISIBLE = [
  "keyboard-trap-modal",
  "css-reorder",
  "positive-tabindex",
  "live-region-missing",
  "skip-link-broken",
];

const ADVERSARIAL_DIR = join(process.cwd(), "corpus", "adversarial");
const ALL_PAGES = readdirSync(ADVERSARIAL_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

async function axeWcagViolationIds(browser: Browser, slug: string): Promise<string[]> {
  const context = await browser.newContext();
  const page = await context.newPage();
  const url = pathToFileURL(join(ADVERSARIAL_DIR, slug, "index.html")).href;
  await page.goto(url);
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  await context.close();
  return results.violations.map((v) => `${v.id} (${v.nodes.length})`);
}

let browser: Browser | undefined;
beforeAll(async () => {
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
});

describe("scanner-clean ≠ usable (WCAG-conformance axe scan)", () => {
  for (const slug of SCANNER_INVISIBLE) {
    it(
      `${slug}: zero WCAG violations despite being broken`,
      async () => {
        const ids = await axeWcagViolationIds(browser!, slug);
        // Helpful failure output if a page accidentally trips a real WCAG rule.
        expect(ids, `unexpected WCAG violations on ${slug}: ${ids.join(", ")}`).toEqual([]);
      },
      60_000,
    );
  }
});

describe("corpus manifests are valid", () => {
  for (const slug of ALL_PAGES) {
    it(`${slug}: manifest matches ManifestSchema and id`, () => {
      const raw = readFileSync(join(ADVERSARIAL_DIR, slug, "manifest.json"), "utf8");
      const parsed = ManifestSchema.parse(JSON.parse(raw));
      expect(parsed.id).toBe(slug);
      expect(parsed.violations.length).toBeGreaterThan(0);
    });
  }
});

// Informational: report the WCAG-axe result for every adversarial page so we can
// see exactly which pages are scanner-clean. Only heading-skip is expected to be
// caught by Layer A — and by the pa11y engine, not the WCAG-tagged axe pass — so
// under this axe scan every page should report zero violations.
describe("full-corpus WCAG-axe scan (transparency)", () => {
  for (const slug of ALL_PAGES) {
    it(
      `${slug}: WCAG-axe violations reported`,
      async () => {
        const ids = await axeWcagViolationIds(browser!, slug);
        console.log(`[axe:wcag] ${slug}: ${ids.length ? ids.join(", ") : "clean"}`);
        expect(Array.isArray(ids)).toBe(true);
      },
      60_000,
    );
  }
});
