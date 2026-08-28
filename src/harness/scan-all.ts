import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Browser } from "playwright";
import type { Finding } from "../types.js";
import { runLayerA } from "../layers/layerA-scanners.js";
import { runLayerB } from "../layers/layerB-sr.js";
import { runLayerC, gateModeForKappa, type GateMode } from "../layers/layerC-judge.js";

/**
 * Scan-all harness: run the full A/B/C stack over one HTML document and return
 * each layer's findings. This is what scores an agent's output — the same harness
 * for baseline and advanced — and what captures "scanner-clean but still broken"
 * (A empty while B or C still flag).
 */

export interface LayerScan {
  A: Finding[];
  B: Finding[];
  C: Finding[];
}

/** Read the calibrated gate mode from the published kappa (backstops-only if absent). */
export function calibratedGateMode(): GateMode {
  const path = join(process.cwd(), "corpus", "anchor-set", "kappa.json");
  if (!existsSync(path)) return "backstops-only";
  try {
    const k = JSON.parse(readFileSync(path, "utf8")) as { kappaCategory?: number };
    return typeof k.kappaCategory === "number" ? gateModeForKappa(k.kappaCategory) : "backstops-only";
  } catch {
    return "backstops-only";
  }
}

export interface ScanOptions {
  browser?: Browser;
  /** Run the LLM judge in Layer C (needs cassettes for the content). Default false. */
  useJudge?: boolean;
}

export async function scanAll(html: string, opts: ScanOptions = {}): Promise<LayerScan> {
  const [A, B] = await Promise.all([
    runLayerA({ html }, { browser: opts.browser }),
    runLayerB({ html }, { browser: opts.browser }),
  ]);
  const C = await runLayerC(html, {
    useJudge: opts.useJudge ?? false,
    gateMode: calibratedGateMode(),
  });
  return { A, B, C };
}

export interface PageOutcome {
  changed: boolean;
  axeCleanAfter: boolean;
  behaviorBrokenAfter: boolean;
  semanticBrokenAfter: boolean;
  /** Scanner-clean but a real user still can't use it (B or C still flag). */
  falseFix: boolean;
  counts: { before: { a: number; b: number; c: number }; after: { a: number; b: number; c: number } };
}

/** Classify an agent's effect on one page from before/after scans. */
export function classifyOutcome(
  originalHtml: string,
  fixedHtml: string,
  before: LayerScan,
  after: LayerScan,
): PageOutcome {
  const axeCleanAfter = after.A.length === 0;
  const behaviorBrokenAfter = after.B.length > 0;
  const semanticBrokenAfter = after.C.length > 0;
  return {
    changed: originalHtml.trim() !== fixedHtml.trim(),
    axeCleanAfter,
    behaviorBrokenAfter,
    semanticBrokenAfter,
    falseFix: axeCleanAfter && (behaviorBrokenAfter || semanticBrokenAfter),
    counts: {
      before: { a: before.A.length, b: before.B.length, c: before.C.length },
      after: { a: after.A.length, b: after.B.length, c: after.C.length },
    },
  };
}
