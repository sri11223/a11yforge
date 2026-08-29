#!/usr/bin/env node
import { chromium, type Browser } from "playwright";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Finding } from "../types.js";
import { runLayerA } from "../layers/layerA-scanners.js";
import { runLayerB } from "../layers/layerB-sr.js";
import { runLayerC } from "../layers/layerC-judge.js";
import { calibratedGateMode } from "../harness/scan-all.js";

/**
 * `a11yforge audit <url|path>` — point it at ANY page and it reports the gap between
 * "scanner-clean" and "usable": what a screen-reader / keyboard user actually hits that
 * an automated scanner (Layer A) misses. Layers A + B are deterministic and run offline;
 * Layer C's LLM judge is optional — it engages only when OPENROUTER_API_KEY is set (and
 * gracefully falls back to the deterministic backstops otherwise), so `audit` is useful
 * with no key and richer with one.
 */

export interface AuditReport {
  target: string;
  scannerClean: boolean;
  gap: boolean;
  layerA: Finding[];
  layerB: Finding[];
  layerC: Finding[];
  summary: { mechanical: number; behavioral: number; semantic: number; hiddenFromScanner: number };
}

async function resolveHtml(target: string, browser: Browser): Promise<string> {
  if (/^https?:\/\//i.test(target)) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(target, { waitUntil: "load" });
    const html = await page.content();
    await ctx.close();
    return html;
  }
  const path = resolve(target);
  if (!existsSync(path)) throw new Error(`Not a URL and not a file: ${target}`);
  return readFileSync(path, "utf8");
}

export interface AuditOptions {
  browser?: Browser;
  /** Force the LLM judge off even if a key is present. */
  noJudge?: boolean;
  /** Provide HTML directly (used by tests); skips URL/file resolution. */
  html?: string;
}

export async function audit(target: string, opts: AuditOptions = {}): Promise<AuditReport> {
  const browser = opts.browser ?? (await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] }));
  const useJudge = !opts.noJudge && !!process.env.OPENROUTER_API_KEY && !!process.env.JUDGE_MODEL;
  if (useJudge) process.env.A11YFORGE_MODE ??= "live"; // live pages have no cassettes
  try {
    const html = opts.html ?? (await resolveHtml(target, browser));
    const [layerA, layerB] = await Promise.all([
      runLayerA({ html }, { browser }),
      runLayerB({ html }, { browser }),
    ]);
    const layerC = await runLayerC(html, { useJudge, gateMode: calibratedGateMode() });
    return {
      target,
      scannerClean: layerA.length === 0,
      gap: layerA.length === 0 && layerB.length + layerC.length > 0,
      layerA,
      layerB,
      layerC,
      summary: {
        mechanical: layerA.length,
        behavioral: layerB.length,
        semantic: layerC.length,
        hiddenFromScanner: layerB.length + layerC.length,
      },
    };
  } finally {
    if (!opts.browser) await browser.close();
  }
}

function printReport(r: AuditReport): void {
  const line = (f: Finding) => `    · [${f.wcag ?? "?"}] ${f.message}${f.selector ? `  (${f.selector})` : ""}`;
  console.log(`\nA11yForge audit — ${r.target}\n`);
  console.log(`Automated scanner (Layer A): ${r.scannerClean ? "0 violations — 'clean'" : `${r.layerA.length} violation(s)`}`);
  r.layerA.forEach((f) => console.log(line(f)));
  if (r.gap) {
    console.log(`\n⚠  SCANNER-CLEAN ≠ USABLE — ${r.summary.hiddenFromScanner} issue(s) a scanner cannot see:`);
  } else if (!r.scannerClean) {
    console.log(`\nPlus issues a scanner cannot see:`);
  }
  if (r.layerB.length) {
    console.log(`\n  Screen-reader / keyboard (Layer B): ${r.layerB.length}`);
    r.layerB.forEach((f) => console.log(line(f)));
  }
  if (r.layerC.length) {
    console.log(`\n  Semantic alt/labels (Layer C): ${r.layerC.length}`);
    r.layerC.forEach((f) => console.log(line(f)));
  }
  if (!r.layerB.length && !r.layerC.length) console.log("\n  No behavioral or semantic issues detected by A11yForge.");
  console.log("");
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const args = process.argv.slice(2);
  const cmd = args[0];
  const target = args[1];
  const jsonIdx = args.indexOf("--json");
  const jsonOut = jsonIdx >= 0 ? args[jsonIdx + 1] : undefined;
  const noJudge = args.includes("--no-judge");
  if (cmd !== "audit" || !target) {
    console.error("usage: a11yforge audit <url|path> [--json out.json] [--no-judge]");
    process.exit(2);
  }
  audit(target, { noJudge })
    .then((r) => {
      printReport(r);
      if (jsonOut) {
        writeFileSync(jsonOut, JSON.stringify(r, null, 2) + "\n", "utf8");
        console.log(`Wrote ${jsonOut}`);
      }
      process.exit(r.gap ? 1 : 0);
    })
    .catch((err: unknown) => {
      console.error("audit failed:", (err as Error).message);
      process.exit(2);
    });
}
