import type { Finding, Manifest } from "../types.js";

/**
 * Metric suite (per docs/BRAINSTORM.md §5): gap%, true-fix rate, regression rate,
 * false-fix rate — computed per-issue and per-page against ground truth.
 */

export interface MetricSummary {
  n: number;
  gapPct: number;
  trueFixRate: number;
  regressionRate: number;
  falseFixRate: number;
}

export interface LayerVerdicts {
  layerA: Finding[];
  layerB: Finding[];
  layerC: Finding[];
}

/**
 * TODO(step-later): compute gap% = A-clean ∧ (B-fail ∨ C-fail) / A-clean, etc.
 */
export function scorePage(_before: LayerVerdicts, _after: LayerVerdicts, _manifest: Manifest): MetricSummary {
  throw new Error("TODO: metric scoring not implemented yet");
}
