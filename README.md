# A11yForge — Scanner-clean ≠ usable

An AI agent that fixes web accessibility (WCAG) violations **and proves, with a reproducible
number, how often a "scanner-clean" fix is still unusable to a screen-reader user.**

Automated scanners catch only ~13–57% of real WCAG issues. The FTC fined accessiBe $1M (2025)
for false compliance claims. WebAIM Million: 95.9% of homepages still fail. A page can pass
every automated check and still trap a keyboard user, scramble reading order, or ship
`alt="image"`. A11yForge measures that gap and closes it with fixes gated on real usability —
not on re-running the scanner.

## Three verification layers (deterministic-first)

- **Layer A — mechanical (deterministic):** `axe-core` + `pa11y`. Two independent rule engines.
- **Layer B — behavioral (deterministic):** virtual screen-reader traversal
  (`@guidepup/virtual-screen-reader`) + CDP `Accessibility.getFullAXTree`. Focus order,
  keyboard traps, live-region announcements, accessible-name presence — what a scanner can't see.
  *Simulator of order/operability/name, not a bug-for-bug NVDA/JAWS replica.*
- **Layer C — semantic (calibrated LLM judge):** meaningfulness of alt/labels only, validated
  against a human anchor set and **κ-gated**; deterministic backstops keep the finding alive even
  when the judge is weak.

The screen-reader layer does **double duty** — it *measures* the gap (the finding) and *gates*
the advanced agent's verify-loop (the improvement).

## Agents

- **Baseline:** single-shot "fix this HTML given these violations." (Fair: same input/model/seed.)
- **Advanced:** context → route (rule-based for mechanical, LLM for semantic) → verify-loop [A,B,C]
  → regression guard (catches "fix by deleting/hiding the element") → human checkpoint for
  ambiguous alt.

## Stack

TypeScript / Node 22 · Playwright · axe-core · pa11y · @guidepup/virtual-screen-reader ·
OpenRouter (OpenAI-compatible, temperature=0, pinned model, fixed seed) · Docker.

## Status

Design locked — see [`docs/BRAINSTORM.md`](docs/BRAINSTORM.md). Application code not yet written.

## Reproducibility (target)

Pinned deps + Playwright browser revision + committed lockfile · Docker · one command
(`make eval`) · LLM record/replay cassettes · 3× byte-identical determinism proof.
