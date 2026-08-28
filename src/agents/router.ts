import type { Finding } from "../types.js";

/**
 * Routing decision for the advanced agent: mechanical violations get a
 * deterministic rule-based fix; semantic ones go to the LLM fixer. Behavioral
 * findings route by their concrete remedy (often rule-based structural edits).
 *
 * TODO(step-later): map Finding.type/source to the concrete fix strategy.
 */
export type FixStrategy = "rule" | "llm";

export function route(_finding: Finding): FixStrategy {
  throw new Error("TODO: router not implemented yet");
}
