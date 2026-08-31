# Traces for every agent we used

A11yForge involves several agents; this is the one place to see the complete trace picture.

## 1. Runtime agent — the advanced remediation agent

Per-page decision traces: **detect** (A/B/C tool output) → **route** → **fix attempt(s)** →
**regression guard** → **verify** → **accept/escalate** → **outcome**. Readable Markdown + machine
JSONL for **every one of the 27 pages the scored eval runs** (100 events total) —
including the boring ones, labelled as such. Memory is shared within a bucket, exactly as in the
scored eval, so these traces reflect what the eval actually did.

**Start here** — the traces that prove the thesis, one per distinct capability:
- [`icon-only-control`](icon-only-control.md) — **reflexion**: 1 rejected attempt(s) before accept; **memory hit** ×1 (repeat signature reused)
- [`alt-generic`](alt-generic.md) — **escalated 1** to a human (not groundable / not verifiable); **memory hit** ×3 (repeat signature reused)
- [`inj-form-label`](inj-form-label.md) — 1 left unresolved

_3 entries, not four: each has to show a capability the ones above it do not, and in this run the regression guard never fired — see the honest gap below._

**All 27 pages:**

| Page | Bucket | Detected | Why this trace is worth reading | Outcomes |
|---|---|---|---|---|
| [`alt-generic`](alt-generic.md) · [jsonl](alt-generic.jsonl) | adversarial | 4 | **escalated 1** to a human (not groundable / not verifiable); **memory hit** ×3 (repeat signature reused) | true-fix, needs-review, true-fix, true-fix |
| [`alt-is-filename`](alt-is-filename.md) · [jsonl](alt-is-filename.jsonl) | adversarial | 3 | **memory hit** ×2 (repeat signature reused) | true-fix, true-fix, true-fix |
| [`aria-label-contradicts`](aria-label-contradicts.md) · [jsonl](aria-label-contradicts.jsonl) | adversarial | 1 | all fixes accepted first try | true-fix |
| [`color-only-status`](color-only-status.md) · [jsonl](color-only-status.jsonl) | adversarial | 0 | **detection miss** — WCAG 1.4.1 seeded but never surfaced | — |
| [`css-reorder`](css-reorder.md) · [jsonl](css-reorder.jsonl) | adversarial | 1 | **detection miss** — WCAG 2.4.3 seeded but never surfaced | true-fix |
| [`div-button-no-keys`](div-button-no-keys.md) · [jsonl](div-button-no-keys.jsonl) | adversarial | 3 | all fixes accepted first try | true-fix, true-fix, true-fix |
| [`heading-skip`](heading-skip.md) · [jsonl](heading-skip.jsonl) | adversarial | 1 | all fixes accepted first try | true-fix |
| [`icon-only-control`](icon-only-control.md) · [jsonl](icon-only-control.jsonl) | adversarial | 2 | **reflexion**: 1 rejected attempt(s) before accept; **memory hit** ×1 (repeat signature reused) | true-fix, true-fix |
| [`informative-emptied`](informative-emptied.md) · [jsonl](informative-emptied.jsonl) | adversarial | 1 | **escalated 1** to a human (not groundable / not verifiable) | needs-review |
| [`keyboard-trap-modal`](keyboard-trap-modal.md) · [jsonl](keyboard-trap-modal.jsonl) | adversarial | 3 | all fixes accepted first try | true-fix, true-fix, true-fix |
| [`live-region-missing`](live-region-missing.md) · [jsonl](live-region-missing.jsonl) | adversarial | 1 | all fixes accepted first try | true-fix |
| [`placeholder-as-label`](placeholder-as-label.md) · [jsonl](placeholder-as-label.jsonl) | adversarial | 8 | **memory hit** ×3 (repeat signature reused) | true-fix, true-fix, true-fix, true-fix, true-fix, true-fix, true-fix, true-fix |
| [`positive-tabindex`](positive-tabindex.md) · [jsonl](positive-tabindex.jsonl) | adversarial | 1 | all fixes accepted first try | true-fix |
| [`redundant-alt-decorative`](redundant-alt-decorative.md) · [jsonl](redundant-alt-decorative.jsonl) | adversarial | 1 | all fixes accepted first try | true-fix |
| [`skip-link-broken`](skip-link-broken.md) · [jsonl](skip-link-broken.jsonl) | adversarial | 1 | all fixes accepted first try | true-fix |
| [`inj-alt-filename-heading`](inj-alt-filename-heading.md) · [jsonl](inj-alt-filename-heading.jsonl) | injected | 2 | all fixes accepted first try | true-fix, true-fix |
| [`inj-alt-generic-caption`](inj-alt-generic-caption.md) · [jsonl](inj-alt-generic-caption.jsonl) | injected | 1 | all fixes accepted first try | true-fix |
| [`inj-aria-label-mismatch`](inj-aria-label-mismatch.md) · [jsonl](inj-aria-label-mismatch.jsonl) | injected | 1 | all fixes accepted first try | true-fix |
| [`inj-css-reorder`](inj-css-reorder.md) · [jsonl](inj-css-reorder.jsonl) | injected | 1 | all fixes accepted first try | true-fix |
| [`inj-decorative-alt`](inj-decorative-alt.md) · [jsonl](inj-decorative-alt.jsonl) | injected | 1 | all fixes accepted first try | true-fix |
| [`inj-div-button`](inj-div-button.md) · [jsonl](inj-div-button.jsonl) | injected | 1 | all fixes accepted first try | true-fix |
| [`inj-form-label`](inj-form-label.md) · [jsonl](inj-form-label.jsonl) | injected | 2 | 1 left unresolved | unresolved, true-fix |
| [`inj-heading-skip`](inj-heading-skip.md) · [jsonl](inj-heading-skip.jsonl) | injected | 1 | **memory hit** ×1 (repeat signature reused) | true-fix |
| [`inj-icon-focus`](inj-icon-focus.md) · [jsonl](inj-icon-focus.jsonl) | injected | 1 | **reflexion**: 1 rejected attempt(s) before accept; **memory hit** ×1 (repeat signature reused) | true-fix |
| [`inj-live-region`](inj-live-region.md) · [jsonl](inj-live-region.jsonl) | injected | 2 | 1 left unresolved | unresolved, true-fix |
| [`inj-positive-tabindex`](inj-positive-tabindex.md) · [jsonl](inj-positive-tabindex.jsonl) | injected | 1 | all fixes accepted first try | true-fix |
| [`inj-skip-link`](inj-skip-link.md) · [jsonl](inj-skip-link.jsonl) | injected | 1 | all fixes accepted first try | true-fix |

**Honest gap — what these traces do NOT show:** none of the 27 traces contains a *regression-guard rejection*. In this run the advanced agent's own candidates never tried to delete or hide content, so the guard never had to fire. The guard's value is evidenced two other ways. Indirectly, in the scored eval: the single-shot baseline shipped **6 regressions**, the guarded advanced agent shipped **0** (see [`metrics.json`](../results/metrics.json)). Directly, in [`test/regression-guard.test.ts`](../../test/regression-guard.test.ts): adversarial candidates prove the gate **rejects** four cheat classes — deleting an informative image, demoting a real control to a non-focusable element, removing visible text, and emptying an informative image to `alt=""` — each with its reason string asserted, while **accepting** four legitimate fixes (adding an aria-label, grounding generic alt, upgrading `div[role=button]` to a real `<button>`, and empty alt where a descriptive `<figcaption>` already carries the alternative). Two further tests, originally written to characterize a blind spot, now prove it closed. Distinguishing *missed by the gate but caught downstream* from *not caught anywhere*, per class: **deletion / removed control / removed text** is caught by the gate itself (tested directly); **alt emptying** is caught by the gate inside a figure, and outside one by the **Layer C deterministic backstop** (rule informative-emptied, no LLM) whenever the image is in a figure or its src looks content-bearing (chart|graph|plot|diagram|figure|infographic|map|emission|revenue|data) — residual: a bare, generically-named img outside a figure is covered by neither; **CSS hiding (display:none / visibility:hidden / the hidden attribute) and risky aria-hidden** are **now rejected by the gate** — previously uncovered by the whole stack, and worse than one missed gate because Layer B's visibility filter *drops hidden elements*, so hiding an offending control made its violation "resolve". The snapshot now counts markup-level hiding and rejects any increase, with aria-hidden classified risky (focusable / contains a control / carries text — rejected) vs decorative (text-free non-focusable glyph inside a labelled control — accepted, the recommended pattern our own fixer emits); proven in [test/regression-guard.test.ts](../../test/regression-guard.test.ts), where the two tests that used to document the gap now assert the rejection. Residual, so this isn't read as catching everything: the gate reads markup, not computed style, so hiding via an external stylesheet class would still pass, and the bare generically-named img alt case remains uncovered. Independently, [test/no-hidden-content.test.ts](../../test/no-hidden-content.test.ts) measures **zero** hiding artifacts in our reported numbers — all 27 scored pages and all 85 LLM candidates. We would rather point all of that out than let a reader assume the traces prove something they don't.

**Honest gap — where we did worse than the baseline.** On `inj-form-label` and `inj-live-region` the single-shot baseline shipped a page clean while the advanced agent left it visibly failing Layer A. That is the cost side of the abstention trade-off, and it is a real loss rather than a rounding error: per [`metrics.json`](../results/metrics.json) the baseline true-fixed those pages and we did not. Read these traces knowing the verified agent fixes fewer issues on purpose, and that on these 2 pages "fewer" meant "none".

**Reading a "memory hit":** memory recalls the previously-verified **strategy** (the routing
decision) for a repeat signature — not the patch itself. So a recalled fix can still take more than
one attempt and is always re-verified; memory saves re-derivation, it never skips verification.
(`icon-only-control` is both a memory hit and a 2-attempt reflexion, for exactly that reason.)

**JSONL schema:** a `task` event (detected issues), one `fix` event per finding
(`target`, `strategy`, `iterations[]` with attempt/action/regressionGuard/verify/decision,
`outcome`, `memoryHit`), and a `result` event (`reviewQueue`, `memoryHits`, outcome tally).

**What a screen-reader user hears — real captured narration diff:**
- [narration-diff.md](narration-diff.md) — the Guidepup virtual SR traversing the original vs the shipped DOM on all 27 pages, diffed. 16 pages changed audibly; the 11 that didn't are operability repairs (invisible to a reading-order traversal) and are listed with that reason.

**Deep dives — real model I/O, quoted from the committed cassettes:**
- **Reflexion** — [reflexion-icon-only-control.md](reflexion-icon-only-control.md): a Layer-B fix
  REJECTED on attempt 1, ACCEPTED on attempt 2 after the verifier's diagnostic is fed back.
- **Baseline vs advanced** — [contrast-alt-generic.md](contrast-alt-generic.md): the baseline ships
  a confident hallucinated alt; the advanced agent escalates instead of guessing.

## 2. Runtime LLMs — the raw model traces (`cassettes/`)

Every fixer/judge call is recorded to a content-hashed cassette under
[`../../cassettes/`](../../cassettes) (151 files): the exact request
`{model, temperature, seed, messages}` and the model's `response`. **These ARE the raw model
I/O** — the whole evaluation replays from them offline (`A11YFORGE_MODE=replay`, no API key).
Fixer = `anthropic/claude-sonnet-5`; judge = `openai/gpt-4o-mini` (different families).

151 hash-named files are not a trace a reader can follow, so the judge has a readable one:
[`judge-verdicts.md`](judge-verdicts.md) — its system prompt, six real verdicts quoted from those
cassettes with the gate decision each produced, its κ calibration with the scope limit spelled out,
and **the one anchor item where the judge disagreed with the expert label**, shown rather than
summarised.

## 3. Coding agents — how the repo was built

- [../WORK_TRAJECTORY.md](../WORK_TRAJECTORY.md) — the two-agent (orchestrator + builder) build trace,
  step by step, each backed by a commit.
- [../CODING_AGENT.md](../CODING_AGENT.md) — coding-agent + tool disclosure, and the honest
  experiments we tried and removed.
