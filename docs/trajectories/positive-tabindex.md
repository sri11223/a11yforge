# Trajectory — `positive-tabindex`

**Detected issues (A/B/C tool output):**

- `B` [2.4.3] Keyboard focus order does not follow DOM/reading order (likely positive tabindex). Tab order: body > header > a, body > header > nav > a:nth-of-type(1), body > header > nav > a:nth-of-type(2), body > header > nav > a:nth-of-type(3), body > footer > p > a, body > main > form > div:nth-of-type(1) > div:nth-of-type(1) > input, body > main > form > div:nth-of-type(4) > textarea, body > main > form > div:nth-of-type(1) > div:nth-of-type(2) > input, body > main > form > div:nth-of-type(2) > input, body > main > form > div:nth-of-type(3) > select, body > main > form > button. DOM order: body > header > a, body > header > nav > a:nth-of-type(1), body > header > nav > a:nth-of-type(2), body > header > nav > a:nth-of-type(3), body > main > form > div:nth-of-type(1) > div:nth-of-type(1) > input, body > main > form > div:nth-of-type(1) > div:nth-of-type(2) > input, body > main > form > div:nth-of-type(2) > input, body > main > form > div:nth-of-type(3) > select, body > main > form > div:nth-of-type(4) > textarea, body > main > form > button, body > footer > p > a. — `html > body`

**Agent decisions:**

### B [2.4.3] `html > body` → **true-fix** (llm)
- attempt 1: LLM targeted fix → guard ok · verify: target resolved, new findings [none] → **ACCEPT**

**Shipped result:** Layer A 0 · Layer B 0 · Layer C 0
