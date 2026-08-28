import type { AgentSummary } from "../metrics/score.js";

/**
 * HTML report generator — renders the baseline-vs-advanced comparison and the metric
 * suite into a shareable page.
 *
 * TODO(step-later): render metrics + per-page breakdown to standalone HTML.
 */
export function renderHtmlReport(_baseline: AgentSummary, _advanced: AgentSummary): string {
  throw new Error("TODO: HTML report renderer not implemented yet");
}
