# Trajectory — `alt-is-filename`

**Detected issues (A/B/C tool output):**

- `C` [1.1.1] Alt text is a file name ("DSC_0042.jpg"), which conveys nothing to a screen-reader user. — `img[src="staff/DSC_0042.jpg"]`
- `C` [1.1.1] Alt text is a file name ("headshot-v2-web.png"), which conveys nothing to a screen-reader user. — `img[src="staff/headshot-v2-web.png"]`
- `C` [1.1.1] Alt text is a file name ("IMG_20240118_final.jpg"), which conveys nothing to a screen-reader user. — `img[src="staff/IMG_20240118_final.jpg"]`

**Agent decisions:**

### C [1.1.1] `img[src="staff/DSC_0042.jpg"]` → **true-fix** (rule)
- attempt 1: deterministic rule fix → guard ok · verify: target resolved, new findings [none] → **ACCEPT**

### C [1.1.1] `img[src="staff/headshot-v2-web.png"]` → **true-fix** (rule) · memory-hit (strategy recalled from an earlier verified fix)
- attempt 1: deterministic rule fix → guard ok · verify: target resolved, new findings [none] → **ACCEPT**

### C [1.1.1] `img[src="staff/IMG_20240118_final.jpg"]` → **true-fix** (rule) · memory-hit (strategy recalled from an earlier verified fix)
- attempt 1: deterministic rule fix → guard ok · verify: target resolved, new findings [none] → **ACCEPT**

**Shipped result:** Layer A 0 · Layer B 0 · Layer C 0
