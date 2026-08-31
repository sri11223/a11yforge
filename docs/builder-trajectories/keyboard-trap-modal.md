# Trajectory — `keyboard-trap-modal`

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

- `B` [2.1.2] Keyboard focus is trapped in the dialog: Tab does not move focus out, Escape does not dismiss it, and there is no keyboard-operable close control. — `body > div > div`
- `B` [2.1.1] Element behaves as a control (has a click handler) but is not keyboard-focusable (no tabindex), so keyboard/screen-reader users cannot reach it. — `body > div > div > span`
- `B` [4.1.2] Control has no meaningful accessible name (announced as "×"), so a screen-reader user cannot tell what it does. — `body > div > div > span`

**Agent decisions:**

### B [2.1.2] `body > div > div` → **true-fix** (llm)
- attempt 1: LLM targeted fix → guard ok · verify: target resolved, new findings [none] → **ACCEPT**

### B [2.1.1] `body > div > div > span` → **true-fix** (no fix of its own — cleared by an earlier change)
- resolved by an earlier fix

### B [4.1.2] `body > div > div > span` → **true-fix** (no fix of its own — cleared by an earlier change)
- resolved by an earlier fix

**Shipped result:** Layer A 0 · Layer B 0 · Layer C 0
