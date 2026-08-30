import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { chromium, type Browser } from "playwright";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as cheerio from "cheerio";
import { runAdvanced } from "../src/agents/advanced.js";
import { isRiskyAriaHidden } from "../src/agents/regression-guard.js";

/**
 * Measured proof that NO reported fix is a hidden-content artifact.
 *
 * WHY THIS EXISTS: hiding is the cheat that would otherwise slip through the whole stack, because
 * Layer B's visibility filter drops hidden elements, so a hidden violation "resolves". The guard now
 * REJECTS markup-level hiding (see test/regression-guard.test.ts), but a gate only stops what it is
 * shown; this file is the independent measurement that our REPORTED numbers contain no hiding
 * artifact — asserted before, measured here, and it keeps holding as the guard evolves.
 *
 * COVERAGE ARGUMENT: an applied fix is either (a) an LLM candidate — every one of which came from
 * a committed cassette, and `every candidate in the sealed prompt set` is checked below, a superset
 * of what was actually applied — or (b) a deterministic rule fix, whose only edits are setting
 * aria-label, removing a contradicting aria-label, and setting alt="" (none of which hide). The
 * end-to-end test then confirms the *applied* output of the LLM-routed pages directly.
 *
 * THE DISTINCTION THAT MATTERS: `aria-hidden="true"` on a decorative glyph (a <span>▶</span> inside
 * a labelled button) is CORRECT practice, not laundering — it stops the screen reader announcing
 * the glyph twice. Laundering is hiding something a user needs: a focusable control, an element
 * containing a focusable control, or element text. We measure the risky class, not the benign one.
 */

interface HidingProfile {
  /** inline style display:none / visibility:hidden */
  inlineHidden: number;
  /** the boolean `hidden` attribute */
  hiddenAttr: number;
  /** aria-hidden="true" on something a user needs: focusable, contains focusable, or has words */
  ariaHiddenRisky: number;
  /** aria-hidden="true" on a text-free, non-focusable decorative element (legitimate) */
  ariaHiddenDecorative: number;
}

function hidingProfile(html: string): HidingProfile {
  const $ = cheerio.load(html);
  const inlineHidden = $("[style]").filter((_i, e) =>
    /display\s*:\s*none|visibility\s*:\s*hidden/i.test($(e).attr("style") ?? ""),
  ).length;
  const hiddenAttr = $("[hidden]").length;
  let ariaHiddenRisky = 0;
  let ariaHiddenDecorative = 0;
  // Imported from the guard itself, so this measurement and the gate can never disagree about
  // what "risky" means (the guard now rejects on the same predicate).
  $('[aria-hidden="true"]').each((_i, e) => {
    if (isRiskyAriaHidden($, e)) ariaHiddenRisky++;
    else ariaHiddenDecorative++;
  });
  return { inlineHidden, hiddenAttr, ariaHiddenRisky, ariaHiddenDecorative };
}

/** Pull the original page out of a fixer prompt (both prompts end with "HTML:\n<document>"). */
function originalFromPrompt(messages: { role: string; content: string }[]): string | null {
  const user = messages.filter((m) => m.role === "user").map((m) => m.content).join("\n");
  const i = user.indexOf("HTML:");
  return i < 0 ? null : user.slice(i + 5).trim();
}

describe("no fix candidate in the sealed prompt set introduces hidden content", () => {
  it("every LLM fix candidate: no new display:none / visibility:hidden / [hidden] / risky aria-hidden", () => {
    const dir = join(process.cwd(), "cassettes");
    const offenders: string[] = [];
    let analyzed = 0;
    let decorativeAdded = 0;

    for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
      const c = JSON.parse(readFileSync(join(dir, file), "utf8")) as {
        request: { model: string; messages: { role: string; content: string }[] };
        response: string;
      };
      // Fixer-role calls are the only ones that return HTML documents.
      if (!String(c.request.model).startsWith("anthropic/")) continue;
      const original = originalFromPrompt(c.request.messages);
      const response = String(c.response);
      if (!original || !/<html/i.test(response)) continue;

      analyzed++;
      const before = hidingProfile(original);
      const after = hidingProfile(response);
      for (const key of ["inlineHidden", "hiddenAttr", "ariaHiddenRisky"] as const) {
        if (after[key] > before[key]) {
          offenders.push(`${file.slice(0, 10)}: ${key} ${before[key]} → ${after[key]}`);
        }
      }
      decorativeAdded += Math.max(0, after.ariaHiddenDecorative - before.ariaHiddenDecorative);
    }

    // Sanity: we actually examined the candidate set, not an empty selection.
    expect(analyzed).toBeGreaterThan(50);
    expect(offenders).toEqual([]);
    // Documented, benign counterpart: candidates DO add aria-hidden to decorative glyphs
    // (a <span>▶</span> inside a labelled button). That is correct practice, so it must not be
    // conflated with laundering — asserting it is non-zero keeps the distinction honest and live.
    expect(decorativeAdded).toBeGreaterThan(0);
  });
});

describe("the applied output of the LLM-routed pages introduces no hidden content", () => {
  let browser: Browser;
  beforeAll(async () => {
    process.env.A11YFORGE_MODE = "replay";
    process.env.FIXER_MODEL ??= "anthropic/claude-sonnet-5";
    process.env.JUDGE_MODEL ??= "openai/gpt-4o-mini";
    browser = await chromium.launch();
  });
  afterAll(async () => {
    await browser?.close();
  });

  // EVERY page of the scored 27-page eval corpus (adversarial + injected), so this is a
  // measurement of the run our headline numbers come from — not a sample.
  const cases: [string, string][] = ["adversarial", "injected"].flatMap((bucket) => {
    const dir = join(process.cwd(), "corpus", bucket);
    return readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .filter((slug) => existsSync(join(dir, slug, "index.html")))
      .sort()
      .map((slug) => [bucket, slug] as [string, string]);
  });

  it("covers all 27 scored pages", () => {
    expect(cases.length).toBe(27);
  });

  for (const [bucket, slug] of cases) {
    it(`${bucket}/${slug}: shipped HTML adds no hiding vs the original`, async () => {
      const original = readFileSync(join(process.cwd(), "corpus", bucket, slug, "index.html"), "utf8");
      const adv = await runAdvanced(original, { browser, pageId: slug });
      const before = hidingProfile(original);
      const after = hidingProfile(adv.html);
      expect(after.inlineHidden).toBeLessThanOrEqual(before.inlineHidden);
      expect(after.hiddenAttr).toBeLessThanOrEqual(before.hiddenAttr);
      expect(after.ariaHiddenRisky).toBeLessThanOrEqual(before.ariaHiddenRisky);
    }, 120_000);
  }
});
