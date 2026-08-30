# A11yForge — Improvement Changelog (baseline → advanced)

The measured story, with evidence. All numbers are reproduced offline from committed
cassettes (`A11YFORGE_MODE=replay`); the machine-readable source is
[`docs/results/metrics.json`](results/metrics.json) and [`docs/results/ablation.json`](results/ablation.json).

**Corpus:** 27 pages — 15 adversarial (built to pass axe but fail real use) + 12 injected
(clean templates, one fairly-fixable violation each). **46 detected issues.**

## Three numbers

1. **Gap = 95.8%.** Of the 24 pages a scanner calls clean (zero WCAG violations), **23
   still fail** the screen-reader/keyboard layer (B) or the semantic layer (C).
   Scanner-clean ≠ usable, proven.
2. **Harm shipped: baseline 8 → advanced 0.** The baseline ships **6 regressions + 2
   false-fixes = 8 harmful changes**; the advanced agent ships **zero**. That is what the
   verify-loop and the regression guard buy.
3. **Integrity: 2 escalations, 0 guesses.** Where an alt cannot be grounded in the page's
   own markup, the advanced agent escalates to a human (needs-review) instead of inventing
   a description — a structural invariant, not a preference.

## The clearest argument for verification

A **strong** base model (claude-sonnet-5), fixing one shot, introduced **6 regressions** —
it broke six things elsewhere on the pages it "fixed", because it never re-checks its own
work. The advanced agent runs the identical model with the identical prompt, but re-verifies
every fix across A/B/C and guards against content loss: **0 regressions.** One model, one
prompt — the only difference is verification.

## Baseline → Advanced

Same model (`claude-sonnet-5`), same prompt, same seed. The only difference is the
pipeline: the baseline is one shot; the advanced agent routes, verifies every fix across
A/B/C, guards against content-destruction, and escalates what it cannot ground.

| Metric (n=46 issues, 27 pages) | Baseline | Advanced |
|---|---|---|
| true-fix issues | 44 | 42 |
| **false-fix issues** | **2** | **0** |
| needs-review (honest escalation) | 0 | 2 |
| unresolved | 0 | 2 |
| **regressions introduced** | **6** | **0** |
| **false-fix pages** | **4** | **0** |
| true-fix pages | 22 | 23 |
| false-fix rate (Wilson 95% CI) | 4.3% [1.2, 14.5] | 0.0% [0.0, 7.7] |

**Read it honestly:** the base model is strong, so raw true-fix count is close (44 vs 42 —
the advanced agent *chooses* to escalate 2 rather than guess). The win is **integrity**:
the advanced agent ships **zero false-fixes and zero regressions**, where the baseline ships
**8 harmful changes (2 false-fixes + 6 regressions) across 5 distinct pages — 18.5% of the
corpus** (Wilson 95% CI [8.2, 36.7]). Advanced's harmful-page rate: 0% [0.0, 12.5].

### The 4 false-fixes the baseline shipped (and what advanced did)

- **icon-only-control** & **inj-icon-focus** — the baseline upgraded the icon controls to
  real buttons (fixing keyboard operability) but their state text now updates in a
  **non-live region** (WCAG 4.1.3). axe says clean; a screen-reader user hears nothing.
  → *Advanced re-ran Layer B, saw it, and only committed a verified-clean fix.*
- **alt-generic** & **informative-emptied** — the baseline replaced generic/empty alt with
  **confident, fabricated descriptions** for images it never saw (no caption/heading to
  ground them). axe, the deterministic backstops, and even the (also-blind) LLM judge all
  wave these through.
  → *Advanced escalated both to **needs-review** with the original alt untouched — it never
  invents alt. This is the Hot Take enforced as an invariant.*

## Ablation — does each verification layer earn its place?

Advanced verify-loop gated at increasing depth; every shipped output judged by the full
A/B/C harness. A shallower gate cannot see or verify the layers it omits, so it ships
false-compliances a deeper gate catches.

| Verify gate | false-fix pages shipped | true-fix pages | needs-review |
|---|---|---|---|
| **{A}** (scanner-only) | **23** | 2 | 0 |
| **{A,B}** (+ screen-reader/keyboard) | **9** | 16 | 0 |
| **{A,B,C}** (+ semantic) | **0** | 23 | 2 |

Adding **Layer B catches 14** false-compliances the scanner-only gate shipped; adding
**Layer C catches 9** more. Each layer earns its place: a scanner-only verify gate ships
**23 of 27 pages** as "compliant" while they are still broken; the full stack ships **zero**.

## What each layer uniquely contributes ("not just an axe wrapper")

The sealed corpus encodes **30 ground-truth barriers**. Only **2** are things a scanner catches;
the other **28** are in classes an automated scanner *structurally cannot* detect:

| Layer | Class it owns | Corpus barriers | On 20 real sites |
|---|---|---|---|
| **A** — axe + pa11y | mechanical WCAG (missing/placeholder labels) | 2 | 552 |
| **B** — virtual-SR + CDP | keyboard traps, focus/reading order, operability, live regions, skip links, headings | 17 | 109* |
| **C** — judge + backstops | meaningfulness of alt/labels (generic, filename, contradicting, decorative) | 11 | 97 |

So **28 of 30** corpus barriers — and 206 of the real-site findings — are beyond axe entirely.
(*Layer B = 109 includes 65 from stripe.com alone, all one class — WCAG 4.1.3 dynamic-content-
without-live-region on its animated homepage; excluding it, Layer B = 44 / hidden = 141 across the
other 19 sites. Real-site totals are a 2026-08-30 live snapshot.)
*Honest limits:* these are per-layer **class** counts (from the committed corpus manifests + the
20-site run); the committed data does not split Layer A into axe-vs-pa11y or Layer C into
backstop-vs-judge at the finding level, so we don't claim those sub-splits. *Layer B on real sites
is a lower bound (large-DOM/CSP timeouts — see the real-world report).

## The trade-off, stated plainly

Advanced true-fixes **42** issues vs the baseline's **44**. That is not a loss — it is the
thesis. The advanced agent *refuses* to ship the 2 alt "fixes" it cannot verify and flags
them for a human instead. "Fixes slightly fewer, breaks nothing, never guesses" is the
honest posture; the baseline's 2 extra "fixes" are exactly the fabricated descriptions that
should never have shipped.

## Significance (honest, small-n)

Paired McNemar (n=27 pages, 46 issues). Advanced ships zero harm, so every discordant pair
is baseline-only (c=0):

| Contrast | b (base-only) | c (adv-only) | χ² | p | significant (α=.05)? |
|---|---|---|---|---|---|
| harmful pages (false-fix OR regression) | 5 | 0 | 3.20 | **0.074** | no — trend |
| regressions (per page) | 3 | 0 | 1.33 | 0.248 | no |
| false-fix (per issue) | 2 | 0 | 0.50 | 0.480 | no |
| true-fix (per issue) | 2 | 0 | 0.50 | 0.480 | no |

Harmful-page rate (Wilson 95% CI): baseline **18.5% [8.2, 36.7]** → advanced **0.0% [0.0, 12.5]**.

**We do not overclaim. None of these reach α=0.05 at n=27** — the strongest (harmful pages)
lands at p=0.074, a trend, not significance. McNemar simply cannot certify an effect when
there are only a handful of discordant pairs, no matter how one-sided (b=5, c=0). What the
evidence shows unambiguously and consistently: baseline ships **8 harmful changes across 5
pages**; advanced ships **0**, with a Wilson upper bound of 12.5%. The direction is not in
doubt; the corpus is simply too small for a significance stamp, and the honest read is
"strong, consistent, directionally clear, not yet statistically significant — widen the
corpus to confirm." The **ablation** (below/above), which does not depend on discordant-pair
counts, is the more decisive per-layer evidence.

## Robustness at scale (45 pages) — supplementary

The 27-page result above is the **headline**: determinism-proven and byte-reproducible in
Docker. Taking our own "widen the corpus to confirm" seriously, we re-ran the identical harness
on **45 pages / 68 issues** (adversarial + injected + 18 new fair-injected pages). Wide artifacts
live in [`docs/results/metrics-wide.json`](results/metrics-wide.json) and
[`docs/results/ablation-wide.json`](results/ablation-wide.json); the sealed 27-page files are
untouched.

| Metric (n=45 pages, 68 issues) | Baseline | Advanced |
|---|---|---|
| gap (axe-clean pages still failing B/C) | 38 / 39 = **97.4%** | — |
| harmful pages (false-fix OR regression) | **6 (13.3%)** | **0 (0.0%)** |
| false-fix issues | 2 | 0 |
| regressions | 8 | 0 |
| true-fix issues | 66 | 60 |
| needs-review (honest escalation) | 0 | 4 |

Gated ablation at scale: false-fix pages **{A}=38 → {A,B}=13 → {A,B,C}=0** (Layer B catches
**25** false-compliances, Layer C catches **13**). The full stack ships **zero** broken pages and
escalates 4 to a human.

**Significance, honestly.** At n=45 the harmful-page contrast becomes significant — McNemar
b=6, c=0, χ²=4.17, **p=0.041**. We flag two caveats and do **not** headline it: (1) it is measured
on our own constructed benchmark, not in the wild; (2) the crossing of α=0.05 is a *byproduct of a
correctness fix* we made mid-run (below), not of widening-to-chase-p. Conversely, the **cost of
conservatism is real and significant in the baseline's favour**: the baseline true-fixes **6**
issues (McNemar p=0.041) that the advanced agent instead escalates. "Fixes fewer, ships zero
broken pages" is the trade, stated plainly.

**The self-catch (our thesis, on us).** Widening the corpus caught *our own agent* silently
shipping a scanner-clean-but-broken page: two `not-focusable` keyboard controls it could not fix
were left in the output as A-clean **with no flag** — precisely the failure this project exists to
expose. We fixed it by principle, not patch: **"escalate what you can't verify" is now a universal
invariant** — any issue still failing B/C after the verify-loop is routed to a human, never shipped
silently (it previously applied only to ungrounded alt). The fix moved advanced's harmful pages
from 2 → 0 on the wide corpus and is **byte-identical on the sealed 27-page corpus** (the bug never
manifested there), so the determinism-proven headline result is unaffected.

## Related work — independent convergence

Three 2025–26 papers independently converged on parts of this design while we were building; the
full comparison table (theirs vs our deltas) is in [`report.html`](report.html#related) and
[`README`](../README.md#related-work--independent-convergence-and-how-we-differ). Summary:

- **Verified Repair** ([arXiv:2608.24913](https://arxiv.org/abs/2608.24913), Wanscher et al.) — the
  closest work: independently invented an accept-only-if-violations-strictly-decrease loop and a
  seeded-violation benchmark. **It also corroborates our central claim from the outside:** their
  dual-condition protocol found unverified generation *improved and regressed pages at similar
  rates* (24 improvements vs 20 regressions). They are CSS-only; we repair HTML/ARIA/alt and add
  the CDP a11y-tree, screen-reader-transcript and calibrated-judge layers, plus a published κ
  (they report no inter-rater statistic) and replay against a real LLM fixer (they used stub
  generators).
- **AccessGuru** ([arXiv:2507.19549](https://arxiv.org/abs/2507.19549), Fathallah et al.) — their
  Syntactic/Semantic/Layout taxonomy parallels our mechanical/semantic/behavioral routing
  (acknowledged, not claimed as ours); we add the pre-commit regression guard and the
  grounded-or-escalate alt rule.
- **A11YRepair** ([arXiv:2606.21926](https://arxiv.org/abs/2606.21926), Huang et al., ASE 2026) —
  repo-level repair with patches merged into major open-source projects. **Our honest scope limit:**
  A11yForge is single-page; our contribution is verification depth per fix, not repair breadth.

## Calibration

The Layer C semantic judge is calibrated against a 64-item expert anchor set:
**Cohen's κ = 0.9792** (category) / **1.0** (binary) → hard gate ≥ 0.6. Reproduces offline.
_Honest scope: this is judge-vs-expert-labels agreement on a **single-annotator, team-authored**
anchor set — a calibration check that the judge tracks our labels, **not** an inter-annotator
reliability study._

## Experiments we removed (kept for honesty)

- **Layer C → LLM fixes.** An early advanced router sent semantic alt to the LLM; it
  cheerfully invented descriptions for images it couldn't see. We removed it and made alt
  **rule-from-grounding-or-escalate**, so hallucination is structurally impossible, not
  merely discouraged.
- **pa11y warnings/notices in Layer A.** They fired spuriously on the scanner-invisible
  pages and would have destroyed the gap proof; Layer A counts definite failures only.
- **axe best-practice rules.** Excluded uniformly (they'd let the scanner take credit for
  issues it only heuristically hints at). Consequence: heading-skip is a Layer-B catch, not
  Layer-A — a stronger, more honest result.
