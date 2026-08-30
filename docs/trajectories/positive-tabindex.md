# Trajectory — `positive-tabindex`

_[← all traces, and what each one shows](README.md)_

**How to read this.** Layers: **A** mechanical (axe + pa11y) · **B** behavioural
(screen-reader / keyboard) · **C** semantic (is the alt/label actually meaningful).
Strategies: **rule** = deterministic code fix · **llm** = model-generated fix ·
**checkpoint** = escalated to a human instead of guessed. Every candidate passes a
regression **guard** (rejects deleting or hiding content) and then a **verify** re-scan;
only a candidate that resolves its target and adds no new findings is committed.

**Detected issues (A/B/C tool output):**

- `B` [2.4.3] Keyboard focus order does not follow DOM/reading order (likely positive tabindex). Tab order: body > header > a, body > header > nav > a:nth-of-type(1), body > header > nav > a:nth-of-type(2), body > header > nav > a:nth-of-type(3), body > footer > p > a, body > main > form > div:nth-of-type(1) > div:nth-of-type(1) > input, body > main > form > div:nth-of-type(4) > textarea, body > main > form > div:nth-of-type(1) > div:nth-of-type(2) > input, body > main > form > div:nth-of-type(2) > input, body > main > form > div:nth-of-type(3) > select, body > main > form > button. DOM order: body > header > a, body > header > nav > a:nth-of-type(1), body > header > nav > a:nth-of-type(2), body > header > nav > a:nth-of-type(3), body > main > form > div:nth-of-type(1) > div:nth-of-type(1) > input, body > main > form > div:nth-of-type(1) > div:nth-of-type(2) > input, body > main > form > div:nth-of-type(2) > input, body > main > form > div:nth-of-type(3) > select, body > main > form > div:nth-of-type(4) > textarea, body > main > form > button, body > footer > p > a. — `html > body`

**Agent decisions:**

### B [2.4.3] `html > body` → **true-fix** (llm)
- attempt 1: LLM targeted fix → guard ok · verify: target resolved, new findings [none] → **ACCEPT**

**Shipped result:** Layer A 0 · Layer B 0 · Layer C 0
