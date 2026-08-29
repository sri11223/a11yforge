# Trajectory — `alt-generic`

**Detected issues (A/B/C tool output):**

- `C` [1.1.1] Alt text is a generic placeholder ("photo") that does not describe the image. — `img[src="assets/harvest.jpg"]`
- `C` [1.1.1] Alt text is a generic placeholder ("image") that does not describe the image. — `img[src="assets/hero.jpg"]`
- `C` [1.1.1] Alt text is a generic placeholder ("image") that does not describe the image. — `img[src="assets/lumen.jpg"]`
- `C` [1.1.1] Alt text is a generic placeholder ("picture") that does not describe the image. — `img[src="assets/verge.jpg"]`

**Agent decisions:**

### C [1.1.1] `img[src="assets/harvest.jpg"]` → **true-fix** (rule)
- attempt 1: deterministic rule fix → guard ok · verify: target resolved, new findings [none] → **ACCEPT**

### C [1.1.1] `img[src="assets/hero.jpg"]` → **needs-review** (checkpoint)
- ungrounded alt → human checkpoint
- → escalated to **human checkpoint**: alt left untouched (no fabricated description).

### C [1.1.1] `img[src="assets/lumen.jpg"]` → **true-fix** (rule)
- attempt 1: deterministic rule fix → guard ok · verify: target resolved, new findings [none] → **ACCEPT**

### C [1.1.1] `img[src="assets/verge.jpg"]` → **true-fix** (rule)
- attempt 1: deterministic rule fix → guard ok · verify: target resolved, new findings [none] → **ACCEPT**

**Shipped result:** Layer A 0 · Layer B 0 · Layer C 1 · 1 escalated for human review
