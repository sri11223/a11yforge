# Trajectory — `alt-is-filename`

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
