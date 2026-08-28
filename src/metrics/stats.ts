/**
 * Statistics helpers for honest reporting (per docs/BRAINSTORM.md §5):
 * Cohen's κ for judge calibration, McNemar's test for paired baseline-vs-advanced
 * significance, and Wilson score confidence intervals for small-n rates.
 */

export interface WilsonInterval {
  point: number;
  low: number;
  high: number;
}

/** TODO(step-later): Wilson score interval for a proportion. */
export function wilsonInterval(_successes: number, _total: number, _z = 1.96): WilsonInterval {
  throw new Error("TODO: Wilson interval not implemented yet");
}

/** TODO(step-later): Cohen's kappa for two raters over categorical labels. */
export function cohensKappa(_raterA: string[], _raterB: string[]): number {
  throw new Error("TODO: Cohen's kappa not implemented yet");
}

export interface McNemarResult {
  statistic: number;
  pValue: number;
  b: number;
  c: number;
}

/**
 * McNemar's test on a paired 2x2 table. b = baseline-only successes,
 * c = advanced-only successes.
 * TODO(step-later): implement with continuity correction.
 */
export function mcNemar(_b: number, _c: number): McNemarResult {
  throw new Error("TODO: McNemar's test not implemented yet");
}
