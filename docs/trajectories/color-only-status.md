# Trajectory — `color-only-status`

_[← all traces, and what each one shows](README.md)_

**How to read this.** Layers: **A** mechanical (axe + pa11y) · **B** behavioural
(screen-reader / keyboard) · **C** semantic (is the alt/label actually meaningful).
Strategies: **rule** = deterministic code fix · **llm** = model-generated fix ·
**checkpoint** = escalated to a human instead of guessed. Every candidate passes a
regression **guard** (rejects deleting or hiding content) and then a **verify** re-scan;
only a candidate that resolves its target and adds no new findings is committed.

**Detected issues (A/B/C tool output):**

_None. All three layers scanned this page and found nothing to fix, so the agent
correctly made no change. This trace is intentionally empty — it is published rather
than omitted so the set covers every page in the eval, not only the eventful ones._

**Agent decisions:**

**Shipped result:** Layer A 0 · Layer B 0 · Layer C 0
