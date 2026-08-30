# Trajectory — `inj-div-button`

**Detected issues (A/B/C tool output):**

- `B` [2.1.1] Custom control (role="button") is focusable but has no keyboard activation handler (click only), so Enter/Space do nothing. — `body > main > div:nth-of-type(1)`

**Agent decisions:**

### B [2.1.1] `body > main > div:nth-of-type(1)` → **true-fix** (llm)
- attempt 1: LLM targeted fix → guard ok · verify: target resolved, new findings [none] → **ACCEPT**

**Shipped result:** Layer A 0 · Layer B 0 · Layer C 0
