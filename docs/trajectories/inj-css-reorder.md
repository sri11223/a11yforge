# Trajectory — `inj-css-reorder`

**Detected issues (A/B/C tool output):**

- `B` [1.3.2] Visual order differs from DOM/reading order: children are shown in a different sequence (via CSS 'order') than a screen reader reads them, distorting meaning. — `body > main > div`

**Agent decisions:**

### B [1.3.2] `body > main > div` → **true-fix** (llm)
- attempt 1: LLM targeted fix → guard ok · verify: target resolved, new findings [none] → **ACCEPT**

**Shipped result:** Layer A 0 · Layer B 0 · Layer C 0
