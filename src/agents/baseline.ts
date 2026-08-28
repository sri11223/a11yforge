import type { Finding, FixResult } from "../types.js";

/**
 * Baseline agent — a FAIR single-shot fixer. Receives the page HTML plus the
 * SAME Layer-A violation list the advanced agent starts from, makes ONE LLM call
 * ("fix this HTML given these violations"), applies the output, and stops. No
 * routing, no verify-loop, no regression guard, no checkpoint. Same model/seed/
 * budget as the advanced fixer — the comparison isolates the pipeline, not the
 * model. See docs/BRAINSTORM.md §6.
 */

export interface AgentRun {
  html: string;
  fixes: FixResult[];
}

/**
 * TODO(step-later): single fixer call + apply, no verification.
 */
export async function runBaseline(_html: string, _findings: Finding[]): Promise<AgentRun> {
  throw new Error("TODO: baseline agent not implemented yet");
}
