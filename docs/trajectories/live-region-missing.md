# Trajectory — `live-region-missing`

**Detected issues (A/B/C tool output):**

- `B` [4.1.3] Content updated dynamically inside an element with no live region (aria-live / role=status), so screen-reader users are not notified of the change. — `body > main > div:nth-of-type(2) > div:nth-of-type(3)`

**Agent decisions:**

### B [4.1.3] `body > main > div:nth-of-type(2) > div:nth-of-type(3)` → **true-fix** (llm)
- attempt 1: LLM targeted fix → guard ok · verify: target resolved, new findings [none] → **ACCEPT**

**Shipped result:** Layer A 0 · Layer B 0 · Layer C 0
