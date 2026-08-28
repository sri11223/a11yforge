import type { Finding } from "../types.js";

/**
 * Routing decision for the advanced agent:
 *  - Layer A (mechanical) → deterministic rule fix (cheerio).
 *  - Layer C (semantic) → deterministic rule fix: grounded alt is written from the
 *    page's own markup (or emptied when a caption already covers it), decorative alt is
 *    emptied, a contradicting aria-label is removed. Ungrounded alt is NOT fixed here —
 *    it escalates to the human checkpoint. The LLM is deliberately NEVER used to invent
 *    alt text, which structurally prevents the confident-hallucination failure mode.
 *  - Layer B (behavioral) → LLM fix (shared targeted prompt), because how to fix a
 *    keyboard trap / focus order / live region / operability needs judgment, and these
 *    are structural (not hallucination-prone).
 */
export type FixStrategy = "rule" | "llm";

export function route(finding: Finding): FixStrategy {
  return finding.layer === "B" ? "llm" : "rule";
}
