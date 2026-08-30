# Trajectory — `inj-form-label`

**Detected issues (A/B/C tool output):**

- `A` [3.2.2] This form does not contain a submit button, which creates issues for those who cannot submit the form using the keyboard. Submit buttons are INPUT elements with type attribute "submit" or "image", or BUTTON elements with type "submit" or omitted/invalid. — `html > body > main > form`
- `A` [4.1.2] This emailinput element does not have a name available to an accessibility API. Valid names are: label element, title , aria-label , aria-labelledby . — `html > body > main > form > input`

**Agent decisions:**

### A [3.2.2] `html > body > main > form` → **unresolved** (rule)
- not committed

### A [4.1.2] `html > body > main > form > input` → **true-fix** (rule)
- attempt 1: deterministic rule fix → guard ok · verify: target resolved, new findings [none] → **ACCEPT**

**Shipped result:** Layer A 1 · Layer B 0 · Layer C 0
