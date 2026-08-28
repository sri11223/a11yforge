import type { FixResult } from "../types.js";

/**
 * Improvement changelog generator — turns per-page fix results into the
 * human-readable "what changed and why" deliverable.
 *
 * TODO(step-later): render markdown changelog from FixResult[] across the corpus.
 */
export function renderChangelog(_fixes: FixResult[]): string {
  throw new Error("TODO: changelog renderer not implemented yet");
}
