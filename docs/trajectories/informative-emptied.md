# Trajectory — `informative-emptied`

**Detected issues (A/B/C tool output):**

- `C` [1.1.1] A substantial image (in a <figure> or with a content-bearing source) has empty alt="" and no descriptive caption, so a screen-reader user gets no information — likely an informative image wrongly marked decorative. — `img[src="assets/emissions-2020-2024.svg"]`

**Agent decisions:**

### C [1.1.1] `img[src="assets/emissions-2020-2024.svg"]` → **needs-review** (checkpoint)
- ungrounded alt → human checkpoint
- → escalated to **human checkpoint**: alt left untouched (no fabricated description).

**Shipped result:** Layer A 0 · Layer B 0 · Layer C 1 · 1 escalated for human review
