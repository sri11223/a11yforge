# Trajectory — `inj-alt-filename-heading`

**Detected issues (A/B/C tool output):**

- `B` [1.3.1] Heading outline skips a level: <h1> is followed by <h3> (levels 2..2 are skipped), so screen-reader heading navigation is broken. — `body > main > div > h3`
- `C` [1.1.1] Alt text is a file name ("IMG_5521.jpg"), which conveys nothing to a screen-reader user. — `img[src="assets/IMG_5521.jpg"]`

**Agent decisions:**

### C [1.1.1] `img[src="assets/IMG_5521.jpg"]` → **true-fix** (rule)
- attempt 1: deterministic rule fix → guard ok · verify: target resolved, new findings [none] → **ACCEPT**

### B [1.3.1] `body > main > div > h3` → **true-fix** (llm)
- attempt 1: LLM targeted fix → guard ok · verify: target resolved, new findings [none] → **ACCEPT**

**Shipped result:** Layer A 0 · Layer B 0 · Layer C 0
