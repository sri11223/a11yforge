#!/usr/bin/env node
import { chromium, type Browser } from "playwright";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { Finding } from "../types.js";
import { runLayerA } from "../layers/layerA-scanners.js";
import { runLayerB } from "../layers/layerB-sr.js";
import { runLayerC } from "../layers/layerC-judge.js";
import { calibratedGateMode } from "../harness/scan-all.js";

/**
 * `a11yforge audit <url|path>` — point the full A/B/C detector at ANY page and report the
 * gap between "scanner-clean" and "usable". Layers A+B are deterministic and run offline;
 * Layer C's LLM judge engages only with OPENROUTER_API_KEY (and --no-llm / no key falls back
 * to the deterministic backstops), so `audit` is useful with no key and richer with one.
 *
 * Exit codes: 0 = no issues a scanner misses; 1 = gaps found (B/C, or any issue under --ci);
 * 2 = usage/fetch error. Human summary → stdout, progress → stderr, optional JSON/HTML out.
 */

export interface AuditReport {
  target: string;
  scannerClean: boolean;
  gap: boolean;
  layerA: Finding[];
  layerB: Finding[];
  layerC: Finding[];
  summary: { mechanical: number; behavioral: number; semantic: number; hiddenFromScanner: number };
  judge: "on" | "off";
}

export interface AuditOptions {
  browser?: Browser;
  noLlm?: boolean;
  timeoutMs?: number;
  /** Provide HTML directly (tests); skips URL/file resolution. */
  html?: string;
}

const isUrl = (t: string) => /^https?:\/\//i.test(t);

async function resolveHtml(target: string, browser: Browser, timeoutMs: number): Promise<string> {
  if (isUrl(target)) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    try {
      await page.goto(target, { waitUntil: "domcontentloaded", timeout: timeoutMs });
      return await page.content();
    } finally {
      await ctx.close();
    }
  }
  const path = resolve(target);
  if (!existsSync(path)) throw new Error(`not a URL and not an existing file: ${target}`);
  return readFileSync(path, "utf8");
}

export async function audit(target: string, opts: AuditOptions = {}): Promise<AuditReport> {
  const browser = opts.browser ?? (await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] }));
  const useJudge = !opts.noLlm && !!process.env.OPENROUTER_API_KEY && !!process.env.JUDGE_MODEL;
  if (useJudge) process.env.A11YFORGE_MODE ??= "live"; // live pages have no cassettes
  const timeoutMs = opts.timeoutMs ?? 30000;
  try {
    const html = opts.html ?? (await resolveHtml(target, browser, timeoutMs));
    const [layerA, layerB] = await Promise.all([
      runLayerA({ html }, { browser, navWaitUntil: "domcontentloaded" }),
      runLayerB({ html }, { browser, navWaitUntil: "domcontentloaded" }),
    ]);
    let layerC: Finding[] = [];
    try {
      layerC = await runLayerC(html, { useJudge, gateMode: calibratedGateMode() });
    } catch (err) {
      process.stderr.write(`[audit] Layer C degraded to backstops-only: ${(err as Error).message}\n`);
      layerC = await runLayerC(html, { useJudge: false });
    }
    return {
      target,
      scannerClean: layerA.length === 0,
      gap: layerA.length === 0 && layerB.length + layerC.length > 0,
      layerA,
      layerB,
      layerC,
      summary: { mechanical: layerA.length, behavioral: layerB.length, semantic: layerC.length, hiddenFromScanner: layerB.length + layerC.length },
      judge: useJudge ? "on" : "off",
    };
  } finally {
    if (!opts.browser) await browser.close();
  }
}

// ---- rendering ------------------------------------------------------------

const esc = (s: unknown) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export function renderGapHtml(r: AuditReport): string {
  const rows = (fs: Finding[]) =>
    fs.map((f) => `<li><code>${esc(f.wcag ?? "?")}</code> ${esc(f.message)} ${f.selector ? `<span class="sel">${esc(f.selector)}</span>` : ""}</li>`).join("\n");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>A11yForge gap report — ${esc(r.target)}</title><style>
body{font:16px/1.55 system-ui,sans-serif;color:#161616;max-width:820px;margin:0 auto;padding:32px 22px}
h1{font-size:24px}h2{font-size:17px;margin-top:26px}code{background:#eef0f3;padding:1px 5px;border-radius:4px}
.sel{color:#4a4f57;font-family:ui-monospace,monospace;font-size:13px}
.gap{background:#fce8e6;color:#b3261e;padding:12px 14px;border-radius:10px;font-weight:600}
.ok{background:#e6f4ea;color:#0a7d3c;padding:12px 14px;border-radius:10px;font-weight:600}
ul{padding-left:20px}li{margin:6px 0}</style></head><body>
<h1>A11yForge gap report</h1><p><strong>Target:</strong> ${esc(r.target)} · <strong>LLM judge:</strong> ${r.judge}</p>
${r.gap ? `<p class="gap">⚠ Scanner-clean ≠ usable — ${r.summary.hiddenFromScanner} issue(s) a scanner cannot see.</p>` : r.summary.hiddenFromScanner === 0 && r.scannerClean ? `<p class="ok">No issues detected by A11yForge.</p>` : ""}
<h2>Automated scanner — Layer A (${r.layerA.length})</h2><ul>${rows(r.layerA) || "<li>none</li>"}</ul>
<h2>Screen-reader / keyboard — Layer B (${r.layerB.length})</h2><ul>${rows(r.layerB) || "<li>none</li>"}</ul>
<h2>Semantic alt/labels — Layer C (${r.layerC.length})</h2><ul>${rows(r.layerC) || "<li>none</li>"}</ul>
</body></html>
`;
}

function printReport(r: AuditReport): void {
  const line = (f: Finding) => `    · [${f.wcag ?? "?"}] ${f.message}${f.selector ? `  (${f.selector})` : ""}`;
  const out = process.stdout;
  out.write(`\nA11yForge audit — ${r.target}   (LLM judge: ${r.judge})\n\n`);
  out.write(`Automated scanner (Layer A): ${r.scannerClean ? "0 violations — 'clean'" : `${r.layerA.length} violation(s)`}\n`);
  r.layerA.forEach((f) => out.write(line(f) + "\n"));
  if (r.gap) out.write(`\n⚠  SCANNER-CLEAN ≠ USABLE — ${r.summary.hiddenFromScanner} issue(s) a scanner cannot see:\n`);
  else if (!r.scannerClean) out.write(`\nPlus issues a scanner cannot see:\n`);
  if (r.layerB.length) {
    out.write(`\n  Screen-reader / keyboard (Layer B): ${r.layerB.length}\n`);
    r.layerB.forEach((f) => out.write(line(f) + "\n"));
  }
  if (r.layerC.length) {
    out.write(`\n  Semantic alt/labels (Layer C): ${r.layerC.length}\n`);
    r.layerC.forEach((f) => out.write(line(f) + "\n"));
  }
  if (!r.layerB.length && !r.layerC.length) out.write("\n  No behavioral or semantic issues detected by A11yForge.\n");
  out.write("");
}

// ---- CLI ------------------------------------------------------------------

const HELP = `a11yforge audit — find what a scanner-clean page still gets wrong.

Usage:
  a11yforge audit <url|path> [options]

Options:
  --json <file>    write the full machine-readable report as JSON
  --html <file>    write a standalone HTML gap report
  --no-llm         disable the Layer C LLM judge (deterministic backstops only)
  --timeout <ms>   navigation timeout for URLs (default 30000)
  --ci             strict: exit non-zero if ANY issue is found (A, B, or C)
  --help           show this help

Exit codes: 0 = nothing a scanner misses; 1 = gaps found; 2 = usage/fetch error.`;

interface Args {
  target?: string;
  json?: string;
  html?: string;
  noLlm: boolean;
  ci: boolean;
  timeoutMs: number;
  help: boolean;
}

export function parseArgs(argv: string[]): Args {
  const a: Args = { noLlm: false, ci: false, timeoutMs: 30000, help: false };
  // argv is expected to start after "audit"
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === "--help" || t === "-h") a.help = true;
    else if (t === "--no-llm") a.noLlm = true;
    else if (t === "--ci") a.ci = true;
    else if (t === "--json") a.json = argv[++i];
    else if (t === "--html") a.html = argv[++i];
    else if (t === "--timeout") a.timeoutMs = Number(argv[++i]) || a.timeoutMs;
    else if (!t!.startsWith("-") && !a.target) a.target = t;
  }
  return a;
}

async function main(): Promise<number> {
  // argv: node audit.js audit <target> ... OR node audit.js <target> ...
  const raw = process.argv.slice(2);
  const argv = raw[0] === "audit" ? raw.slice(1) : raw;
  const args = parseArgs(argv);

  if (args.help || !args.target) {
    process.stdout.write(HELP + "\n");
    return args.help ? 0 : 2;
  }

  process.stderr.write(`[audit] scanning ${args.target} ...\n`);
  let report: AuditReport;
  try {
    report = await audit(args.target, { noLlm: args.noLlm, timeoutMs: args.timeoutMs });
  } catch (err) {
    process.stderr.write(`[audit] failed: ${(err as Error).message}\n`);
    return 2;
  }

  printReport(report);
  if (args.json) {
    writeFileSync(args.json, JSON.stringify(report, null, 2) + "\n", "utf8");
    process.stderr.write(`[audit] wrote ${args.json}\n`);
  }
  if (args.html) {
    writeFileSync(args.html, renderGapHtml(report), "utf8");
    process.stderr.write(`[audit] wrote ${args.html}\n`);
  }

  const anyIssue = report.summary.mechanical + report.summary.hiddenFromScanner > 0;
  if (args.ci) return anyIssue ? 1 : 0;
  return report.summary.hiddenFromScanner > 0 ? 1 : 0;
}

const isMain = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main()
    .then((code) => process.exit(code))
    .catch((err: unknown) => {
      process.stderr.write(`[audit] fatal: ${(err as Error).message}\n`);
      process.exit(2);
    });
}
