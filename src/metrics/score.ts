import * as cheerio from "cheerio";
import type { Finding } from "../types.js";
import type { LayerScan } from "../harness/scan-all.js";
import { findAltGrounding } from "../agents/human-checkpoint.js";

/**
 * Metric scoring (per docs/BRAINSTORM.md §5). Computed against the issue set our
 * layers DETECT on the original page (the operational ground truth, whose selectors
 * line up with the after-scan). Applied IDENTICALLY to baseline and advanced.
 *
 * false-fix (the headline), applied symmetrically:
 *   A page/issue "shipped as done" (Layer A clean) that is nonetheless still broken —
 *   a residual Layer B/C failure, OR an ungrounded alt shipped as a confident
 *   description (a hallucination no automated layer catches). The baseline ships these;
 *   the advanced agent ships zero because it re-verifies B/C and escalates ungrounded alt.
 */

export type IssueClass = "true-fix" | "false-fix" | "needs-review" | "unresolved";

export interface IssueOutcome {
  key: string;
  layer: "A" | "B" | "C";
  wcag?: string;
  selector?: string;
  klass: IssueClass;
  reason?: string;
}

export interface PageScore {
  page: string;
  source: string;
  before: { a: number; b: number; c: number };
  after: { a: number; b: number; c: number };
  /** Original page is Layer-A-clean (agent-independent). */
  gapClean: boolean;
  /** Original page is A-clean but Layer B/C flag it (the gap). */
  gapBroken: boolean;
  /** Agent shipped a page that is A-clean but still B/C-broken or hallucinated an alt. */
  falseFixPage: boolean;
  /** All detected issues resolved honestly, no regression, nothing escalated-unfixed. */
  trueFixPage: boolean;
  regressionCount: number;
  hallucinatedAlt: number;
  issues: IssueOutcome[];
}

const key = (f: Finding) => `${f.layer}:${f.wcag ?? "?"}:${f.selector ?? ""}`;
const flat = (s: LayerScan) => [...s.A, ...s.B, ...s.C];

const GENERIC = new Set([
  "image", "photo", "picture", "pic", "img", "graphic", "icon", "logo",
  "thumbnail", "banner", "avatar", "placeholder", "untitled",
]);
const FILENAME = /\.(jpe?g|png|gif|svg|webp|avif|bmp)$/i;
const isAltIssue = (f: Finding) =>
  f.layer === "C" && f.wcag === "1.1.1" &&
  ["generic-word", "filename-as-alt", "informative-emptied"].includes(
    (f.detail as { rule?: string })?.rule ?? "",
  );

/**
 * Score one agent's output on one page.
 * @param reviewSelectors selectors the agent escalated to human review (advanced only).
 */
export function scorePage(
  page: string,
  source: string,
  originalHtml: string,
  agentHtml: string,
  before: LayerScan,
  after: LayerScan,
  reviewSelectors: Set<string> = new Set(),
): PageScore {
  const afterKeys = new Set(flat(after).map(key));
  const beforeKeys = new Set(flat(before).map(key));
  const $orig = cheerio.load(originalHtml);
  const $out = cheerio.load(agentHtml);

  const issues: IssueOutcome[] = [];
  let hallucinatedAlt = 0;

  for (const f of flat(before)) {
    const resolved = !afterKeys.has(key(f));
    const base = { key: key(f), layer: f.layer, wcag: f.wcag, selector: f.selector };

    if (isAltIssue(f) && f.selector) {
      const grounding = findAltGrounding(originalHtml, f.selector);
      const shipped = ($out(f.selector).first().attr("alt") ?? "").trim();
      const shippedIsDescription =
        shipped !== "" && !GENERIC.has(shipped.toLowerCase()) && !FILENAME.test(shipped) &&
        shipped.split(/\s+/).length >= 2;

      if (!grounding.grounded) {
        if (shippedIsDescription) {
          hallucinatedAlt++;
          issues.push({ ...base, klass: "false-fix", reason: "ungrounded alt shipped as a confident description (hallucination)" });
        } else if (reviewSelectors.has(f.selector)) {
          issues.push({ ...base, klass: "needs-review", reason: "ungrounded alt correctly escalated" });
        } else {
          issues.push({ ...base, klass: "unresolved", reason: "ungrounded alt left unfixed" });
        }
        continue;
      }
      // grounded
      issues.push({ ...base, klass: resolved ? "true-fix" : "unresolved" });
      continue;
    }

    if (resolved) {
      issues.push({ ...base, klass: "true-fix" });
    } else if (f.selector && reviewSelectors.has(f.selector)) {
      issues.push({ ...base, klass: "needs-review" });
    } else {
      issues.push({ ...base, klass: "unresolved" });
    }
  }

  const regressionCount = flat(after).filter((f) => !beforeKeys.has(key(f))).length;
  const gapClean = before.A.length === 0;
  const gapBroken = gapClean && before.B.length + before.C.length > 0;
  const shippedCompliant = after.A.length === 0;
  // Residual B/C failures the agent did NOT escalate — an escalated (needs-review)
  // item is not "shipped as done", so it does not count as a false-fix.
  const unescalatedResidual = [...after.B, ...after.C].filter(
    (f) => !(f.selector && reviewSelectors.has(f.selector)),
  ).length;
  const falseFixPage = shippedCompliant && (unescalatedResidual > 0 || hallucinatedAlt > 0);
  const trueFixPage =
    after.A.length === 0 &&
    after.B.length === 0 &&
    after.C.length === 0 &&
    hallucinatedAlt === 0 &&
    regressionCount === 0 &&
    !issues.some((i) => i.klass === "needs-review" || i.klass === "unresolved" || i.klass === "false-fix");

  void $orig;
  return {
    page, source,
    before: { a: before.A.length, b: before.B.length, c: before.C.length },
    after: { a: after.A.length, b: after.B.length, c: after.C.length },
    gapClean, gapBroken, falseFixPage, trueFixPage, regressionCount, hallucinatedAlt, issues,
  };
}

export interface AgentSummary {
  agent: string;
  pages: number;
  issues: number;
  trueFix: number;
  falseFix: number;
  needsReview: number;
  unresolved: number;
  regressions: number;
  falseFixPages: number;
  trueFixPages: number;
}

export function summarize(agent: string, scores: PageScore[]): AgentSummary {
  const issues = scores.flatMap((s) => s.issues);
  const count = (k: IssueClass) => issues.filter((i) => i.klass === k).length;
  return {
    agent,
    pages: scores.length,
    issues: issues.length,
    trueFix: count("true-fix"),
    falseFix: count("false-fix"),
    needsReview: count("needs-review"),
    unresolved: count("unresolved"),
    regressions: scores.reduce((n, s) => n + s.regressionCount, 0),
    falseFixPages: scores.filter((s) => s.falseFixPage).length,
    trueFixPages: scores.filter((s) => s.trueFixPage).length,
  };
}
