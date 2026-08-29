# Trajectory — `keyboard-trap-modal`

**Detected issues (A/B/C tool output):**

- `B` [2.1.2] Keyboard focus is trapped in the dialog: Tab does not move focus out, Escape does not dismiss it, and there is no keyboard-operable close control. — `body > div > div`
- `B` [2.1.1] Element behaves as a control (has a click handler) but is not keyboard-focusable (no tabindex), so keyboard/screen-reader users cannot reach it. — `body > div > div > span`
- `B` [4.1.2] Control has no meaningful accessible name (announced as "×"), so a screen-reader user cannot tell what it does. — `body > div > div > span`

**Agent decisions:**

### B [2.1.2] `body > div > div` → **true-fix** (llm)
- attempt 1: LLM targeted fix → guard ok · verify: target resolved, new findings [none] → **ACCEPT**

### B [2.1.1] `body > div > div > span` → **true-fix** (rule)
- resolved by an earlier fix

### B [4.1.2] `body > div > div > span` → **true-fix** (rule)
- resolved by an earlier fix

**Shipped result:** Layer A 0 · Layer B 0 · Layer C 0
