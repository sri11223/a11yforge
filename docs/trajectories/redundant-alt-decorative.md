# Trajectory — `redundant-alt-decorative`

_[← all traces, and what each one shows](README.md)_

**How to read this.** Layers: **A** mechanical (axe + pa11y) · **B** behavioural
(screen-reader / keyboard) · **C** semantic (is the alt/label actually meaningful).
Strategies: **rule** = deterministic code fix · **llm** = model-generated fix ·
**checkpoint** = escalated to a human instead of guessed. Every candidate passes a
regression **guard** (rejects deleting or hiding content) and then a **verify** re-scan;
only a candidate that resolves its target and adds no new findings is committed.

**Detected issues (A/B/C tool output):**

- `C` [1.1.1] Alt text describes a decorative element ("decorative ornamental flourish divider image separating the two sections of the essay"); a decorative image should use empty alt="" to avoid screen-reader noise. — `img[src="assets/divider-ornament.svg"]`

**Agent decisions:**

### C [1.1.1] `img[src="assets/divider-ornament.svg"]` → **true-fix** (rule)
- attempt 1: deterministic rule fix → guard ok · verify: target resolved, new findings [none] → **ACCEPT**

**Shipped result:** Layer A 0 · Layer B 0 · Layer C 0
