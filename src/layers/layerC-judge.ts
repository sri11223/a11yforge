import type { Finding, Verdict } from "../types.js";

/**
 * Layer C — semantic, calibrated LLM judge. Evaluates ONLY meaningfulness of
 * alt/labels (never mechanical or behavioral). κ-gated per docs/BRAINSTORM.md §3:
 * ≥0.6 hard gate / 0.4–0.6 advisory / <0.4 deterministic-backstops-only. The
 * judge uses a DIFFERENT model family than the fixer.
 */

export interface JudgeCandidate {
  selector: string;
  /** e.g. the alt/label text under evaluation. */
  text: string;
  /** surrounding visible text / context for the judge. */
  context?: string;
  /** whether ground truth marks the element informative. */
  informative: boolean | null;
}

/**
 * Deterministic semantic backstops — pure string/regex rules that keep gap% and
 * false-fix rate alive even when the LLM judge is weak (κ<0.4).
 *
 * TODO(step-later): implement wordlist + filename regex + informative-emptied + redundant-alt checks.
 */
export function deterministicBackstop(_candidate: JudgeCandidate): Finding | null {
  throw new Error("TODO: Layer C deterministic backstop not implemented yet");
}

/**
 * Ask the calibrated LLM judge whether a single alt/label is meaningful.
 *
 * TODO(step-later): prompt + zod-validated Verdict via judge model.
 */
export async function judge(_candidate: JudgeCandidate): Promise<Verdict> {
  throw new Error("TODO: Layer C judge not implemented yet");
}
