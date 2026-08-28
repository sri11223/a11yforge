import { chromium, type Browser } from "playwright";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { join } from "node:path";
import { runLayerA } from "../src/layers/layerA-scanners.js";
import { runBaseline } from "../src/agents/baseline.js";
import { runAdvanced, type FixMemory } from "../src/agents/advanced.js";
import { scanAll } from "../src/harness/scan-all.js";
import { scorePage, summarize, type PageScore } from "../src/metrics/score.js";
import { mcNemar, wilsonInterval } from "../src/metrics/stats.js";

/**
 * End-to-end eval: score baseline vs advanced through the same A/B/C harness over
 * one or more corpus buckets. Replays committed cassettes (offline, deterministic).
 * Run from compiled dist/ (the harness uses Layer B / page.evaluate):
 *   npx tsc && A11YFORGE_MODE=replay FIXER_MODEL=anthropic/claude-sonnet-5 \
 *     JUDGE_MODEL=openai/gpt-4o-mini node dist/eval/run-eval.js
 */

const BUCKETS = ["adversarial", "injected"].map((b) => join(process.cwd(), "corpus", b));

interface PagePair {
  bucket: string;
  slug: string;
  baseline: PageScore;
  advanced: PageScore;
}

async function evalPage(browser: Browser, bucket: string, dir: string, slug: string, memory: FixMemory): Promise<PagePair> {
  const html = readFileSync(join(dir, slug, "index.html"), "utf8");
  const scanner = await runLayerA({ url: pathToFileURL(join(dir, slug, "index.html")).href }, { browser });
  const baseHtml = (await runBaseline(html, scanner)).html;
  const adv = await runAdvanced(html, { browser, pageId: slug, memory });

  const before = await scanAll(html, { browser });
  const afterBase = await scanAll(baseHtml, { browser });
  const afterAdv = await scanAll(adv.html, { browser });
  const reviewSel = new Set(adv.reviewQueue.map((r) => r.selector));

  return {
    bucket,
    slug,
    baseline: scorePage(slug, "baseline", html, baseHtml, before, afterBase),
    advanced: scorePage(slug, "advanced", html, adv.html, before, afterAdv, reviewSel),
  };
}

function pct(n: number, d: number): string {
  return d === 0 ? "n/a" : `${((100 * n) / d).toFixed(1)}%`;
}

/**
 * Ablation: audit an agent's shipped output at increasing verification depth.
 * {A} = a scanner-only auditor declares a page "compliant" when Layer A is clean;
 * adding {B} then {C} reveals false-compliances a shallower audit would have shipped.
 * This is the proof each layer earns its place.
 */
function ablation(scores: PageScore[]): {
  aCleanDeclaredCompliant: number;
  layerBcatches: number;
  layerCcatches: number;
  trulyCleanAllThree: number;
} {
  const aClean = scores.filter((s) => s.after.a === 0);
  const layerBcatches = aClean.filter((s) => s.after.b > 0).length;
  const layerCcatches = aClean.filter((s) => s.after.b === 0 && (s.after.c > 0 || s.hallucinatedAlt > 0)).length;
  const trulyCleanAllThree = aClean.filter((s) => s.after.b === 0 && s.after.c === 0 && s.hallucinatedAlt === 0).length;
  return { aCleanDeclaredCompliant: aClean.length, layerBcatches, layerCcatches, trulyCleanAllThree };
}

async function main(): Promise<void> {
  const browser = await chromium.launch();
  const pairs: PagePair[] = [];
  try {
    for (const dir of BUCKETS) {
      if (!existsSync(dir)) continue;
      const bucket = dir.split(/[\\/]/).pop()!;
      const slugs = readdirSync(dir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
        .filter((s) => existsSync(join(dir, s, "index.html")))
        .sort();
      const memory: FixMemory = new Map();
      for (const slug of slugs) {
        pairs.push(await evalPage(browser, bucket, dir, slug, memory));
        process.stdout.write(".");
      }
    }
    process.stdout.write("\n");
  } finally {
    await browser.close();
  }

  const baseScores = pairs.map((p) => p.baseline);
  const advScores = pairs.map((p) => p.advanced);
  const base = summarize("baseline", baseScores);
  const adv = summarize("advanced", advScores);

  // Paired McNemar on per-issue outcomes (issue set identical across agents).
  const baseIssues = baseScores.flatMap((s) => s.issues);
  const advIssues = advScores.flatMap((s) => s.issues);
  const idx = new Map(advIssues.map((i) => [i.key + "@" + i.selector, i]));
  let tfB = 0, tfC = 0, ffB = 0, ffC = 0;
  for (const bi of baseIssues) {
    const ai = idx.get(bi.key + "@" + bi.selector);
    if (!ai) continue;
    const bTrue = bi.klass === "true-fix", aTrue = ai.klass === "true-fix";
    if (bTrue && !aTrue) tfB++;
    if (aTrue && !bTrue) tfC++;
    const bFalse = bi.klass === "false-fix", aFalse = ai.klass === "false-fix";
    if (bFalse && !aFalse) ffB++;
    if (aFalse && !bFalse) ffC++;
  }
  const mcTrue = mcNemar(tfB, tfC);
  const mcFalse = mcNemar(ffB, ffC);
  const ffRateBase = wilsonInterval(base.falseFix, base.issues);
  const ffRateAdv = wilsonInterval(adv.falseFix, adv.issues);

  // Per-PAGE harm: regression and pooled harmful-change (false-fix OR regression).
  let regB = 0, regC = 0, harmB = 0, harmC = 0, baseHarmPages = 0, advHarmPages = 0;
  for (const p of pairs) {
    const bReg = p.baseline.regressionCount > 0, aReg = p.advanced.regressionCount > 0;
    if (bReg && !aReg) regB++;
    if (aReg && !bReg) regC++;
    const bHarm = p.baseline.falseFixPage || bReg, aHarm = p.advanced.falseFixPage || aReg;
    if (bHarm) baseHarmPages++;
    if (aHarm) advHarmPages++;
    if (bHarm && !aHarm) harmB++;
    if (aHarm && !bHarm) harmC++;
  }
  const mcReg = mcNemar(regB, regC);
  const mcHarm = mcNemar(harmB, harmC);
  const harmRateBase = wilsonInterval(baseHarmPages, pairs.length);
  const harmRateAdv = wilsonInterval(advHarmPages, pairs.length);
  const harmfulChangesBase = base.falseFix + base.regressions;
  const harmfulChangesAdv = adv.falseFix + adv.regressions;

  const gapPages = pairs.filter((p) => p.baseline.gapBroken).length;
  const aCleanPages = pairs.filter((p) => p.baseline.gapClean).length;

  const report = {
    n: { pages: pairs.length, issues: base.issues, buckets: [...new Set(pairs.map((p) => p.bucket))] },
    gap: {
      aCleanPages,
      aCleanButBrokenPages: gapPages,
      gapPctOfACleanPages: pct(gapPages, aCleanPages),
    },
    baseline: base,
    advanced: adv,
    deltas: {
      falseFixIssues: `${base.falseFix} → ${adv.falseFix}`,
      trueFixIssues: `${base.trueFix} → ${adv.trueFix}`,
      regressions: `${base.regressions} → ${adv.regressions}`,
      falseFixPages: `${base.falseFixPages} → ${adv.falseFixPages}`,
    },
    falseFixRate: {
      baseline: `${(100 * ffRateBase.point).toFixed(1)}% [${(100 * ffRateBase.low).toFixed(1)}, ${(100 * ffRateBase.high).toFixed(1)}]`,
      advanced: `${(100 * ffRateAdv.point).toFixed(1)}% [${(100 * ffRateAdv.low).toFixed(1)}, ${(100 * ffRateAdv.high).toFixed(1)}]`,
    },
    harm: {
      note: "Harmful CHANGES = false-fixes + regressions the agent shipped. Per-page harm = a page with any false-fix or regression.",
      harmfulChanges: { baseline: harmfulChangesBase, advanced: harmfulChangesAdv },
      harmfulPages: { baseline: baseHarmPages, advanced: advHarmPages },
      harmfulPageRate: {
        baseline: `${(100 * harmRateBase.point).toFixed(1)}% [${(100 * harmRateBase.low).toFixed(1)}, ${(100 * harmRateBase.high).toFixed(1)}]`,
        advanced: `${(100 * harmRateAdv.point).toFixed(1)}% [${(100 * harmRateAdv.low).toFixed(1)}, ${(100 * harmRateAdv.high).toFixed(1)}]`,
      },
    },
    mcnemar: {
      trueFix: { b: mcTrue.b, c: mcTrue.c, statistic: +mcTrue.statistic.toFixed(3), p: +mcTrue.pValue.toFixed(4) },
      falseFix: { b: mcFalse.b, c: mcFalse.c, statistic: +mcFalse.statistic.toFixed(3), p: +mcFalse.pValue.toFixed(4) },
      regressionPages: { b: mcReg.b, c: mcReg.c, statistic: +mcReg.statistic.toFixed(3), p: +mcReg.pValue.toFixed(4) },
      harmfulPages: { b: mcHarm.b, c: mcHarm.c, statistic: +mcHarm.statistic.toFixed(3), p: +mcHarm.pValue.toFixed(4) },
    },
    ablation: {
      note: "Auditing each agent's shipped output at increasing verification depth. Each row is pages an {A}-only audit called compliant that the added layer reveals as still-broken.",
      baseline: ablation(baseScores),
      advanced: ablation(advScores),
    },
    perPage: pairs.map((p) => ({
      bucket: p.bucket, page: p.slug,
      baseline: { after: p.baseline.after, falseFix: p.baseline.falseFixPage, trueFix: p.baseline.trueFixPage, halluc: p.baseline.hallucinatedAlt, regressions: p.baseline.regressionCount },
      advanced: { after: p.advanced.after, falseFix: p.advanced.falseFixPage, trueFix: p.advanced.trueFixPage, needsReview: p.advanced.issues.filter((i) => i.klass === "needs-review").length, regressions: p.advanced.regressionCount },
    })),
  };

  mkdirSync(join(process.cwd(), "out"), { recursive: true });
  writeFileSync(join(process.cwd(), "out", "metrics.json"), JSON.stringify(report, null, 2) + "\n", "utf8");

  console.log(`\nPages=${report.n.pages}  Issues=${report.n.issues}  Buckets=${report.n.buckets.join(",")}`);
  console.log(`GAP: of ${aCleanPages} axe-clean pages, ${gapPages} still fail B/C = ${report.gap.gapPctOfACleanPages}`);
  console.log(`\n                 baseline   advanced`);
  console.log(`true-fix issues   ${String(base.trueFix).padStart(6)}   ${String(adv.trueFix).padStart(8)}`);
  console.log(`FALSE-FIX issues  ${String(base.falseFix).padStart(6)}   ${String(adv.falseFix).padStart(8)}`);
  console.log(`needs-review      ${String(base.needsReview).padStart(6)}   ${String(adv.needsReview).padStart(8)}`);
  console.log(`unresolved        ${String(base.unresolved).padStart(6)}   ${String(adv.unresolved).padStart(8)}`);
  console.log(`regressions       ${String(base.regressions).padStart(6)}   ${String(adv.regressions).padStart(8)}`);
  console.log(`false-fix PAGES   ${String(base.falseFixPages).padStart(6)}   ${String(adv.falseFixPages).padStart(8)}`);
  console.log(`true-fix PAGES    ${String(base.trueFixPages).padStart(6)}   ${String(adv.trueFixPages).padStart(8)}`);
  console.log(`\nHARM SHIPPED (false-fixes + regressions): baseline ${harmfulChangesBase} → advanced ${harmfulChangesAdv}`);
  console.log(`harmful PAGES: baseline ${baseHarmPages} (${report.harm.harmfulPageRate.baseline}) → advanced ${advHarmPages} (${report.harm.harmfulPageRate.advanced})`);
  console.log(`\nfalse-fix rate: baseline ${report.falseFixRate.baseline} | advanced ${report.falseFixRate.advanced}`);
  console.log(`McNemar harmful-pages: b=${mcHarm.b} c=${mcHarm.c} χ²=${mcHarm.statistic.toFixed(2)} p=${mcHarm.pValue.toFixed(4)}`);
  console.log(`McNemar regressions:   b=${mcReg.b} c=${mcReg.c} χ²=${mcReg.statistic.toFixed(2)} p=${mcReg.pValue.toFixed(4)}`);
  console.log(`McNemar false-fix:     b=${mcFalse.b} c=${mcFalse.c} χ²=${mcFalse.statistic.toFixed(2)} p=${mcFalse.pValue.toFixed(4)}`);
  console.log(`McNemar true-fix:      b=${mcTrue.b} c=${mcTrue.c} χ²=${mcTrue.statistic.toFixed(2)} p=${mcTrue.pValue.toFixed(4)}`);
  const abB = ablation(baseScores), abA = ablation(advScores);
  console.log(`\nABLATION (auditing shipped output at increasing depth):`);
  console.log(`                        baseline   advanced`);
  console.log(`{A} declared compliant  ${String(abB.aCleanDeclaredCompliant).padStart(6)}   ${String(abA.aCleanDeclaredCompliant).padStart(8)}`);
  console.log(`  ...Layer B reveals    ${String(abB.layerBcatches).padStart(6)}   ${String(abA.layerBcatches).padStart(8)}  (false-compliances a scanner+B audit catches)`);
  console.log(`  ...Layer C reveals    ${String(abB.layerCcatches).padStart(6)}   ${String(abA.layerCcatches).padStart(8)}  (adds semantic/hallucination catches)`);
  console.log(`  truly clean {A,B,C}   ${String(abB.trulyCleanAllThree).padStart(6)}   ${String(abA.trulyCleanAllThree).padStart(8)}`);
  console.log(`\nWrote out/metrics.json`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
