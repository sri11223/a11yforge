import { describe, it, expect } from "vitest";
import { snapshot, checkRegression } from "../src/agents/regression-guard.js";

/**
 * ADVERSARIAL, DIRECT proof of the regression guard — the pre-commit gate that rejects a
 * candidate "fix" that cheats by deleting / removing / emptying content to satisfy a checker.
 *
 * Why this file exists: none of the 27 committed runtime traces contains a guard rejection (in
 * that run the agent never attempted a cheat), so the guard's evidence was only INDIRECT — the
 * baseline's 6 regressions vs the advanced agent's 0. These tests are the direct evidence: we
 * hand-build cheat candidates and assert the verdict AND the reason string.
 *
 * The accept-side cases matter as much as the rejections: a guard that rejected everything would
 * pass every rejection test and be useless. Those cases prove it DISCRIMINATES.
 *
 * SCOPE, STATED HONESTLY: the guard compares deterministic cheerio DOM-shape snapshots (visible
 * text tokens, focusable count, image count, informative-figure alt emptying). It has no notion of
 * computed style or ARIA visibility, so CSS-hiding and aria-hidden laundering are NOT caught by
 * this gate — the two "known limitation" tests at the bottom characterize that gap explicitly
 * rather than leave it undocumented.
 */

const verdict = (before: string, after: string) => checkRegression(snapshot(before), snapshot(after));

const page = (main: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>t</title></head><body>${main}</body></html>`;

describe("regression guard REJECTS fix-by-deletion cheats", () => {
  it("deleting an informative image → rejected, with an image-removed reason", () => {
    const before = page(`<main><h1>Gallery</h1><img src="a.jpg" alt="A red bicycle leaning on a fence"><p>Our latest work.</p></main>`);
    const after = page(`<main><h1>Gallery</h1><p>Our latest work.</p></main>`);
    const r = verdict(before, after);
    expect(r.ok).toBe(false);
    expect(r.reasons.join(" ")).toMatch(/an image was removed \(1 → 0\)/);
  });

  it("demoting a real control to a non-focusable element → rejected (focusable count dropped)", () => {
    // Text is preserved, so ONLY the focusable-loss reason should fire — proving the guard
    // detects lost operability, not merely lost text.
    const before = page(`<main><p>Ready?</p><button type="button">Save draft</button></main>`);
    const after = page(`<main><p>Ready?</p><span>Save draft</span></main>`);
    const r = verdict(before, after);
    expect(r.ok).toBe(false);
    expect(r.reasons.join(" ")).toMatch(/a focusable control disappeared \(1 → 0\)/);
    expect(r.reasons.join(" ")).not.toMatch(/visible text was removed/);
  });

  it("removing visible text content → rejected, with a text-removed reason", () => {
    const before = page(`<main><h1>Pricing</h1><p>The starter plan is free for personal projects and small teams getting started.</p><p>Enterprise pricing is available on request from our sales team.</p></main>`);
    const after = page(`<main><h1>Pricing</h1></main>`);
    const r = verdict(before, after);
    expect(r.ok).toBe(false);
    expect(r.reasons.join(" ")).toMatch(/visible text was removed \(\d+ tokens lost\)/);
  });

  it('emptying an informative image to alt="" (informative→decorative laundering) → rejected', () => {
    // The caption ("Figure 1") is not a text alternative, so alt="" strips the only description.
    const before = page(`<main><figure><img src="c.png" alt="Emissions fell 40% from 2020 to 2024"><figcaption>Figure 1</figcaption></figure></main>`);
    const after = page(`<main><figure><img src="c.png" alt=""><figcaption>Figure 1</figcaption></figure></main>`);
    const r = verdict(before, after);
    expect(r.ok).toBe(false);
    expect(r.reasons.join(" ")).toMatch(/emptied to alt="" to satisfy a checker/);
  });
});

describe("regression guard ACCEPTS legitimate fixes (proves it discriminates)", () => {
  it("adding an aria-label to an icon-only button → accepted", () => {
    const before = page(`<main><button type="button" class="icon">&#9654;</button></main>`);
    const after = page(`<main><button type="button" class="icon" aria-label="Play track">&#9654;</button></main>`);
    expect(verdict(before, after)).toEqual({ ok: true, reasons: [] });
  });

  it("replacing generic alt with grounded descriptive alt → accepted", () => {
    const before = page(`<main><img src="h.jpg" alt="image"><p>Studio work.</p></main>`);
    const after = page(`<main><img src="h.jpg" alt="Stacked product packaging in warm light"><p>Studio work.</p></main>`);
    expect(verdict(before, after)).toEqual({ ok: true, reasons: [] });
  });

  it("upgrading div[role=button][tabindex=0] to a real <button> → accepted (the agent's actual fix)", () => {
    const before = page(`<main><div role="button" tabindex="0" aria-label="Save recipe">&#9825;</div></main>`);
    const after = page(`<main><button type="button" aria-label="Save recipe">&#9825;</button></main>`);
    expect(verdict(before, after)).toEqual({ ok: true, reasons: [] });
  });

  it('setting alt="" when a DESCRIPTIVE figcaption already carries the alternative → accepted', () => {
    // The legitimate mirror image of the rejected laundering case above: the caption IS the text
    // alternative, so empty alt avoids duplicate announcement. The guard must tell these apart.
    const before = page(`<main><figure><img src="p.jpg" alt="photo"><figcaption>Harvest Table identity system</figcaption></figure></main>`);
    const after = page(`<main><figure><img src="p.jpg" alt=""><figcaption>Harvest Table identity system</figcaption></figure></main>`);
    expect(verdict(before, after)).toEqual({ ok: true, reasons: [] });
  });
});

describe("regression guard: KNOWN LIMITATIONS (characterized, not endorsed)", () => {
  /**
   * These two assert CURRENT behaviour so the gap is visible and locked: the guard's snapshots are
   * DOM-shape only (cheerio, no layout/ARIA resolution), so visibility-based laundering slips past
   * THIS gate. Documented deliberately — if we later teach the guard about hiding, these tests
   * fail loudly and must be updated, which is exactly the signal we want.
   */
  it("display:none on an informative element is NOT caught by this gate (DOM-shape only)", () => {
    const before = page(`<main><p>Important notice about your order.</p><img src="a.jpg" alt="Order diagram"></main>`);
    const after = page(`<main><p style="display:none">Important notice about your order.</p><img src="a.jpg" alt="Order diagram" style="display:none"></main>`);
    const r = verdict(before, after);
    expect(r.ok).toBe(true); // gap: cheerio text() and img count are unchanged by CSS hiding
  });

  it('aria-hidden="true" on a focusable control is NOT caught by this gate', () => {
    const before = page(`<main><button type="button" aria-label="Play">&#9654;</button></main>`);
    const after = page(`<main><button type="button" aria-label="Play" aria-hidden="true">&#9654;</button></main>`);
    const r = verdict(before, after);
    expect(r.ok).toBe(true); // gap: the focusable selector does not resolve ARIA visibility
  });
});
