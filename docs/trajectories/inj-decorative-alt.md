# Trajectory — `inj-decorative-alt`

**Detected issues (A/B/C tool output):**

- `C` [1.1.1] Alt text describes a decorative element ("decorative ornamental divider swirl"); a decorative image should use empty alt="" to avoid screen-reader noise. — `img[src="assets/swirl.svg"]`

**Agent decisions:**

### C [1.1.1] `img[src="assets/swirl.svg"]` → **true-fix** (rule)
- attempt 1: deterministic rule fix → guard ok · verify: target resolved, new findings [none] → **ACCEPT**

**Shipped result:** Layer A 0 · Layer B 0 · Layer C 0
