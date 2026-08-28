import type { Finding } from "../types.js";

/**
 * Routing decision for the advanced agent:
 *  - Layer A (mechanical) findings → deterministic rule fix (cheerio), no LLM.
 *  - Layer B (behavioral) and Layer C (semantic) findings → LLM fix (shared prompt),
 *    because how to fix a keyboard trap / focus order / meaningful alt requires judgment.
 * Semantic alt/label fixes are additionally gated by grounding (see human-checkpoint).
 */
export type FixStrategy = "rule" | "llm";

export function route(finding: Finding): FixStrategy {
  return finding.layer === "A" ? "rule" : "llm";
}
