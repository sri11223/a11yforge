# Trajectory — `redundant-alt-decorative`

**Detected issues (A/B/C tool output):**

- `C` [1.1.1] Alt text describes a decorative element ("decorative ornamental flourish divider image separating the two sections of the essay"); a decorative image should use empty alt="" to avoid screen-reader noise. — `img[src="assets/divider-ornament.svg"]`

**Agent decisions:**

### C [1.1.1] `img[src="assets/divider-ornament.svg"]` → **true-fix** (rule)
- attempt 1: deterministic rule fix → guard ok · verify: target resolved, new findings [none] → **ACCEPT**

**Shipped result:** Layer A 0 · Layer B 0 · Layer C 0
