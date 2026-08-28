import type { Finding, Manifest } from "../types.js";
import type { AgentRun } from "./baseline.js";

/**
 * Advanced agent — context → route (rule vs LLM) → verify-loop [A,B,C] →
 * regression guard (pre-commit gate) → human checkpoint for ambiguous alt.
 * Per-violation fix with a whole-page regression sweep after each applied fix;
 * bounded reflexion (max 3) with structured verifier feedback. See
 * docs/BRAINSTORM.md §1.
 */

export const MAX_REFLEXION_ATTEMPTS = 3;

/**
 * TODO(step-later): implement route → fix → verify[A,B,C] → regression guard →
 * checkpoint loop with reflexion retries.
 */
export async function runAdvanced(
  _html: string,
  _findings: Finding[],
  _manifest?: Manifest,
): Promise<AgentRun> {
  throw new Error("TODO: advanced agent not implemented yet");
}
