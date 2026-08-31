# Trajectory — `informative-emptied`

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

- `C` [1.1.1] A substantial image (in a <figure> or with a content-bearing source) has empty alt="" and no descriptive caption, so a screen-reader user gets no information — likely an informative image wrongly marked decorative. — `img[src="assets/emissions-2020-2024.svg"]`

**Agent decisions:**

### C [1.1.1] `img[src="assets/emissions-2020-2024.svg"]` → **needs-review** (checkpoint)
- ungrounded alt → human checkpoint
- → escalated to **human checkpoint**: alt left untouched (no fabricated description).

**Shipped result:** Layer A 0 · Layer B 0 · Layer C 1 · 1 escalated for human review

_Read that carefully: the remaining Layer-B/C count **is** the escalated item — it is
deliberately left for a human, not undetected breakage the agent missed._
