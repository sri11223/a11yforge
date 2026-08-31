# Trajectory — `color-only-status`

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

_None — and that is a **detection miss, not a clean page.** `manifest.json` seeds
WCAG 1.4.1 (`status-color-only`), which no layer surfaced, so the
agent never saw it and could not have fixed it. Published as a trace so the gap is visible
rather than absent._

- **The manifest expected layer C to catch 1.4.1. It did not.**
  Manifest rationale, quoted as the *expectation* rather than as what happened: The status cell contains only a coloured `<span>`. Contrast is fine and there is no non-text-content rule to trip, so axe is clean. Use of Colour (1.4.1) has no reliable automated axe test; Layer C flags that the status carries meaning by colour alone with no text alternative.

**Agent decisions:**

**Shipped result:** Layer A 0 · Layer B 0 · Layer C 0
