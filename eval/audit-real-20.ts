import { chromium, type Browser } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Finding } from "../src/types.js";
import { runLayerA } from "../src/layers/layerA-scanners.js";
import { runLayerB } from "../src/layers/layerB-sr.js";
import { runLayerC } from "../src/layers/layerC-judge.js";
import { calibratedGateMode } from "../src/harness/scan-all.js";

/**
 * DEEP real-world audit — detection-only, LIVE (full Playwright JS render). Points the full
 * A/B/C detector at 15+ diverse real sites and reports the gap between "scanner-clean" and
 * "usable". This is DATED, NON-DETERMINISTIC live evidence (sites change, LLM judge is live) —
 * kept entirely separate from the sealed deterministic eval. We never modify or publish fixes
 * to sites we don't own; we only read public pages, as any browser does. Sites that bot-block
 * or fail to render are SKIPPED with an honest reason — never fabricated.
 *
 * Run from dist/: node dist/eval/audit-real-20.js   (uses OPENROUTER_API_KEY + JUDGE_MODEL for
 * Layer C if present; otherwise deterministic backstops only).
 */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
// Per-LAYER budgets: on huge real DOMs Layer A (pa11y) and Layer B (virtual-SR/CDP traversal)
// can be slow, so each layer is bounded independently — a slow layer degrades to "timed out"
// while the others still report, instead of dropping the whole site.
const NAV_MS = 45_000;
const LAYER_A_MS = 45_000;
const LAYER_B_MS = 40_000;
const LAYER_C_MS = 60_000;
const PER_SITE_MS = 210_000; // generous outer backstop (sum of layer caps + margin)

interface Site { url: string; category: string; }
const SITES: Site[] = [
  { url: "https://www.npr.org", category: "news" },
  { url: "https://apnews.com", category: "news" },
  { url: "https://www.bbc.com/news", category: "news" },
  { url: "https://www.usa.gov", category: "government" },
  { url: "https://www.gov.uk", category: "government" },
  { url: "https://www.nasa.gov", category: "government/science" },
  { url: "https://www.apple.com", category: "big brand / e-commerce" },
  { url: "https://www.microsoft.com", category: "big brand" },
  { url: "https://stripe.com", category: "SaaS / fintech" },
  { url: "https://vercel.com", category: "SaaS / developer" },
  { url: "https://developer.mozilla.org", category: "developer docs" },
  { url: "https://docs.python.org/3/", category: "developer docs" },
  { url: "https://www.mit.edu", category: "university" },
  { url: "https://www.stanford.edu", category: "university" },
  { url: "https://www.nih.gov", category: "healthcare / gov" },
  { url: "https://www.mayoclinic.org", category: "healthcare" },
  { url: "https://www.who.int", category: "healthcare / NGO" },
  { url: "https://en.wikipedia.org/wiki/Accessibility", category: "reference" },
  { url: "https://www.w3.org", category: "standards" },
  { url: "https://www.smashingmagazine.com", category: "small business / publishing" },
];

interface SiteResult {
  url: string; category: string; ok: boolean; error?: string;
  scannerClean?: boolean; a?: number; b?: number; c?: number; hiddenFromScanner?: number;
  layerA?: string[]; layerB?: string[]; layerC?: string[];
  layerErrors?: { a?: string; b?: string; c?: string };
}

const summ = (fs: Finding[]) => fs.map((f) => `[${f.wcag ?? "?"}] ${f.message}${f.selector ? ` (${f.selector})` : ""}`);
const short = (e: unknown) => (String((e as Error).message ?? e).split("\n")[0] ?? "").slice(0, 200);

async function fetchRenderedHtml(browser: Browser, url: string): Promise<string> {
  // domcontentloaded + a fixed settle lets JS render without hanging on ad/tracker "load"/
  // "networkidle" that never settles on heavy real sites. Captures the JS-rendered DOM.
  const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 1366, height: 900 } });
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: NAV_MS });
    await page.waitForTimeout(2_500);
    return await page.content();
  } finally {
    await ctx.close();
  }
}

async function auditSite(browser: Browser, site: Site, useJudge: boolean): Promise<SiteResult> {
  // One navigation gates the whole site: if the page won't load, we skip it honestly.
  const html = await fetchRenderedHtml(browser, site.url);
  // Each layer fails INDEPENDENTLY — a strict-CSP site that blocks axe's script injection
  // (Layer A) still yields Layer B/C rather than dropping the whole site.
  const errors: { a?: string; b?: string; c?: string } = {};
  let layerA: Finding[] = [], layerB: Finding[] = [], layerC: Finding[] = [];
  try { layerA = await withTimeout(runLayerA({ url: site.url }, { browser, navWaitUntil: "domcontentloaded" }), LAYER_A_MS, "layerA"); }
  catch (e) { errors.a = short(e); }
  try { layerB = await withTimeout(runLayerB({ url: site.url }, { browser, navWaitUntil: "domcontentloaded" }), LAYER_B_MS, "layerB"); }
  catch (e) { errors.b = short(e); }
  try { layerC = await withTimeout(runLayerC(html, { useJudge, gateMode: calibratedGateMode() }), LAYER_C_MS, "layerC"); }
  catch (e1) {
    try { layerC = await withTimeout(runLayerC(html, { useJudge: false }), LAYER_C_MS, "layerC"); errors.c = "judge failed/slow; used backstops"; }
    catch (e2) { errors.c = short(e2 ?? e1); }
  }
  const hasErr = !!(errors.a || errors.b || errors.c);
  return {
    url: site.url, category: site.category, ok: true,
    scannerClean: !errors.a && layerA.length === 0,
    a: layerA.length, b: layerB.length, c: layerC.length,
    hiddenFromScanner: layerB.length + layerC.length,
    layerA: summ(layerA), layerB: summ(layerB), layerC: summ(layerC),
    ...(hasErr ? { layerErrors: errors } : {}),
  };
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`timed out after ${ms}ms`)), ms)),
  ]).catch((e) => { throw new Error(`${label}: ${(e as Error).message}`); });
}

function layerNote(s: SiteResult): string {
  const e = s.layerErrors;
  if (!e) return "";
  const p: string[] = [];
  if (e.a) p.push(`A ${e.a.includes("timed out") ? "timed out" : "blocked"}`);
  if (e.b) p.push(`B ${e.b.includes("timed out") ? "timed out" : e.b.includes("Content Security Policy") ? "CSP-blocked" : "error"}`);
  if (e.c) p.push("C judge→backstops");
  return p.join("; ");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildMarkdown(report: any): string {
  const ok: SiteResult[] = report.sites.filter((s: SiteResult) => s.ok);
  const skipped: SiteResult[] = report.sites.filter((s: SiteResult) => !s.ok);
  const partial = ok.filter((s) => s.layerErrors);
  const aTO = ok.filter((s) => s.layerErrors?.a).length;
  const bUnavail = ok.filter((s) => s.layerErrors?.b).length;
  const judgeDeg = ok.filter((s) => s.layerErrors?.c).length;
  const host = (u: string) => u.replace(/^https?:\/\//, "");
  const mark = (v: number | undefined, err?: string) => `${v ?? 0}${err ? "*" : ""}`;

  const rows = ok.map((r) =>
    `| ${host(r.url)} | ${r.category} | ${mark(r.a, r.layerErrors?.a)} | ${mark(r.b, r.layerErrors?.b)} | ${r.c} | ${r.hiddenFromScanner} | ${r.scannerClean ? "yes" : "no"} | ${layerNote(r) || "—"} |`,
  );
  const partialRows = partial.map((r) => `| ${host(r.url)} | ${layerNote(r)} |`);
  const skipRows = skipped.map((r) => `| ${host(r.url)} | ${r.category} | ${r.error} |`);

  return `# Real-world deep audit — ${ok.length} sites (live, detection-only)

_Generated: ${report.generatedAt}. LLM judge: ${report.judge}. Non-deterministic, dated evidence —
separate from the sealed deterministic eval. Detection-only: we never modify or publish fixes to
sites we do not own._

## Totals

- Sites attempted: **${report.totals.attempted}** · audited: **${report.totals.audited}** · skipped: **${report.totals.skipped}**
- Layer A (scanner) findings: **${report.totals.layerA}**
- Layer B (screen-reader / keyboard) findings: **${report.totals.layerB}**
- Layer C (semantic alt/labels) findings: **${report.totals.layerC}**
- **Issues hidden from the scanner (B + C): ${report.totals.hiddenFromScanner}** — across ${ok.length} major real sites
- Pages a scanner calls clean: **${report.totals.scannerCleanPages}** — of which **${report.totals.scannerCleanButBrokenPages}** still fail Layer B/C

> **These totals are a LOWER BOUND.** On big real DOMs some layers exceeded their per-layer
> budget or were blocked by the site's Content-Security-Policy, and are marked \`*\` below (a
> \`0*\` means "not measured", not "clean"): Layer A timed out on **${aTO}**, Layer B was
> unavailable (timeout or CSP-blocked script injection) on **${bUnavail}**, and the Layer C LLM
> judge degraded to deterministic backstops on **${judgeDeg}**. The real issue counts are higher.

## Per-site

| Site | Category | A | B | C | hidden (B+C) | scanner-clean? | partial-data notes |
|---|---|---|---|---|---|---|---|
${rows.join("\n")}

_\`*\` = that layer hit its per-layer timeout or was CSP-blocked; the shown count is partial._
${partialRows.length ? `\n## Per-layer partial data (transparency)\n\n| Site | What was partial |\n|---|---|\n${partialRows.join("\n")}\n` : ""}${skipRows.length ? `\n## Skipped — did not navigate (honest, not counted)\n\n| Site | Category | Reason |\n|---|---|---|\n${skipRows.join("\n")}\n` : `\n_No sites were skipped: all ${report.totals.attempted} navigated and were audited._\n`}
## Method & caveats

- **Live, full JS render:** navigate with \`domcontentloaded\` + a 2.5s settle (heavy ad/tracker
  sites never reach \`load\`/\`networkidle\`), then run A/B/C. Each layer has its own timeout so a
  slow layer degrades gracefully instead of dropping the whole site.
- Live sites change and A/B-test; counts are a snapshot at the timestamp above.
- Layer C used ${report.judge}.
- **Detection-only** — we never modify or publish fixes to sites we don't own.
- Full machine-readable data incl. per-finding messages and per-layer errors: \`real-world-20.json\`.
`;
}

async function main(): Promise<void> {
  const useJudge = !!process.env.OPENROUTER_API_KEY && !!process.env.JUDGE_MODEL;
  if (useJudge) process.env.A11YFORGE_MODE ??= "live";
  const stamp = process.env.RUN_TIMESTAMP ?? "unset (pass RUN_TIMESTAMP)";

  // Regenerate the markdown from an existing JSON without re-auditing (report-format tweaks).
  if (process.env.REGEN_ONLY === "1") {
    const { readFileSync } = await import("node:fs");
    const report = JSON.parse(readFileSync(join(process.cwd(), "out", "real-world-20.json"), "utf8"));
    writeFileSync(join(process.cwd(), "out", "real-world-20.md"), buildMarkdown(report), "utf8");
    console.log("Regenerated out/real-world-20.md from existing JSON.");
    return;
  }

  const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const results: SiteResult[] = [];
  try {
    for (const site of SITES) {
      process.stderr.write(`[real-15] auditing ${site.url} ...\n`);
      try {
        results.push(await withTimeout(auditSite(browser, site, useJudge), PER_SITE_MS, site.url));
        process.stderr.write(`[real-15]   ok\n`);
      } catch (e) {
        results.push({ url: site.url, category: site.category, ok: false, error: (e as Error).message });
        process.stderr.write(`[real-15]   SKIP: ${(e as Error).message}\n`);
      }
    }
  } finally {
    await browser.close();
  }

  const ok = results.filter((r) => r.ok);
  const skipped = results.filter((r) => !r.ok);
  const sum = (k: "a" | "b" | "c" | "hiddenFromScanner") => ok.reduce((n, r) => n + (r[k] ?? 0), 0);
  const scannerCleanButBroken = ok.filter((r) => r.scannerClean && (r.hiddenFromScanner ?? 0) > 0).length;

  const report = {
    generatedAt: stamp,
    note: "LIVE detection-only audit of real public sites. Non-deterministic, dated evidence — separate from the sealed deterministic eval. We do not modify or publish fixes to sites we don't own.",
    judge: useJudge ? `on (${process.env.JUDGE_MODEL})` : "off (deterministic backstops only)",
    totals: {
      attempted: results.length, audited: ok.length, skipped: skipped.length,
      layerA: sum("a"), layerB: sum("b"), layerC: sum("c"), hiddenFromScanner: sum("hiddenFromScanner"),
      scannerCleanPages: ok.filter((r) => r.scannerClean).length,
      scannerCleanButBrokenPages: scannerCleanButBroken,
    },
    sites: results,
  };

  mkdirSync(join(process.cwd(), "out"), { recursive: true });
  writeFileSync(join(process.cwd(), "out", "real-world-20.json"), JSON.stringify(report, null, 2) + "\n", "utf8");

  writeFileSync(join(process.cwd(), "out", "real-world-20.md"), buildMarkdown(report), "utf8");

  console.log(`\nAudited ${ok.length}/${results.length} sites (skipped ${skipped.length}).`);
  console.log(`Totals — A:${report.totals.layerA}  B:${report.totals.layerB}  C:${report.totals.layerC}  hidden:${report.totals.hiddenFromScanner}`);
  console.log(`Scanner-clean pages: ${report.totals.scannerCleanPages}, of which ${scannerCleanButBroken} still fail B/C.`);
  console.log(`Wrote out/real-world-20.json + out/real-world-20.md`);
}

main().catch((e: unknown) => { console.error(e); process.exitCode = 1; });
