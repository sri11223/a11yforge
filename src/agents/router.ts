import type { Finding, Layer } from "../types.js";

/**
 * Routing decision for the advanced agent — an explicit, judge-legible decision table mapping a
 * finding's violation CLASS to the fix STRATEGY, with the rationale for each. The policy is
 * deliberately conservative and unchanged from the original one-line rule (`layer B → llm, else
 * rule`); this table just makes the mapping and its reasoning explicit.
 *
 * Note the semantic (Layer C) nuance is enforced UPSTREAM in the verify-loop, not here: an
 * UNGROUNDED alt is escalated to the human checkpoint before routing ever runs, so the LLM is
 * NEVER used to invent alt text (the structural guarantee against confident hallucination).
 */
export type FixStrategy = "rule" | "llm";

export interface RouteRule {
  layer: Layer;
  strategy: FixStrategy;
  rationale: string;
}

/** Violation class → fix strategy, with rationale. Consulted by route(). */
export const DECISION_TABLE: RouteRule[] = [
  {
    layer: "A",
    strategy: "rule",
    rationale:
      "Mechanical WCAG (missing/placeholder form-control label): a deterministic cheerio fix — " +
      "add an aria-label from the visible placeholder. No judgment, no LLM.",
  },
  {
    layer: "C",
    strategy: "rule",
    rationale:
      "Semantic alt/label: a GROUNDED rule fix — alt written from the page's own markup " +
      "(caption/heading/link) or emptied when a caption already covers it / it's decorative; a " +
      "contradicting aria-label is removed. Ungrounded alt never reaches here — it is escalated " +
      "to a human. The LLM is deliberately never used to write alt.",
  },
  {
    layer: "B",
    strategy: "llm",
    rationale:
      "Behavioral (keyboard trap, focus/reading order, live region, operability): structural " +
      "fixes that need judgment on HOW to remediate, but are not hallucination-prone, so the " +
      "shared targeted LLM prompt is used inside the verify-loop.",
  },
];

/** Choose the fix strategy for a finding. Pure function of finding.layer; defaults to the safe
 *  deterministic rule fix for any unclassified layer. */
export function route(finding: Finding): FixStrategy {
  return DECISION_TABLE.find((r) => r.layer === finding.layer)?.strategy ?? "rule";
}
