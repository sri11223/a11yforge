# Trajectory — `inj-heading-skip`

_[← all traces, and what each one shows](README.md)_

**How to read this.** Layers: **A** mechanical (axe + pa11y) · **B** behavioural
(screen-reader / keyboard) · **C** semantic (is the alt/label actually meaningful).
Strategies: **rule** = deterministic code fix · **llm** = model-generated fix ·
**checkpoint** = escalated to a human instead of guessed. Every candidate passes a
regression **guard** (rejects deleting or hiding content) and then a **verify** re-scan;
only a candidate that resolves its target and adds no new findings is committed.

**Detected issues (A/B/C tool output):**

- `B` [1.3.1] Heading outline skips a level: <h1> is followed by <h3> (levels 2..2 are skipped), so screen-reader heading navigation is broken. — `body > main > h3`

**Agent decisions:**

### B [1.3.1] `body > main > h3` → **true-fix** (llm) · memory-hit (strategy recalled from an earlier verified fix)
- attempt 1: LLM targeted fix → guard ok · verify: target resolved, new findings [none] → **ACCEPT**

**Shipped result:** Layer A 0 · Layer B 0 · Layer C 0
