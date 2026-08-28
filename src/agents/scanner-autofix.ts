import * as cheerio from "cheerio";
import type { Finding } from "../types.js";

/**
 * Scanner-only auto-fix — the "pure determinism" reference row. No LLM: it applies
 * naive mechanical remediations for Layer-A (scanner) findings only, the way an
 * automated-remediation tool would. It cannot touch anything the scanner didn't
 * report, so on a corpus where the scanner is nearly blind it fixes almost nothing
 * — which is exactly the point of including it. See docs/BRAINSTORM.md §6.
 */
export function runScannerAutofix(html: string, scannerFindings: Finding[]): string {
  const $ = cheerio.load(html);

  for (const f of scannerFindings) {
    if (!f.selector) continue;
    try {
      $(f.selector).each((_i, el) => {
        const $el = $(el);
        const tag = (el as { tagName?: string }).tagName?.toLowerCase();

        // Missing form-control label: add aria-label from the placeholder (naive).
        if (
          (f.wcag === "1.3.1" || f.wcag === "4.1.2") &&
          (tag === "input" || tag === "select" || tag === "textarea")
        ) {
          if (!$el.attr("aria-label") && !$el.attr("aria-labelledby")) {
            const ph = ($el.attr("placeholder") ?? "").trim();
            $el.attr("aria-label", ph || "Input field");
          }
        }

        // Image missing an alt attribute: add empty alt (the classic scanner-silencing move).
        if (f.wcag === "1.1.1" && tag === "img" && $el.attr("alt") === undefined) {
          $el.attr("alt", "");
        }
      });
    } catch {
      // Selector not resolvable by cheerio — a scanner-only tool would skip it too.
    }
  }

  return $.html();
}
