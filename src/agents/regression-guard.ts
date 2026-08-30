import * as cheerio from "cheerio";

/**
 * Regression guard — a PRE-COMMIT gate in the verify-loop. Compares a before/after
 * snapshot and rejects a candidate fix that "cheats" by deleting, hiding, or emptying
 * content to satisfy a checker: reduced visible text, fewer focusable controls, fewer
 * images, or an informative image whose alt was emptied. See docs/BRAINSTORM.md §1.
 *
 * Snapshots are computed with cheerio (deterministic, offline) rather than a live
 * accessibility tree, so the guard is cheap enough to run on every candidate.
 */

export interface DomSnapshot {
  textTokens: string[];
  focusable: number;
  images: number;
  interactive: number;
  emptyAltInFigure: number;
  /** elements hidden via inline style (display:none / visibility:hidden) */
  inlineHidden: number;
  /** elements carrying the boolean `hidden` attribute */
  hiddenAttr: number;
  /** aria-hidden="true" on something a user needs — see isRiskyAriaHidden */
  ariaHiddenRisky: number;
  /** aria-hidden="true" on a text-free, non-focusable decorative element (legitimate) */
  ariaHiddenDecorative: number;
}

const FOCUSABLE = "a[href],button,input,select,textarea,[tabindex]";
const INTERACTIVE = "a[href],button,input,select,textarea,[role=button],[role=link],[onclick]";

/**
 * Is this `aria-hidden="true"` hiding something the user needs?
 *
 * RISKY: the element is focusable, contains a focusable descendant, or carries text — hiding any of
 * those from assistive tech removes something real.
 * LEGITIMATE: a text-free, non-focusable decorative node — e.g. `<span aria-hidden="true">▶</span>`
 * inside an already-labelled button, which stops the glyph being announced twice. That is the
 * recommended pattern, and our own fixer emits it, so the guard must NOT reject it.
 *
 * Exported so the corpus-wide hiding audit (test/no-hidden-content.test.ts) uses this exact
 * definition: the gate and the measurement can then never disagree about what "risky" means.
 */
export function isRiskyAriaHidden($: cheerio.CheerioAPI, el: Parameters<cheerio.CheerioAPI>[0]): boolean {
  const $el = $(el);
  const words = ($el.text() ?? "").trim().split(/\s+/).filter((w) => /[a-z0-9]/i.test(w)).length;
  return $el.is(FOCUSABLE) || $el.find(FOCUSABLE).length > 0 || words > 0;
}

export function snapshot(html: string): DomSnapshot {
  const $ = cheerio.load(html);
  $("script,style,noscript").remove();
  const text = $("body").text().replace(/\s+/g, " ").trim();
  const textTokens = text ? text.split(" ").filter((t) => /[a-z0-9]/i.test(t)) : [];
  let emptyAltInFigure = 0;
  $("img").each((_i, el) => {
    const alt = $(el).attr("alt");
    const fig = $(el).closest("figure");
    if ((alt ?? "").trim() === "" && fig.length > 0) {
      // Empty alt is legitimate when a descriptive <figcaption> is the text alternative.
      const cap = fig.find("figcaption").first().text().trim();
      const capWords = cap.split(/\s+/).filter((w) => /[a-z]/i.test(w));
      const capDescriptive =
        capWords.length >= 2 && !/^(figure|fig|image|photo|picture|img)\s*\.?\s*\d*$/i.test(cap);
      if (!capDescriptive) emptyAltInFigure++;
    }
  });
  const inlineHidden = $("[style]").filter((_i, el) =>
    /display\s*:\s*none|visibility\s*:\s*hidden/i.test($(el).attr("style") ?? ""),
  ).length;
  let ariaHiddenRisky = 0;
  let ariaHiddenDecorative = 0;
  $('[aria-hidden="true"]').each((_i, el) => {
    if (isRiskyAriaHidden($, el)) ariaHiddenRisky++;
    else ariaHiddenDecorative++;
  });

  return {
    textTokens,
    focusable: $(FOCUSABLE).length,
    images: $("img").length,
    interactive: $(INTERACTIVE).length,
    emptyAltInFigure,
    inlineHidden,
    hiddenAttr: $("[hidden]").length,
    ariaHiddenRisky,
    ariaHiddenDecorative,
  };
}

export interface RegressionResult {
  ok: boolean;
  reasons: string[];
}

/** Multiset difference: tokens present in `before` that are missing from `after`. */
function lostTokens(before: string[], after: string[]): number {
  const counts = new Map<string, number>();
  for (const t of after) counts.set(t, (counts.get(t) ?? 0) + 1);
  let lost = 0;
  for (const t of before) {
    const c = counts.get(t) ?? 0;
    if (c > 0) counts.set(t, c - 1);
    else lost++;
  }
  return lost;
}

export function checkRegression(before: DomSnapshot, after: DomSnapshot): RegressionResult {
  const reasons: string[] = [];
  const lost = lostTokens(before.textTokens, after.textTokens);
  // Allow small wording changes but reject wholesale content loss.
  if (lost > Math.max(3, Math.ceil(before.textTokens.length * 0.15))) {
    reasons.push(`visible text was removed (${lost} tokens lost) — content must be preserved`);
  }
  if (after.focusable < before.focusable) {
    reasons.push(`a focusable control disappeared (${before.focusable} → ${after.focusable})`);
  }
  if (after.images < before.images) {
    reasons.push(`an image was removed (${before.images} → ${after.images})`);
  }
  if (after.emptyAltInFigure > before.emptyAltInFigure) {
    reasons.push(`an informative image (in a <figure>) was emptied to alt="" to satisfy a checker`);
  }
  // Hiding-to-pass: the cheat that would otherwise slip through the whole stack, because Layer B's
  // visibility filter drops hidden elements, so a hidden violation "resolves". Decorative
  // aria-hidden (a text-free, non-focusable glyph inside a labelled control) is deliberately NOT
  // counted — that is the recommended pattern and our own fixer emits it.
  if (after.inlineHidden > before.inlineHidden) {
    reasons.push(`content was hidden with inline display:none / visibility:hidden (${before.inlineHidden} → ${after.inlineHidden}) — hiding is not fixing`);
  }
  if (after.hiddenAttr > before.hiddenAttr) {
    reasons.push(`content was hidden with the hidden attribute (${before.hiddenAttr} → ${after.hiddenAttr}) — hiding is not fixing`);
  }
  if (after.ariaHiddenRisky > before.ariaHiddenRisky) {
    reasons.push(`aria-hidden="true" was put on something a user needs — focusable, containing a control, or carrying text (${before.ariaHiddenRisky} → ${after.ariaHiddenRisky})`);
  }
  return { ok: reasons.length === 0, reasons };
}
