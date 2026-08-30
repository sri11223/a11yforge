# Trajectory — `placeholder-as-label`

_[← all traces, and what each one shows](README.md)_

**How to read this.** Layers: **A** mechanical (axe + pa11y) · **B** behavioural
(screen-reader / keyboard) · **C** semantic (is the alt/label actually meaningful).
Strategies: **rule** = deterministic code fix · **llm** = model-generated fix ·
**checkpoint** = escalated to a human instead of guessed. Every candidate passes a
regression **guard** (rejects deleting or hiding content) and then a **verify** re-scan;
only a candidate that resolves its target and adds no new findings is committed.

**Detected issues (A/B/C tool output):**

- `A` [1.3.1] This form field should be labelled in some way. Use the label element (either with a "for" attribute or wrapped around the form field), or "title", "aria-label" or "aria-labelledby" attributes as appropriate. — `html > body > main > form > div > input:nth-child(1)`
- `A` [4.1.2] This textinput element does not have a name available to an accessibility API. Valid names are: label element, title , aria-label , aria-labelledby . — `html > body > main > form > div > input:nth-child(1)`
- `A` [1.3.1] This form field should be labelled in some way. Use the label element (either with a "for" attribute or wrapped around the form field), or "title", "aria-label" or "aria-labelledby" attributes as appropriate. — `html > body > main > form > div > input:nth-child(2)`
- `A` [4.1.2] This textinput element does not have a name available to an accessibility API. Valid names are: label element, title , aria-label , aria-labelledby . — `html > body > main > form > div > input:nth-child(2)`
- `A` [1.3.1] This form field should be labelled in some way. Use the label element (either with a "for" attribute or wrapped around the form field), or "title", "aria-label" or "aria-labelledby" attributes as appropriate. — `html > body > main > form > input:nth-child(1)`
- `A` [4.1.2] This textinput element does not have a name available to an accessibility API. Valid names are: label element, title , aria-label , aria-labelledby . — `html > body > main > form > input:nth-child(1)`
- `A` [4.1.2] This emailinput element does not have a name available to an accessibility API. Valid names are: label element, title , aria-label , aria-labelledby . — `html > body > main > form > input:nth-child(2)`
- `A` [4.1.2] This numberinput element does not have a name available to an accessibility API. Valid names are: label element, title , aria-label , aria-labelledby . — `html > body > main > form > input:nth-child(4)`

**Agent decisions:**

### A [1.3.1] `html > body > main > form > div > input:nth-child(1)` → **true-fix** (rule)
- attempt 1: deterministic rule fix → guard ok · verify: target resolved, new findings [none] → **ACCEPT**

### A [4.1.2] `html > body > main > form > div > input:nth-child(1)` → **true-fix** (rule)
- resolved by an earlier fix

### A [1.3.1] `html > body > main > form > div > input:nth-child(2)` → **true-fix** (rule) · memory-hit (strategy recalled from an earlier verified fix)
- attempt 1: deterministic rule fix → guard ok · verify: target resolved, new findings [none] → **ACCEPT**

### A [4.1.2] `html > body > main > form > div > input:nth-child(2)` → **true-fix** (rule)
- resolved by an earlier fix

### A [1.3.1] `html > body > main > form > input:nth-child(1)` → **true-fix** (rule) · memory-hit (strategy recalled from an earlier verified fix)
- attempt 1: deterministic rule fix → guard ok · verify: target resolved, new findings [none] → **ACCEPT**

### A [4.1.2] `html > body > main > form > input:nth-child(1)` → **true-fix** (rule)
- resolved by an earlier fix

### A [4.1.2] `html > body > main > form > input:nth-child(2)` → **true-fix** (rule)
- attempt 1: deterministic rule fix → guard ok · verify: target resolved, new findings [none] → **ACCEPT**

### A [4.1.2] `html > body > main > form > input:nth-child(4)` → **true-fix** (rule) · memory-hit (strategy recalled from an earlier verified fix)
- attempt 1: deterministic rule fix → guard ok · verify: target resolved, new findings [none] → **ACCEPT**

**Shipped result:** Layer A 0 · Layer B 0 · Layer C 0
