# Trajectory — `inj-positive-tabindex`

**Detected issues (A/B/C tool output):**

- `B` [2.4.3] Keyboard focus order does not follow DOM/reading order (likely positive tabindex). Tab order: body > header > a, body > header > nav > a:nth-of-type(1), body > header > nav > a:nth-of-type(2), body > main > form > input:nth-of-type(2), body > main > form > input:nth-of-type(1), body > main > form > button. DOM order: body > header > a, body > header > nav > a:nth-of-type(1), body > header > nav > a:nth-of-type(2), body > main > form > input:nth-of-type(1), body > main > form > input:nth-of-type(2), body > main > form > button. — `html > body`

**Agent decisions:**

### B [2.4.3] `html > body` → **true-fix** (llm)
- attempt 1: LLM targeted fix → guard ok · verify: target resolved, new findings [none] → **ACCEPT**

**Shipped result:** Layer A 0 · Layer B 0 · Layer C 0
