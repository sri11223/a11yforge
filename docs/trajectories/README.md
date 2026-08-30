# Traces for every agent we used

A11yForge involves several agents; this is the one place to see the complete trace picture.

## 1. Runtime agent — the advanced remediation agent

Per-page decision traces: **detect** (A/B/C tool output) → **route** → **fix attempt(s)** →
**regression guard** → **verify** → **accept/escalate** → **outcome**. Readable Markdown + machine
JSONL for **every one of the 27 pages the scored eval runs** (100 events total) —
including the boring ones, labelled as such. Memory is shared within a bucket, exactly as in the
scored eval, so these traces reflect what the eval actually did.

**Start here** — the traces that prove the thesis:
- [`icon-only-control`](icon-only-control.md) — **reflexion**: 1 rejected attempt(s) before accept; **memory hit** ×1 (repeat signature reused)
- [`inj-icon-focus`](inj-icon-focus.md) — **reflexion**: 1 rejected attempt(s) before accept; **memory hit** ×1 (repeat signature reused)
- [`alt-generic`](alt-generic.md) — **escalated 1** to a human (not groundable / not verifiable); **memory hit** ×2 (repeat signature reused)
- [`informative-emptied`](informative-emptied.md) — **escalated 1** to a human (not groundable / not verifiable)

**All 27 pages:**

| Page | Bucket | Detected | Why this trace is worth reading | Outcomes |
|---|---|---|---|---|
| [`alt-generic`](alt-generic.md) · [jsonl](alt-generic.jsonl) | adversarial | 4 | **escalated 1** to a human (not groundable / not verifiable); **memory hit** ×2 (repeat signature reused) | true-fix, needs-review, true-fix, true-fix |
| [`alt-is-filename`](alt-is-filename.md) · [jsonl](alt-is-filename.jsonl) | adversarial | 3 | **memory hit** ×2 (repeat signature reused) | true-fix, true-fix, true-fix |
| [`aria-label-contradicts`](aria-label-contradicts.md) · [jsonl](aria-label-contradicts.jsonl) | adversarial | 1 | all fixes accepted first try | true-fix |
| [`color-only-status`](color-only-status.md) · [jsonl](color-only-status.jsonl) | adversarial | 0 | _no findings — nothing to fix_ | — |
| [`css-reorder`](css-reorder.md) · [jsonl](css-reorder.jsonl) | adversarial | 1 | all fixes accepted first try | true-fix |
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

**Honest gap — what these traces do NOT show:** none of the 27 traces contains a *regression-guard rejection*. In this run the advanced agent's own candidates never tried to delete or hide content, so the guard never had to fire. The guard's value is evidenced two other ways. Indirectly, in the scored eval: the single-shot baseline shipped **6 regressions**, the guarded advanced agent shipped **0** (see [`metrics.json`](../results/metrics.json)). Directly, in [`test/regression-guard.test.ts`](../../test/regression-guard.test.ts): adversarial candidates prove the gate **rejects** four cheat classes — deleting an informative image, demoting a real control to a non-focusable element, removing visible text, and emptying an informative image to `alt=""` — each with its reason string asserted, while **accepting** four legitimate fixes (adding an aria-label, grounding generic alt, upgrading `div[role=button]` to a real `<button>`, and empty alt where a descriptive `<figcaption>` already carries the alternative). Two further tests characterize what this gate does **not** catch. Distinguishing *missed by the gate but caught downstream* from *not caught anywhere*, per class:

- **Deletion / removed control / removed text** — caught by the gate itself (tested directly above).
- **`alt` emptying (informative→decorative laundering)** — caught by the gate when the image is inside a `<figure>`; outside a figure the gate misses it, but the **Layer C deterministic backstop** (rule `informative-emptied`, no LLM involved) still catches it whenever the image is in a `<figure>` *or* its `src` looks content-bearing (`chart|graph|plot|diagram|figure|infographic|map|emission|revenue|data`). Residual: a bare, generically-named `<img>` outside a figure is covered by neither.
- **CSS hiding (`display:none` / `visibility:hidden` / `hidden`) and `aria-hidden`** — **not caught anywhere in the stack**, and we should own that it is worse than a single missed gate: Layer B's visibility filter *drops hidden elements*, so hiding an offending control makes its violation "resolve" across the whole pipeline. This is a genuine hole in "never ship a fix you can't verify."

We would rather point all of that out than let a reader assume the traces prove something they don't.

**Reading a "memory hit":** memory recalls the previously-verified **strategy** (the routing
decision) for a repeat signature — not the patch itself. So a recalled fix can still take more than
one attempt and is always re-verified; memory saves re-derivation, it never skips verification.
(`icon-only-control` is both a memory hit and a 2-attempt reflexion, for exactly that reason.)

**JSONL schema:** a `task` event (detected issues), one `fix` event per finding
(`target`, `strategy`, `iterations[]` with attempt/action/regressionGuard/verify/decision,
`outcome`, `memoryHit`), and a `result` event (`reviewQueue`, `memoryHits`, outcome tally).

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

## 3. Coding agents — how the repo was built

- [../WORK_TRAJECTORY.md](../WORK_TRAJECTORY.md) — the two-agent (orchestrator + builder) build trace,
  step by step, each backed by a commit.
- [../CODING_AGENT.md](../CODING_AGENT.md) — coding-agent + tool disclosure, and the honest
  experiments we tried and removed.
