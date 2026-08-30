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
 * SCOPE, STATED HONESTLY: the guard compares deterministic cheerio DOM-shape snapshots — visible
 * text tokens, focusable count, image count, informative-figure alt emptying, and (since the
 * hardening pass) inline display:none / visibility:hidden, the `hidden` attribute, and aria-hidden
 * classified risky-vs-decorative. It reads markup, not computed style, so a hiding cheat expressed
 * through an external stylesheet class rather than these markup signals would still pass this gate.
 * The remaining alt residual is also named: a bare, generically-named <img> outside a <figure>
 * emptied to alt="" is caught by neither this gate nor the Layer C backstop.
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

describe("regression guard REJECTS hiding-to-pass (the gap that used to be characterized here)", () => {
  /**
   * These two started life asserting the OPPOSITE — they documented a real blind spot, deliberately
   * written to fail loudly if the guard was ever hardened. It has been, so they now assert the
   * rejection instead. Hiding is the cheat that would otherwise slip through the entire stack,
   * because Layer B's visibility filter drops hidden elements, making a hidden violation "resolve".
   */
  it("display:none on previously-visible informative content → rejected", () => {
    const before = page(`<main><p>Important notice about your order.</p><img src="a.jpg" alt="Order diagram"></main>`);
    const after = page(`<main><p style="display:none">Important notice about your order.</p><img src="a.jpg" alt="Order diagram" style="display:none"></main>`);
    const r = verdict(before, after);
    expect(r.ok).toBe(false);
    expect(r.reasons.join(" ")).toMatch(/hidden with inline display:none \/ visibility:hidden \(0 → 2\)/);
  });

  it("visibility:hidden on previously-visible content → rejected", () => {
    const before = page(`<main><p>Delivery is delayed by two days.</p></main>`);
    const after = page(`<main><p style="visibility: hidden">Delivery is delayed by two days.</p></main>`);
    const r = verdict(before, after);
    expect(r.ok).toBe(false);
    expect(r.reasons.join(" ")).toMatch(/hidden with inline display:none \/ visibility:hidden/);
  });

  it("the hidden attribute on previously-visible content → rejected", () => {
    const before = page(`<main><p>Your card was declined.</p></main>`);
    const after = page(`<main><p hidden>Your card was declined.</p></main>`);
    const r = verdict(before, after);
    expect(r.ok).toBe(false);
    expect(r.reasons.join(" ")).toMatch(/hidden with the hidden attribute \(0 → 1\)/);
  });

  it('aria-hidden="true" on a focusable control → rejected', () => {
    const before = page(`<main><button type="button" aria-label="Play">&#9654;</button></main>`);
    const after = page(`<main><button type="button" aria-label="Play" aria-hidden="true">&#9654;</button></main>`);
    const r = verdict(before, after);
    expect(r.ok).toBe(false);
    expect(r.reasons.join(" ")).toMatch(/aria-hidden="true" was put on something a user needs/);
  });

  it('aria-hidden="true" on a wrapper containing a control or text → rejected', () => {
    const before = page(`<main><div><p>Checkout total: $42</p><button type="button">Pay now</button></div></main>`);
    const after = page(`<main><div aria-hidden="true"><p>Checkout total: $42</p><button type="button">Pay now</button></div></main>`);
    const r = verdict(before, after);
    expect(r.ok).toBe(false);
    expect(r.reasons.join(" ")).toMatch(/aria-hidden="true" was put on something a user needs/);
  });

  it('aria-hidden="true" on a DECORATIVE glyph → still ACCEPTED (this is correct practice)', () => {
    // Our own fixer emits exactly this: hide the text-free, non-focusable glyph inside an
    // already-labelled control so a screen reader does not announce it twice. A guard that
    // rejected this would break real fixes — 7 committed cassettes do it.
    const before = page(`<main><button type="button" aria-label="Play track"><span>&#9654;</span></button></main>`);
    const after = page(`<main><button type="button" aria-label="Play track"><span aria-hidden="true">&#9654;</span></button></main>`);
    expect(verdict(before, after)).toEqual({ ok: true, reasons: [] });
  });
});
