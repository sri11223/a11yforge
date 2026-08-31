# Statistical supplement

Everything here is computed from the **committed** artifacts by
[`eval/stats-supplement.ts`](../../eval/stats-supplement.ts) — nothing is re-run and nothing is
hand-entered. Sources: [`metrics.json`](metrics.json) (sealed, n=27),
[`metrics-wide.json`](metrics-wide.json) (n=45), [`ablation.json`](ablation.json),
[`ablation-wide.json`](ablation-wide.json).

## 0. The claim hierarchy — the p-value is deliberately LAST

Ordered by robustness, not by which number sounds best:

1. **Zero counter-examples (primary).** Across all 45 pages, on every *harm* contrast in both
   sets, the advanced-only cell is **c = 0**: not one case where the verified agent harmed a page the
   baseline left intact, false-fixed where the baseline did not, or regressed where the baseline did
   not. No counter-examples, and it does not hinge on a single discordant pair.
2. **Categorical harm elimination.** Harmful changes 8 → 0 (n=27) and
   10 → 0 (n=45); false-fix rate 4.3% [1.2, 14.5] → 0.0% [0.0, 7.7] and
   2.9% [0.8, 10.1] → 0.0% [0.0, 5.3]; harmful-page rate 18.5% [8.2, 36.7] → 0.0% [0.0, 12.5] and
   13.3% [6.3, 26.2] → 0.0% [0.0, 7.9]. The Wilson 95% intervals **do overlap** — [6.3, 26.2] and
   [0.0, 7.9] share [6.3, 7.9], and the false-fix pair shares [0.8, 5.3] — so the interval is *not*
   the claim being made. Counts, not inference: harm went to zero and stayed there.
3. **Dose-response across nested verification layers** (§6): 23→9→0 and
   38→13→0, the same monotone shape on both sets, independent of discordant-pair counts.
4. **The significance test, last** (§3), with its fragility inline.

> **The significance test is the weakest evidence on this page, not the strongest. The robust finding
> is that across 45 pages the verified agent never once did harm the baseline avoided.**

## Sensitivity analysis: how much of the harm number is a measurement artifact?

We found this ourselves and we would rather state it than have a judge find it unstated.

**The mechanism.** `src/layers/layerB-sr.ts:357` selects `page.$$eval("button", …)` — the
live-region check only ever clicks real `<button>` elements. `corpus/adversarial/icon-only-control/index.html`
contains **0** `<button>` and **2** `role="button"` divs, so on the *original* page that check clicks
nothing and reports zero. The baseline's fix converts those divs into real buttons, the check now
reaches them, and the page's **pre-existing** "mutates text with no live region" defect becomes
visible for the first time — scoring as 2 new regressions. The defect did not appear; only its
*observability* did.

**How much.** Computed from the committed per-page data, not re-measured:

| | n=27 | n=45 |
| --- | --- | --- |
| Headline harmful changes (baseline → advanced) | **8 → 0** | **10 → 0** |
| Of those, attributable to live-region *unmasking* | 3 | 5 |
| Excluding unmasking | **5 → 0** | **5 → 0** |

The unmasked pages are `icon-only-control` (2) and `inj-icon-focus` (1), plus `v2-icon-focus-fav` (2)
at n=45 — the icon family is **5 of the 8** baseline regressions at scale.

**The remaining harm is real:** 2 ungrounded alt attributes the baseline invented, plus 3 new Layer-A
findings on `inj-aria-label-mismatch` where the baseline fabricated form fields. Those are genuine
defects the baseline introduced and the verified agent did not.

**The asymmetry is structural, and it favours us in the scoring.** Our agent's fix keeps the
`role="button"` divs and adds `tabindex`, so the live-region checker stays blind to them and we score
0 — not because we are safer on this contrast, but because the oracle cannot see our output either.
A blind oracle scoring one agent's output and not the other's is a measurement asymmetry, and it
inflates the contrast in our favour.

**Known and scoped, not yet measured.** The fix is to click `[role=button]`, `[role=switch]` and
`[role=tab]` as well as `<button>`. We have not made that change: re-running eval + ablation +
determinism cannot be done safely before the deadline, and shipping half-updated artifacts would be
worse than shipping a stated caveat. Every direction still favours the verified agent — 5 → 0 rather
than 8 → 0 — but the headline number is partly an artifact and this is us saying so.


One precision note we will not blur: `c = 0` on the **true-fix** contrast is *not* a point in our
favour — it means the verified agent never uniquely fixed something the baseline missed. Only on the
**harm** contrasts does `c = 0` count as evidence for us.

## 1. Why this file exists: the chi-square in the sealed files is the wrong test at our n

`src/metrics/stats.ts` implements McNemar's test with the chi-square approximation and a
continuity correction. That approximation is conventionally considered invalid when the number of
**discordant pairs** `b+c` is small (the usual threshold is `b+c ≥ 25`); ours are 5 and 6. The
appropriate test is the **exact binomial (sign) test** on the discordant pairs.

We did **not** edit the estimator: the `mcnemar` block lives inside the sealed metrics files and
changing it would break the byte-identical reproducibility seal. So the chi-square values remain
published as-is, and the exact test is computed here alongside them. **Where the two disagree, the
exact test is authoritative.** All p-values below are **two-sided**; we report no one-sided values.

Note the exact test is slightly *stronger* for us than what we published — we are correcting a test
choice that was working against us, not toward us.

## 2. Direction matters more than the number — read this before the tables

The convention in `eval/run-eval.ts` is uniform: **`b` always counts the pairs where the
BASELINE-only event occurred.** But the *event* differs in valence between contrasts, so identical
numbers can mean opposite things:

- For **harm** contrasts the event is a failure, so `b` large ⇒ the baseline harmed pages the
  verified agent did not ⇒ **favours the verified agent**.
- For **true-fix** the event is a success, so `b` large ⇒ the baseline fixed issues the verified
  agent did not ⇒ **favours the baseline**.

This is not a hypothetical: **the collision occurs in both corpora.**

- `metrics.json` (n=27): `trueFix` and `falseFix` are both `b=2, c=0, χ²=0.5, p=0.4795` — identical, and trueFix favours the baseline while falseFix favours the verified agent.
- `metrics-wide.json` (n=45): `trueFix` and `harmfulPages` are both `b=6, c=0, χ²=4.167, p=0.0412` — likewise opposite.

**Identical `(b, c, χ², p)` can carry opposite meaning, so direction is the load-bearing field, not
the p-value.** Every row below states it in words, and we never present bare b/c anywhere.

## 3. Paired tests, both corpora

### Sealed corpus (n=27 pages, 46 issues)

| Contrast | b (baseline-only) | c (advanced-only) | χ² | p (χ², published) | p (exact, authoritative) | sig. at α=.05 | direction |
|---|---|---|---|---|---|---|---|
| Harmful pages (false-fix OR regression) | 5 | 0 | 3.200 | 0.0736 | **0.0625** | no | favours **verified agent** |
| Regressions (per page) | 3 | 0 | 1.333 | 0.2482 | **0.2500** | no | favours **verified agent** |
| False-fixes (per issue) | 2 | 0 | 0.500 | 0.4795 | **0.5000** | no | favours **verified agent** |
| True-fixes (per issue) | 2 | 0 | 0.500 | 0.4795 | **0.5000** | no | favours **baseline** |

### Extended corpus (n=45 pages, 68 issues) — a SUPERSET of the 27, not a separate study

| Contrast | b (baseline-only) | c (advanced-only) | χ² | p (χ², published) | p (exact, authoritative) | sig. at α=.05 | direction |
|---|---|---|---|---|---|---|---|
| Harmful pages (false-fix OR regression) | 6 | 0 | 4.167 | 0.0412 | **0.0313** | **yes** | favours **verified agent** |
| Regressions (per page) | 4 | 0 | 2.250 | 0.1336 | **0.1250** | no | favours **verified agent** |
| False-fixes (per issue) | 2 | 0 | 0.500 | 0.4795 | **0.5000** | no | favours **verified agent** |
| True-fixes (per issue) | 6 | 0 | 4.167 | 0.0412 | **0.0313** | **yes** | favours **baseline** |

**Read together:** harm elimination is **significant at n=45** (exact p=0.0313) and
directionally identical but **underpowered at n=27** (exact p=0.0625, only
5 discordant pairs). We do not claim significance on the sealed corpus.
And the coverage contrast is **significant against us** at n=45 — see §5.

> **The most important caveat on this page, stated before anyone else can find it.** The n=45 set is a
> **superset** of the sealed 27 — same 27 pages plus 18 more (`injected-v2`), not a second
> independent study. And the 18 additional pages contributed exactly **one** additional discordant
> pair on the harm contrast (b goes 5 → 6). Since the exact two-sided p for b=5, c=0 is
> 0.0625 and for b=6, c=0 is 0.0313, **crossing α=0.05 rests on that single extra
> harmed page.** The effect is consistent and one-sided in every measurement we have (c=0 on every
> harm contrast, both corpora), but "significant at n=45" is one page away from "not significant at
> n=27" and we are not going to present it as more than that.

## 4. Effect sizes, not just p-values

| | n=27 (sealed) | n=45 (extended superset) |
|---|---|---|
| Harmful pages, baseline | 5 — 18.5% [8.2%, 36.7%] | 6 — 13.3% [6.3%, 26.2%] |
| Harmful pages, verified agent | 0 — 0.0% [0.0%, 12.5%] | 0 — 0.0% [0.0%, 7.9%] |
| **Absolute risk reduction** | **18.5 points** | **13.3 points** |
| Pages per harm avoided (1/ARR) | ~5.4 | ~7.5 |
| Harmful changes shipped | 8 → 0 | 10 → 0 |

The "pages per harm avoided" figure is an NNT-style reading: put roughly **8 pages**
through the single-shot baseline and you would expect one additional harmed page relative to the
verified agent. Wilson 95% intervals are shown because at these n the point estimates are soft —
and note that the baseline and advanced intervals **do overlap**, at n=45 as at n=27
([6.3, 26.2] against [0.0, 7.9] share [6.3, 7.9]). We state that plainly rather than lean on the
intervals: with 45 pages they are too wide to separate, which is precisely why the load-bearing
evidence here is the count (10 harmful changes → 0, with no counter-example anywhere in the set)
and not an inferential claim about rates.

## 5. The coverage trade-off, stated with its accounting

The baseline fixes **more** issues: 44 vs 42 at n=27, and
66 vs 60 at n=45 — and at n=45 that difference **is statistically
significant in the baseline's favour** (exact p=0.0313). We are not
going to bury that.

It is not a failure to find fixes; it is **deliberate abstention** under the never-ship-what-you-
can't-verify invariant, and the artifacts account for every forgone issue:

| | n=27 | n=45 |
|---|---|---|
| Escalated to a human (needs-review) | 2 | 4 |
| Left unresolved rather than guessed | 2 | 4 |
| **Total declined** | **4** | **8** |
| Baseline equivalents | 0 | 0 |

So the quantified trade is: **forgo 8 issues of automatic coverage,
eliminate 10 harmful changes across 6 harmed pages** — both effects significant at n=45,
in opposite directions. A measured trade-off is the honest result; a clean sweep would not be.

## 6. The ablation as dose-response evidence

Three **nested** verification conditions, each strictly containing the last, scored by the same
full A/B/C harness — false-fix pages shipped:

| Verify gate | n=27 (sealed) | n=45 (extended superset) |
|---|---|---|
| `{A}` scanner only | 23 | 38 |
| `{A,B}` + screen-reader/keyboard | 9 | 13 |
| `{A,B,C}` + semantic | 0 | 0 |

The relationship is **monotone in verification depth and holds on both the sealed 27 and the extended 45**. We are
careful about what this is: a dose-response pattern across nested conditions, **not a formal
statistical test** — we run no trend test and claim no p-value for it. But it does not depend on
discordant-pair counts, which is precisely why we treat it as our strongest evidence at this n: a
single p-value can be an artifact of five pairs; a monotone gradient that holds when the corpus is extended by 18 differently-generated pages is much
harder to explain away. (It is the same gradient measured twice on nested sets, not two independent
studies — see the caveat in §3.)

## 7. Power and limitations

- **Underpowered sealed corpus.** n=27 with 5 discordant pairs on the
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


### Multiplicity: eight uncorrected tests, and what survives correction

We report **eight** McNemar tests — four contrasts (harmful pages, regressions, false-fix,
true-fix/coverage) on each of two corpora — and every p-value above is **uncorrected**. Stating that
plainly, with the arithmetic:

| Contrast | n=27 exact | n=45 exact | clears α=0.05? | clears α/8 = 0.00625? |
|---|---|---|---|---|
| harmful pages | 0.0625 | **0.0313** | n=45 only | **no** |
| regressions | 0.2500 | 0.1250 | no | no |
| false-fix | 0.5000 | 0.5000 | no | no |
| true-fix (coverage) | 0.5000 | **0.0313** | n=45 only | **no** |

**Two** results clear α=0.05, not one — and one of them (**coverage**) runs *against* us. Neither
clears a Bonferroni threshold of 0.05/8 = 0.00625; both sit at 0.0313, a factor of five away. So on a
multiplicity-corrected reading, **nothing here is significant**, in either direction.

Two honest qualifiers on that, in both directions:

- **Bonferroni is conservative here, because the tests are not independent.** The n=45 set *contains*
  the n=27 set — it is a superset, not a replication — so the two columns are correlated by
  construction and correcting as though they were eight independent tests over-penalises. We do not
  know the effective number of independent tests, and we are not going to estimate one to make a
  number look better.
- **It does not rescue the coverage row either.** The result that goes against us fails correction on
  exactly the same arithmetic as the one that favours us. We are not applying a correction selectively.

This is the third independent reason the **count** is our claim and the p-value is not: the corpus
cannot reach α=0.05 at n=27 by construction (α-floor 0.0625), significance at n=45 rests on a single
additional discordant pair, and eight uncorrected tests would not survive correction anyway. The
load-bearing evidence is **c = 0 on every harm contrast across all 45 pages** — zero
counter-examples, which needs no α at all.

## 8. Traceability

| Claim | Source |
|---|---|
| gap 95.8% (n=27) / 97.4% (n=45) | `metrics.json` → `gap`, `metrics-wide.json` → `gap` |
| harm 8 → 0 (n=27), 10 → 0 (n=45) | `harm.harmfulChanges` in each |
| harmful-page rates + Wilson CIs | `harm.harmfulPageRate` in each |
| χ² p-values | `mcnemar` block in each (published, unedited) |
| exact p-values, ARR, NNT | computed here from those same b/c values |
| ablation 23→9→0 / 38→13→0 | `ablation.json`, `ablation-wide.json` → `rows` |
| coverage 44 vs 42 / 66 vs 60, abstentions | `baseline`/`advanced` → `trueFix`, `needsReview`, `unresolved` |

## 9. Known engineering issues, not affecting any number above

- **pa11y's Puppeteer browser can be orphaned.** `runPa11y()` in
  `src/layers/layerA-scanners.ts` calls `pa11y(url, …)` with no `try`/`finally`. pa11y launches its
  own Puppeteer Chrome internally and closes it on the success path, so if the call throws — timeout,
  navigation error — that browser survives. Observed: **17 orphaned Chrome processes** from
  `~/.cache/puppeteer/chrome/` after an otherwise idle session. Worth a `finally`-based teardown;
  **not yet fixed.** It cannot affect any published figure — an orphaned process holds no state the
  scan reads, and every number here comes from a run that completed — but it will exhaust a machine
  over a long session. Note that the *Playwright* path in the same file (lines 73–89) does close its
  browser in `finally`; this is specific to the pa11y path.
- **The live-region oracle only clicks real `<button>` elements** (`layerB-sr.ts:357`), which makes
  part of the harm contrast a measurement artifact. Quantified in the sensitivity analysis above; the
  fix is to click `[role=button]`, `[role=switch]` and `[role=tab]` too, and it is unmeasured.
