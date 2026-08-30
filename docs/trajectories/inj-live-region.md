# Trajectory — `inj-live-region`

**Detected issues (A/B/C tool output):**

- `A` [3.2.2] This form does not contain a submit button, which creates issues for those who cannot submit the form using the keyboard. Submit buttons are INPUT elements with type attribute "submit" or "image", or BUTTON elements with type "submit" or omitted/invalid. — `html > body > main > form`
- `B` [4.1.3] Content updated dynamically inside an element with no live region (aria-live / role=status), so screen-reader users are not notified of the change. — `body > main > div`

**Agent decisions:**

### A [3.2.2] `html > body > main > form` → **unresolved** (rule)
- not committed

### B [4.1.3] `body > main > div` → **true-fix** (llm)
- attempt 1: LLM targeted fix → guard ok · verify: target resolved, new findings [none] → **ACCEPT**

**Shipped result:** Layer A 1 · Layer B 0 · Layer C 0
