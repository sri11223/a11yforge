import type { MetricSummary } from "../metrics/score.js";

/**
 * HTML report generator — renders the baseline-vs-advanced comparison, the gap%
 * finding, and the metric suite into a shareable page.
 *
 * TODO(step-later): render metrics + per-page breakdown to standalone HTML.
 */
export function renderHtmlReport(_baseline: MetricSummary, _advanced: MetricSummary): string {
  throw new Error("TODO: HTML report renderer not implemented yet");
}
