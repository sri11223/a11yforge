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
}

const FOCUSABLE = "a[href],button,input,select,textarea,[tabindex]";
const INTERACTIVE = "a[href],button,input,select,textarea,[role=button],[role=link],[onclick]";

export function snapshot(html: string): DomSnapshot {
  const $ = cheerio.load(html);
  $("script,style,noscript").remove();
  const text = $("body").text().replace(/\s+/g, " ").trim();
  const textTokens = text ? text.split(" ").filter((t) => /[a-z0-9]/i.test(t)) : [];
  let emptyAltInFigure = 0;
  $("img").each((_i, el) => {
    const alt = $(el).attr("alt");
    if ((alt ?? "").trim() === "" && $(el).closest("figure").length > 0) emptyAltInFigure++;
  });
  return {
    textTokens,
    focusable: $(FOCUSABLE).length,
    images: $("img").length,
    interactive: $(INTERACTIVE).length,
    emptyAltInFigure,
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
  return { ok: reasons.length === 0, reasons };
}
