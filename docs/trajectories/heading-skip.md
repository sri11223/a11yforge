# Trajectory — `heading-skip`

**Detected issues (A/B/C tool output):**

- `B` [1.3.1] Heading outline skips a level: <h1> is followed by <h4> (levels 2..3 are skipped), so screen-reader heading navigation is broken. — `body > main > h4:nth-of-type(1)`

**Agent decisions:**

### B [1.3.1] `body > main > h4:nth-of-type(1)` → **true-fix** (llm)
- attempt 1: LLM targeted fix → guard ok · verify: target resolved, new findings [none] → **ACCEPT**

**Shipped result:** Layer A 0 · Layer B 0 · Layer C 0
