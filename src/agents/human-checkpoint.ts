import * as cheerio from "cheerio";
import type { Finding } from "../types.js";

/**
 * Human checkpoint — the integrity boundary. For alt/label text the agent CANNOT
 * ground in available markup (a real figcaption, surrounding copy, aria-*), it must
 * NOT emit a confident description — that would be hallucination, the exact failure
 * every automated layer (axe, backstops, even the LLM judge) waves through. Instead
 * it marks the item needs-review. Where grounding EXISTS, the fix is written from it
 * and the judge verifies. This is the line between a grounded fix and a guess.
 */

export interface Grounding {
  grounded: boolean;
  /** Where the grounding came from (figcaption, aria-labelledby, link-text, adjacent-copy). */
  source?: string;
  /** The grounding text a fix may be derived from. */
  text?: string;
}

function descriptive(s: string): boolean {
  const t = s.trim();
  // Needs real words, and not a bare "Figure 1" / "Image" style caption.
  if (!/[a-z]/i.test(t)) return false;
  const words = t.split(/\s+/).filter((w) => /[a-z]/i.test(w));
  if (words.length < 2) return false;
  if (/^(figure|fig|image|photo|picture|img)\s*\.?\s*\d*$/i.test(t)) return false;
  return true;
}

/**
 * Look for text that legitimately grounds an image's alt: a descriptive figcaption,
 * an aria-labelledby target, the text of a wrapping link, or a nearby heading.
 */
export function findAltGrounding(html: string, imgSelector: string): Grounding {
  const $ = cheerio.load(html);
  const el = $(imgSelector).first();
  if (el.length === 0) return { grounded: false };

  const labelledby = el.attr("aria-labelledby");
  if (labelledby) {
    const txt = labelledby
      .split(/\s+/)
      .map((id) => $(`#${id}`).text().trim())
      .join(" ")
      .trim();
    if (descriptive(txt)) return { grounded: true, source: "aria-labelledby", text: txt };
  }

  const fig = el.closest("figure");
  if (fig.length) {
    const cap = fig.find("figcaption").first().text().trim();
    if (descriptive(cap)) return { grounded: true, source: "figcaption", text: cap };
  }

  const link = el.closest("a");
  if (link.length) {
    const lt = link.text().trim();
    if (descriptive(lt)) return { grounded: true, source: "link-text", text: lt };
  }

  return { grounded: false };
}

export interface ReviewItem {
  pageId?: string;
  finding: Finding;
  selector: string;
  reason: string;
}

const queue: ReviewItem[] = [];

/** Record an item that needs human review instead of an auto-emitted guess. */
export function queueForReview(item: ReviewItem): void {
  queue.push(item);
}

export function drainReviewQueue(): ReviewItem[] {
  return queue.splice(0, queue.length);
}
