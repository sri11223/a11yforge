import { chromium, type Browser } from "playwright";
import { AxeBuilder } from "@axe-core/playwright";
import pa11y from "pa11y";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { Finding, Impact } from "../types.js";

/**
 * Layer A — mechanical, deterministic. Two independent engines (axe-core via
 * Playwright, and pa11y's HTMLCS via Puppeteer) run over the same page and are
 * normalized into a single Finding[].
 *
 * Scope & principle (see docs/BRAINSTORM.md and BUILD_LOG step 4):
 *  - WCAG 2.x A/AA success criteria only, matching the corpus scope.
 *  - DEFINITE failures only: axe *violations* (WCAG-tagged) and pa11y *errors*.
 *    pa11y warnings/notices are heuristic ("needs manual check") and fire
 *    spuriously on behaviorally-broken-but-markup-valid pages, so counting them
 *    would falsely flag the scanner-invisible pages and destroy the gap proof.
 *  - Output is deterministic: findings are de-duplicated by node+criterion and
 *    stable-sorted (selector, then WCAG SC, then id).
 */

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

export interface LayerAInput {
  /** Raw HTML to scan (written to a temp file so both engines see identical input). */
  html?: string;
  /** Or an existing URL/file URL to scan directly. */
  url?: string;
}

export interface LayerAOptions {
  /** Reuse a Playwright browser across calls (the verify-loop scans repeatedly). */
  browser?: Browser;
}

/** Convert an axe tag like "wcag111"/"wcag1410" into a WCAG SC like "1.1.1"/"1.4.10". */
function scFromAxeTags(tags: string[]): string | undefined {
  for (const t of tags) {
    const m = /^wcag(\d)(\d)(\d+)$/.exec(t);
    if (m) return `${m[1]}.${m[2]}.${m[3]}`;
  }
  return undefined;
}

/** Extract a WCAG SC like "1.3.1" from an HTMLCS code such as ...Guideline1_3.1_3_1.F68 */
function scFromPa11yCode(code: string): string | undefined {
  const m = /\.(\d+)_(\d+)_(\d+)(?:_[A-Za-z]+)?\./.exec(code);
  return m ? `${m[1]}.${m[2]}.${m[3]}` : undefined;
}

const AXE_IMPACTS: readonly string[] = ["minor", "moderate", "serious", "critical"];
function toImpact(value: string | null | undefined): Impact | undefined {
  return value && AXE_IMPACTS.includes(value) ? (value as Impact) : undefined;
}

interface RawFinding {
  engine: "axe-core" | "pa11y";
  rule: string;
  wcag?: string;
  selector: string;
  impact?: Impact;
  message: string;
}

async function runAxe(url: string, shared?: Browser): Promise<RawFinding[]> {
  const browser = shared ?? (await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] }));
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto(url);
    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    return results.violations.flatMap((v) =>
      v.nodes.map((n): RawFinding => ({
        engine: "axe-core",
        rule: v.id,
        wcag: scFromAxeTags(v.tags),
        selector: n.target.map(String).join(" "),
        impact: toImpact(n.impact ?? v.impact),
        message: v.help,
      })),
    );
  } finally {
    await context.close();
    if (!shared) await browser.close();
  }
}

async function runPa11y(url: string): Promise<RawFinding[]> {
  const res = await pa11y(url, {
    runners: ["htmlcs"],
    standard: "WCAG2AA",
    includeWarnings: false,
    includeNotices: false,
    // Needed when running as root in Docker (pa11y drives Chromium via Puppeteer).
    chromeLaunchConfig: { args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"] },
  });
  return res.issues
    .filter((i) => i.type === "error")
    .map((i): RawFinding => ({
      engine: "pa11y",
      rule: i.code,
      wcag: scFromPa11yCode(i.code),
      selector: i.selector || "html",
      impact: "serious",
      message: i.message,
    }));
}

/** De-duplicate by node+criterion (merging engines) and stable-sort. */
function normalize(raw: RawFinding[]): Finding[] {
  const groups = new Map<string, RawFinding[]>();
  for (const r of raw) {
    const key = `${r.selector}|${r.wcag ?? r.rule}`;
    const list = groups.get(key);
    if (list) list.push(r);
    else groups.set(key, [r]);
  }

  const findings: Finding[] = [];
  for (const [, members] of groups) {
    const sources = [...new Set(members.map((m) => m.engine))].sort();
    const rules = [...new Set(members.map((m) => m.rule))].sort();
    const first = members[0]!;
    const impacts = members
      .map((m) => m.impact)
      .filter((x): x is Impact => x !== undefined);
    const impact = impacts.length
      ? impacts.sort((a, b) => AXE_IMPACTS.indexOf(b) - AXE_IMPACTS.indexOf(a))[0]
      : undefined;

    findings.push({
      id: `A:${first.wcag ?? first.rule}:${first.selector}`,
      layer: "A",
      type: "mechanical",
      source: sources.join("+"),
      selector: first.selector,
      wcag: first.wcag,
      impact,
      message: first.message,
      detail: { rules, engines: sources },
    });
  }

  return findings.sort(
    (a, b) =>
      (a.selector ?? "").localeCompare(b.selector ?? "") ||
      (a.wcag ?? "").localeCompare(b.wcag ?? "") ||
      a.id.localeCompare(b.id),
  );
}

export async function runLayerA(input: LayerAInput, opts: LayerAOptions = {}): Promise<Finding[]> {
  let url = input.url;
  let cleanup: (() => void) | undefined;

  if (!url) {
    if (input.html === undefined) throw new Error("runLayerA requires `html` or `url`");
    const dir = mkdtempSync(join(tmpdir(), "a11yforge-"));
    const file = join(dir, "page.html");
    writeFileSync(file, input.html, "utf8");
    url = pathToFileURL(file).href;
    cleanup = () => rmSync(dir, { recursive: true, force: true });
  }

  try {
    const [axeFindings, pa11yFindings] = await Promise.all([
      runAxe(url, opts.browser),
      runPa11y(url),
    ]);
    return normalize([...axeFindings, ...pa11yFindings]);
  } finally {
    cleanup?.();
  }
}
