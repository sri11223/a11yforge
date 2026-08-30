# Trajectory — `inj-icon-focus`

_[← all traces, and what each one shows](README.md)_

**How to read this.** Layers: **A** mechanical (axe + pa11y) · **B** behavioural
(screen-reader / keyboard) · **C** semantic (is the alt/label actually meaningful).
Strategies: **rule** = deterministic code fix · **llm** = model-generated fix ·
**checkpoint** = escalated to a human instead of guessed. Every candidate passes a
regression **guard** (rejects deleting or hiding content) and then a **verify** re-scan;
only a candidate that resolves its target and adds no new findings is committed.

**Detected issues (A/B/C tool output):**

- `B` [2.1.1] Element behaves as a control (role="button") but is not keyboard-focusable (no tabindex), so keyboard/screen-reader users cannot reach it. — `body > main > div > div`

**Agent decisions:**

### B [2.1.1] `body > main > div > div` → **true-fix** (llm) · memory-hit (strategy recalled from an earlier verified fix)
- _reflexion: 2 attempts — a rejected attempt's diagnostic is fed back into the next try._
- attempt 1: LLM targeted fix → guard ok · verify: target still present, new findings [none] → **REJECT — feed failure back and retry**
  - diagnostic actually fed back into attempt 2: _"The target issue is still present after your change."_
- attempt 2: LLM targeted fix → guard ok · verify: target resolved, new findings [none] → **ACCEPT**

**Shipped result:** Layer A 0 · Layer B 0 · Layer C 0
