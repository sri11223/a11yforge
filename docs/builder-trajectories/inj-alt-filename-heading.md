# Trajectory — `inj-alt-filename-heading`

_[← all traces, and what each one shows](README.md)_

**How to read this.** Layers: **A** mechanical (axe + pa11y) · **B** behavioural
(screen-reader / keyboard) · **C** semantic (is the alt/label actually meaningful).
Strategies: **rule** = deterministic code fix · **llm** = model-generated fix ·
**checkpoint** = escalated to a human instead of guessed. Every candidate passes a
regression **guard** (rejects deleting or hiding content) and then a **verify** re-scan;
only a candidate that resolves its target and adds no new findings is committed.

**The instructions behind these decisions.** Fixer system prompt:
[`src/agents/fix-prompt.ts`](../../src/agents/fix-prompt.ts) · routing table:
[`src/agents/router.ts`](../../src/agents/router.ts) (`DECISION_TABLE`) · Layer-C judge
prompt: [`src/layers/layerC-judge.ts`](../../src/layers/layerC-judge.ts) (`JUDGE_SYSTEM`),
whose own verdicts are traced in [`judge-verdicts.md`](judge-verdicts.md).

**Detected issues (A/B/C tool output):**

- `B` [1.3.1] Heading outline skips a level: <h1> is followed by <h3> (levels 2..2 are skipped), so screen-reader heading navigation is broken. — `body > main > div > h3`
- `C` [1.1.1] Alt text is a file name ("IMG_5521.jpg"), which conveys nothing to a screen-reader user. — `img[src="assets/IMG_5521.jpg"]`

**Agent decisions:**

### C [1.1.1] `img[src="assets/IMG_5521.jpg"]` → **true-fix** (rule)
- attempt 1: deterministic rule fix → guard ok · verify: target resolved, new findings [none] → **ACCEPT**

### B [1.3.1] `body > main > div > h3` → **true-fix** (llm)
- attempt 1: LLM targeted fix → guard ok · verify: target resolved, new findings [none] → **ACCEPT**

**Shipped result:** Layer A 0 · Layer B 0 · Layer C 0
