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

## Calibration

The Layer C semantic judge is calibrated against a 64-item expert anchor set:
**Cohen's κ = 0.9792** (category) / **1.0** (binary) → hard gate. Reproduces offline.

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
