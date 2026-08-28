import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { chromium, type Browser } from "playwright";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { join } from "node:path";
import { runLayerA } from "../src/layers/layerA-scanners.js";
import { runBaseline } from "../src/agents/baseline.js";
import { runScannerAutofix } from "../src/agents/scanner-autofix.js";
import { deterministicBackstops } from "../src/layers/layerC-judge.js";
import { scanAll, classifyOutcome } from "../src/harness/scan-all.js";
import type { Finding } from "../src/types.js";

/**
 * Baseline agent (fair single-shot) scored through the same A/B/C harness.
 * Replays committed claude-sonnet-5 cassettes — offline, deterministic.
 */

beforeAll(() => {
  process.env.A11YFORGE_MODE = "replay";
  process.env.FIXER_MODEL ??= "anthropic/claude-sonnet-5";
  process.env.JUDGE_MODEL ??= "openai/gpt-4o-mini";
});

const DIR = join(process.cwd(), "corpus", "adversarial");
let browser: Browser;
beforeAll(async () => { browser = await chromium.launch(); });
afterAll(async () => { await browser?.close(); });

const readPage = (slug: string) => readFileSync(join(DIR, slug, "index.html"), "utf8");
const scannerFor = (slug: string): Promise<Finding[]> =>
  runLayerA({ url: pathToFileURL(join(DIR, slug, "index.html")).href }, { browser });

describe("baseline is a fair single-shot fixer", () => {
  it("produces a changed, non-empty HTML document", async () => {
    const html = readPage("icon-only-control");
    const run = await runBaseline(html, await scannerFor("icon-only-control"));
    expect(run.html.length).toBeGreaterThan(0);
    expect(run.html.trim()).not.toBe(html.trim());
  });

  it("is deterministic across runs (cassette replay)", async () => {
    const html = readPage("alt-generic");
    const scanner = await scannerFor("alt-generic");
    const a = await runBaseline(html, scanner);
    const b = await runBaseline(html, scanner);
    expect(a.html).toBe(b.html);
  });
});

describe("the harness captures scanner-clean-but-broken (false-fix)", () => {
  it("icon-only-control: axe-clean after the fix, but Layer B still flags it", async () => {
    const html = readPage("icon-only-control");
    const run = await runBaseline(html, await scannerFor("icon-only-control"));
    const before = await scanAll(html, { browser });
    const after = await scanAll(run.html, { browser });
    const outcome = classifyOutcome(html, run.html, before, after);

    expect(outcome.axeCleanAfter).toBe(true); // scanner says "fixed"
    expect(after.B.length).toBeGreaterThan(0); // ...but a real user still can't use it
    expect(outcome.falseFix).toBe(true);
  });
});

describe("baseline resolves the scanner's OWN reported findings", () => {
  it("placeholder-as-label: Layer A findings before → zero after", async () => {
    const html = readPage("placeholder-as-label");
    const scanner = await scannerFor("placeholder-as-label");
    expect(scanner.length).toBeGreaterThan(0);
    const run = await runBaseline(html, scanner);
    const after = await scanAll(run.html, { browser });
    expect(after.A.length).toBe(0);
  });
});

describe("scanner-only auto-fix (pure determinism) cannot touch semantic issues", () => {
  it("alt-generic: the reference row leaves the meaningless alt (Layer C still flags)", () => {
    const html = readPage("alt-generic");
    // Scanner reported nothing on this page, so the deterministic tool has nothing to act on.
    const fixed = runScannerAutofix(html, []);
    const cAfter = deterministicBackstops(fixed);
    expect(cAfter.some((f) => (f.detail as { category?: string })?.category === "generic")).toBe(true);
  });
});
