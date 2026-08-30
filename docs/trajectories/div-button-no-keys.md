# Trajectory — `div-button-no-keys`

_[← all traces, and what each one shows](README.md)_

**How to read this.** Layers: **A** mechanical (axe + pa11y) · **B** behavioural
(screen-reader / keyboard) · **C** semantic (is the alt/label actually meaningful).
Strategies: **rule** = deterministic code fix · **llm** = model-generated fix ·
**checkpoint** = escalated to a human instead of guessed. Every candidate passes a
regression **guard** (rejects deleting or hiding content) and then a **verify** re-scan;
only a candidate that resolves its target and adds no new findings is committed.

**Detected issues (A/B/C tool output):**

- `B` [2.1.1] Custom control (role="button") is focusable but has no keyboard activation handler (click only), so Enter/Space do nothing. — `body > main > div > div:nth-of-type(1) > div:nth-of-type(1)`
- `B` [2.1.1] Custom control (role="button") is focusable but has no keyboard activation handler (click only), so Enter/Space do nothing. — `body > main > div > div:nth-of-type(2) > div:nth-of-type(1)`
- `B` [2.1.1] Custom control (role="button") is focusable but has no keyboard activation handler (click only), so Enter/Space do nothing. — `body > main > div > div:nth-of-type(3) > div:nth-of-type(1)`

**Agent decisions:**

### B [2.1.1] `body > main > div > div:nth-of-type(1) > div:nth-of-type(1)` → **true-fix** (llm)
- attempt 1: LLM targeted fix → guard ok · verify: target resolved, new findings [none] → **ACCEPT**

### B [2.1.1] `body > main > div > div:nth-of-type(2) > div:nth-of-type(1)` → **true-fix** (rule)
- resolved by an earlier fix

### B [2.1.1] `body > main > div > div:nth-of-type(3) > div:nth-of-type(1)` → **true-fix** (rule)
- resolved by an earlier fix

**Shipped result:** Layer A 0 · Layer B 0 · Layer C 0
