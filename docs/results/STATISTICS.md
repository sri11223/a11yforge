# Statistical supplement

Everything here is computed from the **committed** artifacts by
[`eval/stats-supplement.ts`](../../eval/stats-supplement.ts) — nothing is re-run and nothing is
hand-entered. Sources: [`metrics.json`](metrics.json) (sealed, n=27),
[`metrics-wide.json`](metrics-wide.json) (n=45), [`ablation.json`](ablation.json),
[`ablation-wide.json`](ablation-wide.json).

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

At n=45 both `harmfulPages` and `trueFix` are `b=6, c=0, p=0.041` — *the same triple pointing in
opposite directions*. Every row below therefore states the direction in words.

## 3. Paired tests, both corpora

### Sealed corpus (n=27 pages, 46 issues)

| Contrast | b (baseline-only) | c (advanced-only) | χ² | p (χ², published) | p (exact, authoritative) | sig. at α=.05 | direction |
|---|---|---|---|---|---|---|---|
| Harmful pages (false-fix OR regression) | 5 | 0 | 3.200 | 0.0736 | **0.0625** | no | favours **verified agent** |
| Regressions (per page) | 3 | 0 | 1.333 | 0.2482 | **0.2500** | no | favours **verified agent** |
| False-fixes (per issue) | 2 | 0 | 0.500 | 0.4795 | **0.5000** | no | favours **verified agent** |
| True-fixes (per issue) | 2 | 0 | 0.500 | 0.4795 | **0.5000** | no | favours **baseline** |

### Replication corpus (n=45 pages, 68 issues)

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

## 4. Effect sizes, not just p-values

| | n=27 (sealed) | n=45 (replication) |
|---|---|---|
| Harmful pages, baseline | 5 — 18.5% [8.2%, 36.7%] | 6 — 13.3% [6.3%, 26.2%] |
| Harmful pages, verified agent | 0 — 0.0% [0.0%, 12.5%] | 0 — 0.0% [0.0%, 7.9%] |
| **Absolute risk reduction** | **18.5 points** | **13.3 points** |
| Pages per harm avoided (1/ARR) | ~5.4 | ~7.5 |
| Harmful changes shipped | 8 → 0 | 10 → 0 |

The "pages per harm avoided" figure is an NNT-style reading: put roughly **8 pages**
through the single-shot baseline and you would expect one additional harmed page relative to the
verified agent. Wilson 95% intervals are shown because at these n the point estimates are soft —
note the baseline and advanced intervals do **not** overlap at n=45.

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

| Verify gate | n=27 (sealed) | n=45 (replication) |
|---|---|---|
| `{A}` scanner only | 23 | 38 |
| `{A,B}` + screen-reader/keyboard | 9 | 13 |
| `{A,B,C}` + semantic | 0 | 0 |

The relationship is **monotone in verification depth and replicates on both corpora**. We are
careful about what this is: a dose-response pattern across nested conditions, **not a formal
statistical test** — we run no trend test and claim no p-value for it. But it does not depend on
discordant-pair counts, which is precisely why we treat it as our strongest evidence at this n: a
single p-value can be an artifact of five pairs; a monotone gradient reproduced on two independently
constructed corpora is much harder to explain away.

## 7. Power and limitations

- **Underpowered sealed corpus.** n=27 with 5 discordant pairs on the
  headline contrast. With c=0, the *smallest attainable* two-sided exact p at b=5 is 0.0625 — the
  sealed corpus **cannot** reach α=0.05 on this contrast no matter how one-sided the result. That is
  a property of the design, not a finding.
- **Two corpora, not two samples of the world.** Both are adversarial-by-construction, built to
  isolate what scanners miss. The gap percentages characterize the corpora, not field prevalence.
- **The replication is larger but not independent of us.** injected-v2 was generated by us, by a
  different procedure than the original injected bucket. It is a replication in construction, not an
  external dataset.
- **Single-annotator κ.** The Layer-C judge's κ=0.98 is agreement with one team-authored anchor set —
  a calibration check, not inter-annotator reliability.
- **The 20-site real-world audit is detection-only.** No fixes were applied to sites we don't own, so
  it carries no controlled comparison and none of the numbers above.
- **No human-user validation.** Layer B is a deterministic virtual-screen-reader simulation, not a
  study with screen-reader users.

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
