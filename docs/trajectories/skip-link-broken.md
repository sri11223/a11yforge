# Trajectory — `skip-link-broken`

**Detected issues (A/B/C tool output):**

- `B` [2.4.1] In-page/skip link points to "#main-content" but no element with that id exists, so activating it does not move focus (bypass fails). — `body > a`

**Agent decisions:**

### B [2.4.1] `body > a` → **true-fix** (llm)
- attempt 1: LLM targeted fix → guard ok · verify: target resolved, new findings [none] → **ACCEPT**

**Shipped result:** Layer A 0 · Layer B 0 · Layer C 0
