import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { wilsonInterval } from "../src/metrics/stats.js";

/**
 * STATISTICAL SUPPLEMENT — computes the statistics the sealed artifacts do not contain, and
 * writes docs/results/STATISTICS.md.
 *
 * Why a separate script: the `mcnemar` block lives INSIDE the sealed metrics files, and
 * src/metrics/stats.ts implements only the chi-square McNemar. Changing that estimator would
 * break the byte-identical seal, so we do not touch it. This reads the committed artifacts and
 * adds the exact test, effect sizes and the dose-response reading alongside — sealed files stay
 * untouched. Run from dist/: node dist/eval/stats-supplement.js
 */

const RESULTS = join(process.cwd(), "docs", "results");
const read = (f: string) => JSON.parse(readFileSync(join(RESULTS, f), "utf8"));

/** Exact two-sided McNemar (sign test): X ~ Binom(b+c, 0.5). Authoritative at small b+c. */
function exactTwoSided(b: number, c: number): number {
  const n = b + c;
  if (n === 0) return 1;
  const lo = Math.min(b, c);
  let cum = 0;
  for (let k = 0; k <= lo; k++) {
    let logC = 0;
    for (let i = 1; i <= k; i++) logC += Math.log(n - k + i) - Math.log(i);
    cum += Math.exp(logC + n * Math.log(0.5));
  }
  return Math.min(1, 2 * cum);
}

const pct = (x: number) => `${(100 * x).toFixed(1)}%`;
const ci = (k: number, n: number) => {
  const w = wilsonInterval(k, n);
  return `${pct(w.point)} [${pct(w.low)}, ${pct(w.high)}]`;
};
const fmtP = (p: number) => (p < 0.001 ? "<0.001" : p.toFixed(4));

/** Every contrast, with the DIRECTION spelled out in words — never bare b/c. */
interface Contrast { key: string; label: string; event: string; favours: "verified agent" | "baseline"; }
const CONTRASTS: Contrast[] = [
  { key: "harmfulPages", label: "Harmful pages (false-fix OR regression)", event: "page was harmed", favours: "verified agent" },
  { key: "regressionPages", label: "Regressions (per page)", event: "page regressed", favours: "verified agent" },
  { key: "falseFix", label: "False-fixes (per issue)", event: "issue shipped as fixed but still broken", favours: "verified agent" },
  { key: "trueFix", label: "True-fixes (per issue)", event: "issue genuinely fixed", favours: "baseline" },
];

function contrastRows(mc: Record<string, { b: number; c: number; statistic: number; p: number }>): string[] {
  return CONTRASTS.map((k) => {
    const m = mc[k.key];
    if (!m) return "";
    const exact = exactTwoSided(m.b, m.c);
    const dir = m.b === 0 && m.c === 0 ? "no discordant pairs" : `favours **${k.favours}**`;
    const sig = exact < 0.05 ? "**yes**" : "no";
    return `| ${k.label} | ${m.b} | ${m.c} | ${m.statistic.toFixed(3)} | ${fmtP(m.p)} | **${fmtP(exact)}** | ${sig} | ${dir} |`;
  }).filter(Boolean);
}

function main(): void {
  const m27 = read("metrics.json");
  const m45 = read("metrics-wide.json");
  const a27 = read("ablation.json");
  const a45 = read("ablation-wide.json");

  const h27b = m27.harm.harmfulPages.baseline as number;
  const h27a = m27.harm.harmfulPages.advanced as number;
  const n27 = m27.n.pages as number;
  const h45b = m45.harm.harmfulPages.baseline as number;
  const h45a = m45.harm.harmfulPages.advanced as number;
  const n45 = m45.n.pages as number;

  const arr27 = h27b / n27 - h27a / n27;
  const arr45 = h45b / n45 - h45a / n45;

  const md = `# Statistical supplement

Everything here is computed from the **committed** artifacts by
[\`eval/stats-supplement.ts\`](../../eval/stats-supplement.ts) — nothing is re-run and nothing is
hand-entered. Sources: [\`metrics.json\`](metrics.json) (sealed, n=27),
[\`metrics-wide.json\`](metrics-wide.json) (n=45), [\`ablation.json\`](ablation.json),
[\`ablation-wide.json\`](ablation-wide.json).

## 1. Why this file exists: the chi-square in the sealed files is the wrong test at our n

\`src/metrics/stats.ts\` implements McNemar's test with the chi-square approximation and a
continuity correction. That approximation is conventionally considered invalid when the number of
**discordant pairs** \`b+c\` is small (the usual threshold is \`b+c ≥ 25\`); ours are 5 and 6. The
appropriate test is the **exact binomial (sign) test** on the discordant pairs.

We did **not** edit the estimator: the \`mcnemar\` block lives inside the sealed metrics files and
changing it would break the byte-identical reproducibility seal. So the chi-square values remain
published as-is, and the exact test is computed here alongside them. **Where the two disagree, the
exact test is authoritative.** All p-values below are **two-sided**; we report no one-sided values.

Note the exact test is slightly *stronger* for us than what we published — we are correcting a test
choice that was working against us, not toward us.

## 2. Direction matters more than the number — read this before the tables

The convention in \`eval/run-eval.ts\` is uniform: **\`b\` always counts the pairs where the
BASELINE-only event occurred.** But the *event* differs in valence between contrasts, so identical
numbers can mean opposite things:

- For **harm** contrasts the event is a failure, so \`b\` large ⇒ the baseline harmed pages the
  verified agent did not ⇒ **favours the verified agent**.
- For **true-fix** the event is a success, so \`b\` large ⇒ the baseline fixed issues the verified
  agent did not ⇒ **favours the baseline**.

This is not a hypothetical: **the collision occurs in both corpora.**

- \`metrics.json\` (n=${n27}): \`trueFix\` and \`falseFix\` are both \`b=${m27.mcnemar.trueFix.b}, c=${m27.mcnemar.trueFix.c}, χ²=${m27.mcnemar.trueFix.statistic}, p=${fmtP(m27.mcnemar.trueFix.p)}\` — identical, and trueFix favours the baseline while falseFix favours the verified agent.
- \`metrics-wide.json\` (n=${n45}): \`trueFix\` and \`harmfulPages\` are both \`b=${m45.mcnemar.trueFix.b}, c=${m45.mcnemar.trueFix.c}, χ²=${m45.mcnemar.trueFix.statistic}, p=${fmtP(m45.mcnemar.trueFix.p)}\` — likewise opposite.

**Identical \`(b, c, χ², p)\` can carry opposite meaning, so direction is the load-bearing field, not
the p-value.** Every row below states it in words, and we never present bare b/c anywhere.

## 3. Paired tests, both corpora

### Sealed corpus (n=${n27} pages, ${m27.n.issues} issues)

| Contrast | b (baseline-only) | c (advanced-only) | χ² | p (χ², published) | p (exact, authoritative) | sig. at α=.05 | direction |
|---|---|---|---|---|---|---|---|
${contrastRows(m27.mcnemar).join("\n")}

### Extended corpus (n=${n45} pages, ${m45.n.issues} issues) — a SUPERSET of the 27, not a separate study

| Contrast | b (baseline-only) | c (advanced-only) | χ² | p (χ², published) | p (exact, authoritative) | sig. at α=.05 | direction |
|---|---|---|---|---|---|---|---|
${contrastRows(m45.mcnemar).join("\n")}

**Read together:** harm elimination is **significant at n=45** (exact p=${fmtP(exactTwoSided(m45.mcnemar.harmfulPages.b, m45.mcnemar.harmfulPages.c))}) and
directionally identical but **underpowered at n=27** (exact p=${fmtP(exactTwoSided(m27.mcnemar.harmfulPages.b, m27.mcnemar.harmfulPages.c))}, only
${m27.mcnemar.harmfulPages.b + m27.mcnemar.harmfulPages.c} discordant pairs). We do not claim significance on the sealed corpus.
And the coverage contrast is **significant against us** at n=45 — see §5.

> **The most important caveat on this page, stated before anyone else can find it.** The n=45 set is a
> **superset** of the sealed 27 — same 27 pages plus 18 more (\`injected-v2\`), not a second
> independent study. And the 18 additional pages contributed exactly **one** additional discordant
> pair on the harm contrast (b goes ${m27.mcnemar.harmfulPages.b} → ${m45.mcnemar.harmfulPages.b}). Since the exact two-sided p for b=${m27.mcnemar.harmfulPages.b}, c=0 is
> ${fmtP(exactTwoSided(m27.mcnemar.harmfulPages.b, 0))} and for b=${m45.mcnemar.harmfulPages.b}, c=0 is ${fmtP(exactTwoSided(m45.mcnemar.harmfulPages.b, 0))}, **crossing α=0.05 rests on that single extra
> harmed page.** The effect is consistent and one-sided in every measurement we have (c=0 on every
> harm contrast, both corpora), but "significant at n=45" is one page away from "not significant at
> n=27" and we are not going to present it as more than that.

## 4. Effect sizes, not just p-values

| | n=${n27} (sealed) | n=${n45} (extended superset) |
|---|---|---|
| Harmful pages, baseline | ${h27b} — ${ci(h27b, n27)} | ${h45b} — ${ci(h45b, n45)} |
| Harmful pages, verified agent | ${h27a} — ${ci(h27a, n27)} | ${h45a} — ${ci(h45a, n45)} |
| **Absolute risk reduction** | **${(100 * arr27).toFixed(1)} points** | **${(100 * arr45).toFixed(1)} points** |
| Pages per harm avoided (1/ARR) | ~${(1 / arr27).toFixed(1)} | ~${(1 / arr45).toFixed(1)} |
| Harmful changes shipped | ${m27.harm.harmfulChanges.baseline} → ${m27.harm.harmfulChanges.advanced} | ${m45.harm.harmfulChanges.baseline} → ${m45.harm.harmfulChanges.advanced} |

The "pages per harm avoided" figure is an NNT-style reading: put roughly **${(1 / arr45).toFixed(0)} pages**
through the single-shot baseline and you would expect one additional harmed page relative to the
verified agent. Wilson 95% intervals are shown because at these n the point estimates are soft —
note the baseline and advanced intervals do **not** overlap at n=45.

## 5. The coverage trade-off, stated with its accounting

The baseline fixes **more** issues: ${m27.baseline.trueFix} vs ${m27.advanced.trueFix} at n=${n27}, and
${m45.baseline.trueFix} vs ${m45.advanced.trueFix} at n=${n45} — and at n=45 that difference **is statistically
significant in the baseline's favour** (exact p=${fmtP(exactTwoSided(m45.mcnemar.trueFix.b, m45.mcnemar.trueFix.c))}). We are not
going to bury that.

It is not a failure to find fixes; it is **deliberate abstention** under the never-ship-what-you-
can't-verify invariant, and the artifacts account for every forgone issue:

| | n=${n27} | n=${n45} |
|---|---|---|
| Escalated to a human (needs-review) | ${m27.advanced.needsReview} | ${m45.advanced.needsReview} |
| Left unresolved rather than guessed | ${m27.advanced.unresolved} | ${m45.advanced.unresolved} |
| **Total declined** | **${m27.advanced.needsReview + m27.advanced.unresolved}** | **${m45.advanced.needsReview + m45.advanced.unresolved}** |
| Baseline equivalents | ${m27.baseline.needsReview + m27.baseline.unresolved} | ${m45.baseline.needsReview + m45.baseline.unresolved} |

So the quantified trade is: **forgo ${m45.advanced.needsReview + m45.advanced.unresolved} issues of automatic coverage,
eliminate ${m45.harm.harmfulChanges.baseline} harmful changes across ${m45.harm.harmfulPages.baseline} harmed pages** — both effects significant at n=45,
in opposite directions. A measured trade-off is the honest result; a clean sweep would not be.

## 6. The ablation as dose-response evidence

Three **nested** verification conditions, each strictly containing the last, scored by the same
full A/B/C harness — false-fix pages shipped:

| Verify gate | n=${n27} (sealed) | n=${n45} (extended superset) |
|---|---|---|
| \`{A}\` scanner only | ${a27.rows["{A}"].falseFixPages} | ${a45.rows["{A}"].falseFixPages} |
| \`{A,B}\` + screen-reader/keyboard | ${a27.rows["{A,B}"].falseFixPages} | ${a45.rows["{A,B}"].falseFixPages} |
| \`{A,B,C}\` + semantic | ${a27.rows["{A,B,C}"].falseFixPages} | ${a45.rows["{A,B,C}"].falseFixPages} |

The relationship is **monotone in verification depth and holds on both the sealed 27 and the extended 45**. We are
careful about what this is: a dose-response pattern across nested conditions, **not a formal
statistical test** — we run no trend test and claim no p-value for it. But it does not depend on
discordant-pair counts, which is precisely why we treat it as our strongest evidence at this n: a
single p-value can be an artifact of five pairs; a monotone gradient that holds when the corpus is extended by 18 differently-generated pages is much
harder to explain away. (It is the same gradient measured twice on nested sets, not two independent
studies — see the caveat in §3.)

## 7. Power and limitations

- **Underpowered sealed corpus.** n=27 with ${m27.mcnemar.harmfulPages.b + m27.mcnemar.harmfulPages.c} discordant pairs on the
  headline contrast. With c=0, the *smallest attainable* two-sided exact p at b=5 is 0.0625 — the
  sealed corpus **cannot** reach α=0.05 on this contrast no matter how one-sided the result. That is
  a property of the design, not a finding.
- **Not two independent studies.** n=45 is a **superset** of n=27 (adversarial + injected + the 18
  new injected-v2 pages), so the two rows are nested measurements, not replications in the strict
  sense. Both corpora are adversarial-by-construction, built to isolate what scanners miss, so the
  gap percentages characterize the corpora, not field prevalence.
- **The extension is larger but still ours.** injected-v2 was generated by us, by a different
  procedure than the original injected bucket. It adds differently-constructed pages; it is not an
  external dataset, and it does not make n=45 independent of n=27.
- **Single-annotator κ.** The Layer-C judge's κ=0.98 is agreement with one team-authored anchor set —
  a calibration check, not inter-annotator reliability.
- **The 20-site real-world audit is detection-only.** No fixes were applied to sites we don't own, so
  it carries no controlled comparison and none of the numbers above.
- **No human-user validation.** Layer B is a deterministic virtual-screen-reader simulation, not a
  study with screen-reader users.

## 8. Traceability

| Claim | Source |
|---|---|
| gap ${m27.gap.gapPctOfACleanPages} (n=27) / ${m45.gap.gapPctOfACleanPages} (n=45) | \`metrics.json\` → \`gap\`, \`metrics-wide.json\` → \`gap\` |
| harm ${m27.harm.harmfulChanges.baseline} → ${m27.harm.harmfulChanges.advanced} (n=27), ${m45.harm.harmfulChanges.baseline} → ${m45.harm.harmfulChanges.advanced} (n=45) | \`harm.harmfulChanges\` in each |
| harmful-page rates + Wilson CIs | \`harm.harmfulPageRate\` in each |
| χ² p-values | \`mcnemar\` block in each (published, unedited) |
| exact p-values, ARR, NNT | computed here from those same b/c values |
| ablation ${a27.rows["{A}"].falseFixPages}→${a27.rows["{A,B}"].falseFixPages}→${a27.rows["{A,B,C}"].falseFixPages} / ${a45.rows["{A}"].falseFixPages}→${a45.rows["{A,B}"].falseFixPages}→${a45.rows["{A,B,C}"].falseFixPages} | \`ablation.json\`, \`ablation-wide.json\` → \`rows\` |
| coverage ${m27.baseline.trueFix} vs ${m27.advanced.trueFix} / ${m45.baseline.trueFix} vs ${m45.advanced.trueFix}, abstentions | \`baseline\`/\`advanced\` → \`trueFix\`, \`needsReview\`, \`unresolved\` |
`;

  writeFileSync(join(RESULTS, "STATISTICS.md"), md, "utf8");
  console.log("Wrote docs/results/STATISTICS.md");
  console.log(`exact harmfulPages n=27: ${exactTwoSided(m27.mcnemar.harmfulPages.b, m27.mcnemar.harmfulPages.c).toFixed(5)}`);
  console.log(`exact harmfulPages n=45: ${exactTwoSided(m45.mcnemar.harmfulPages.b, m45.mcnemar.harmfulPages.c).toFixed(5)}`);
  console.log(`exact trueFix n=45 (favours BASELINE): ${exactTwoSided(m45.mcnemar.trueFix.b, m45.mcnemar.trueFix.c).toFixed(5)}`);
  console.log(`ARR n=45: ${(100 * arr45).toFixed(1)} points; NNT ~${(1 / arr45).toFixed(1)} pages`);
}

main();
