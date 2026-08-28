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

/** Wilson score interval for a proportion (better than normal approx for small n). */
export function wilsonInterval(successes: number, total: number, z = 1.96): WilsonInterval {
  if (total === 0) return { point: 0, low: 0, high: 0 };
  const p = successes / total;
  const z2 = z * z;
  const denom = 1 + z2 / total;
  const centre = p + z2 / (2 * total);
  const margin = z * Math.sqrt((p * (1 - p)) / total + z2 / (4 * total * total));
  return {
    point: p,
    low: Math.max(0, (centre - margin) / denom),
    high: Math.min(1, (centre + margin) / denom),
  };
}

/**
 * Cohen's kappa for two raters over categorical labels. Returns agreement
 * corrected for chance: 1 = perfect, 0 = chance-level, <0 = worse than chance.
 */
export function cohensKappa(raterA: string[], raterB: string[]): number {
  if (raterA.length !== raterB.length) {
    throw new Error("cohensKappa: rater arrays must be the same length");
  }
  const n = raterA.length;
  if (n === 0) return 0;

  const categories = [...new Set([...raterA, ...raterB])];
  const countA = new Map<string, number>();
  const countB = new Map<string, number>();
  let agree = 0;
  for (let i = 0; i < n; i++) {
    if (raterA[i] === raterB[i]) agree++;
    countA.set(raterA[i]!, (countA.get(raterA[i]!) ?? 0) + 1);
    countB.set(raterB[i]!, (countB.get(raterB[i]!) ?? 0) + 1);
  }
  const po = agree / n;
  let pe = 0;
  for (const c of categories) {
    pe += ((countA.get(c) ?? 0) / n) * ((countB.get(c) ?? 0) / n);
  }
  if (pe === 1) return 1; // both raters constant and identical
  return (po - pe) / (1 - pe);
}

export interface McNemarResult {
  statistic: number;
  pValue: number;
  b: number;
  c: number;
}

/**
 * McNemar's test on a paired 2x2 table (with continuity correction).
 * b = baseline-only successes, c = advanced-only successes.
 */
export function mcNemar(b: number, c: number): McNemarResult {
  const n = b + c;
  if (n === 0) return { statistic: 0, pValue: 1, b, c };
  const statistic = Math.pow(Math.abs(b - c) - 1, 2) / n;
  // Survival function of chi-square with 1 df = erfc(sqrt(x/2)).
  const pValue = erfc(Math.sqrt(statistic / 2));
  return { statistic, pValue, b, c };
}

/** Complementary error function (Abramowitz & Stegun 7.1.26 approximation). */
function erfc(x: number): number {
  const z = Math.abs(x);
  const t = 1 / (1 + 0.5 * z);
  const tau =
    t *
    Math.exp(
      -z * z -
        1.26551223 +
        t *
          (1.00002368 +
            t *
              (0.37409196 +
                t *
                  (0.09678418 +
                    t *
                      (-0.18628806 +
                        t *
                          (0.27886807 +
                            t *
                              (-1.13520398 +
                                t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))),
    );
  return x >= 0 ? tau : 2 - tau;
}
