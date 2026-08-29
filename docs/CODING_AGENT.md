# Coding-agent disclosure &amp; build trajectory

Full disclosure of the AI agents used to build A11yForge, and the honest arc of how it came
together — including an experiment we tried and **removed**.

## Agents & tools used

**Coding agent (built this repo):** Claude Code (Anthropic Opus 4.8). It wrote the code,
tests, corpus, and docs, ran the toolchain, and drove git. The build was orchestrated
step-by-step (brainstorm → scaffold → layers → agents → metrics → report), with each step
verified (tsc + tests green) before the next.

**Runtime LLMs (used by A11yForge itself), via OpenRouter, temperature 0, fixed seed:**
- **Fixer = `anthropic/claude-sonnet-5`** — generates behavioral (Layer B) fixes for both the
  baseline (single-shot) and the advanced agent (targeted, inside the verify-loop).
- **Judge = `openai/gpt-4o-mini`** — Layer C semantic judge, a **different model family** from
  the fixer so it never grades its own dialect. Calibrated to Cohen's κ = 0.98 (hard gate).

**Deterministic tooling (no LLM):** axe-core + pa11y (Layer A), Guidepup
virtual-screen-reader + Chrome DevTools Protocol AX tree (Layer B), cheerio (Layer C
backstops + rule fixes), Playwright (Chromium).

**Reproducibility:** every LLM call is recorded to a content-hashed cassette; the whole
evaluation replays offline (`A11YFORGE_MODE=replay`) with no API key and reproduces the same
numbers. See [`README`](../README.md) and [`BUILD_LOG.md`](BUILD_LOG.md).

## Build arc (honest)

1. **Brainstorm** — locked the three-layer design, κ-gating, fair-baseline rule, and
   reproducibility strategy up front ([`BRAINSTORM.md`](BRAINSTORM.md)).
2. **Corpus** — 15 adversarial pages that pass axe but fail real use, + 12 injected pages
   (one fairly-fixable violation each). A test asserts the 5 scanner-invisible pages are
   WCAG-axe-clean — the thesis, proven mechanically.
3. **Three layers** — A (axe + pa11y, definite failures only), B (virtual-SR + CDP,
   deterministic behavioral checks), C (deterministic backstops + κ-calibrated LLM judge).
4. **Fair baseline** — one shot, same model/prompt/seed as the advanced fixer; only the
   pipeline differs. It is genuinely strong (we did not rig a weak baseline).
5. **Advanced agent** — route → verify-loop[A,B,C] → regression guard → human checkpoint →
   memory. Ships zero harm; escalates what it can't ground.
6. **Metrics + ablation** — baseline vs advanced over 27 pages; the {A}/{A,B}/{A,B,C}
   ablation; honest small-n significance.

## Experiments we tried and REMOVED

- **Layer C → LLM alt fixes (removed).** The first advanced router sent semantic alt to the
  LLM to "write better alt text." Given an image it could not see, the strong model
  **confidently fabricated** descriptions ("Lumen product packaging boxes stacked in warm
  lighting") — and axe, the deterministic backstops, and even the LLM judge all rated them
  plausible. We caught it in the trajectories, removed the LLM-alt path entirely, and made
  alt **rule-from-grounding-or-escalate**: the agent writes alt only from text already in the
  page, and otherwise flags it for a human. This turned our hot take into an enforced
  invariant — hallucination is now structurally impossible, not merely discouraged. It is the
  single most important decision in the build.
- **pa11y warnings/notices in Layer A (removed).** They fired spuriously on the
  scanner-invisible pages and would have destroyed the gap proof; Layer A counts definite
  conformance failures only.
- **axe best-practice rules in the WCAG scan (excluded).** They'd let the scanner take credit
  for issues it only heuristically hints at; we scope Layer A to WCAG 2.x A/AA success
  criteria. Consequence, reported honestly: `heading-skip` is a Layer-B catch, not Layer-A.

## Bugs we caught and fixed (in the open)

- **The virtual SR was silently disabled.** A wrong module-resolve path
  (`.../lib/esm/index.browser.js`, blocked by the package `exports` map) meant Guidepup never
  actually ran — Layer B was quietly on its deterministic fallback. We fixed the resolve to
  the exported `browser.js`, and then found starting the SR injects a live-region announcer
  node that polluted the same-page checks, so we isolated the SR capture to a throwaway page.
  Net honest framing: the **deterministic CDP/DOM checks are the verified source of truth**
  for Layer B findings; the virtual SR provides the announcement transcript as evidence and
  cross-check. Metrics reproduce byte-for-byte before and after the fix.
- **Clean-env reproducibility, verified the hard way.** Actually running the Docker container
  (not just building it) surfaced two bugs a keyless judge would hit — `npm ci` aborting on an
  ERESOLVE peer conflict, and pa11y's Puppeteer unable to find Chrome in the Playwright image
  (fixed via legacy-peer-deps and by pointing pa11y at the image's Playwright Chromium). And a
  meta-lesson: our first "it reproduces ✅" was a **false green** — the container had crashed
  and the diff compared a stale local `out/metrics.json`. We hardened the check (delete `out/`
  so it can only pass on a real fresh container write) and only then confirmed a true
  byte-match. A green check you don't validate is false comfort — our own thesis, on us.
