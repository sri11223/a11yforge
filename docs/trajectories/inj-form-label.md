# Trajectory — `inj-form-label`

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

- `A` [3.2.2] This form does not contain a submit button, which creates issues for those who cannot submit the form using the keyboard. Submit buttons are INPUT elements with type attribute "submit" or "image", or BUTTON elements with type "submit" or omitted/invalid. — `html > body > main > form`
- `A` [4.1.2] This emailinput element does not have a name available to an accessibility API. Valid names are: label element, title , aria-label , aria-labelledby . — `html > body > main > form > input`

**Agent decisions:**

### A [3.2.2] `html > body > main > form` → **unresolved** (rule)
- not committed
- **Why nothing shipped:** no deterministic rule covers WCAG 3.2.2, and Layer-A findings are always routed to the rule fixer, never to the LLM — so no fix was produced. **That is a coverage gap, not a judgement call.** The agent left the page **visibly failing** rather than invent markup it cannot verify: the violation stays detectable by any scanner, so this is an **unfixed issue, not a false green**. Closing it would mean adding a 3.2.2 rule.

### A [4.1.2] `html > body > main > form > input` → **true-fix** (rule)
- attempt 1: deterministic rule fix → guard ok · verify: target resolved, new findings [none] → **ACCEPT**

**Shipped result:** Layer A 1 · Layer B 0 · Layer C 0

_This page ships **visibly failing** (Layer A above): the issue is unfixed and any
scanner will report it. That is categorically different from hiding it to look clean._
