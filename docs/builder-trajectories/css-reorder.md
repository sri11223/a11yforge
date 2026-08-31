# Trajectory — `css-reorder`

_[← all traces, and what each one shows](README.md)_

**How to read this.** Layers: **A** mechanical (axe + pa11y) · **B** behavioural
(screen-reader / keyboard) · **C** semantic (is the alt/label actually meaningful).
Strategies: **rule** = deterministic code fix · **llm** = model-generated fix ·
**checkpoint** = escalated to a human instead of guessed. Every candidate passes a
regression **guard** (rejects deleting or hiding content) and then a **verify** re-scan;
only a candidate that resolves its target and adds no new findings is committed.

**The instructions behind these decisions.** Fixer system prompt:
[`src/agents/fix-prompt.ts`](../../src/agents/fix-prompt.ts) · routing table:
[`src/agents/router.ts`](../../src/agents/router.ts) (`DECISION_TABLE`) · Layer-C judge
prompt: [`src/layers/layerC-judge.ts`](../../src/layers/layerC-judge.ts) (`JUDGE_SYSTEM`),
whose own verdicts are traced in [`judge-verdicts.md`](judge-verdicts.md).

**Detected issues (A/B/C tool output):**

_**Partial detection.** `manifest.json` seeds 2 barrier(s) on this page and the
layers surfaced 1. Not surfaced:
WCAG 2.4.3 (`focus-order-mismatch`, expected layer B).
The fix below may resolve it in passing, but it was never detected, so nothing verified it._

- `B` [1.3.2] Visual order differs from DOM/reading order: children are shown in a different sequence (via CSS 'order') than a screen reader reads them, distorting meaning. — `body > main > section`

**Agent decisions:**

### B [1.3.2] `body > main > section` → **true-fix** (llm)
- attempt 1: LLM targeted fix → guard ok · verify: target resolved, new findings [none] → **ACCEPT**

**Shipped result:** Layer A 0 · Layer B 0 · Layer C 0
