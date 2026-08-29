# A11yForge — Scanner-clean ≠ usable

An AI agent that fixes web accessibility (WCAG) violations **and proves, with a reproducible
number, how often a "scanner-clean" fix is still unusable to a screen-reader user** — then
refuses to ship the fixes it can't verify.

Automated scanners catch only ~13–57% of real WCAG issues. The FTC fined accessiBe $1M (2025)
for false compliance claims. WebAIM Million: 95.9% of homepages still fail. A page can pass
every automated check and still trap a keyboard user, scramble reading order, or ship a
confidently-hallucinated `alt`.

## Three numbers (reproduced offline — [`docs/results/`](docs/results/))

1. **Gap = 95.8%** — of the 24 axe-clean pages in our corpus, 23 still fail the
   screen-reader/keyboard or semantic layers.
2. **Harm shipped: baseline 8 → advanced 0** — a fair single-shot fixer ships 6 regressions +
   2 false-fixes; the verify-loop + regression guard ship zero.
3. **Integrity: 2 escalations, 0 guesses** — where an alt can't be grounded in the page's own
   markup, the agent flags it for a human instead of inventing a description.

**Ablation (each layer earns its place):** a verify-loop gated at `{A}` ships **23** broken
pages as "compliant"; `{A,B}` → **9**; `{A,B,C}` → **0**.

## Reproduce it (one command, offline, no API key)

```bash
npm ci && npm run eval          # → out/metrics.json (Node 22)
```

or with only Docker:

```bash
docker compose run --rm eval    # same numbers, no local Node needed
```

Both replay committed LLM cassettes (`A11YFORGE_MODE=replay`) — deterministic, no OpenRouter
key, near-zero cost. Full walkthrough + expected output: [`REPRODUCE.md`](REPRODUCE.md).
Determinism proof (3× byte-identical): [`docs/results/determinism-proof.txt`](docs/results/determinism-proof.txt).

## Three verification layers

- **Layer A — mechanical (deterministic):** `axe-core` + `pa11y` (two independent engines);
  definite WCAG 2.x A/AA failures only.
- **Layer B — behavioral (deterministic):** the **CDP/DOM checks are the source of truth**
  (focus/reading order, keyboard traps, operability via CDP event listeners, live regions,
  skip links, heading outline); the **Guidepup virtual screen reader supplies the announcement
  transcript** as evidence + cross-check — it does not drive the decisions. *Simulator of
  order/operability/name, not a bug-for-bug NVDA/JAWS replica.*
- **Layer C — semantic (calibrated LLM judge):** meaningfulness of alt/labels only, validated
  against a 64-item expert anchor set (**Cohen's κ = 0.98**, hard gate); deterministic
  backstops keep the finding alive even when the judge is weak. **Alt is never LLM-invented** —
  grounded rule-fix or human checkpoint, so confident hallucination is structurally impossible.

## Agents

- **Baseline:** one shot — "fix this HTML given these violations." Fair: same model
  (`claude-sonnet-5`), prompt, temperature, seed as the advanced fixer.
- **Advanced:** context → route (rule for mechanical/semantic, LLM for behavioral) →
  verify-loop [A,B,C] → regression guard (rejects fix-by-delete/hide) → human checkpoint for
  ungroundable alt → memory. Only the pipeline differs from the baseline.

## Deliverables

- **Code + improvement changelog:** this repo · [`docs/CHANGELOG.md`](docs/CHANGELOG.md)
- **Reproduction guide:** [`REPRODUCE.md`](REPRODUCE.md)
- **End-to-end report:** [`docs/report.html`](docs/report.html) (self-contained)
- **Agent trajectories:** [`docs/trajectories/`](docs/trajectories/) (readable + raw JSONL)
- **Coding-agent disclosure & build arc:** [`docs/CODING_AGENT.md`](docs/CODING_AGENT.md)
- **Design decisions:** [`docs/BRAINSTORM.md`](docs/BRAINSTORM.md) · **Build log:** [`docs/BUILD_LOG.md`](docs/BUILD_LOG.md)

## Stack

TypeScript / Node 22 · Playwright (Chromium, pinned) · axe-core · pa11y ·
@guidepup/virtual-screen-reader · cheerio · OpenRouter (fixer `claude-sonnet-5`, judge
`gpt-4o-mini` — different families, temperature 0, fixed seed) · Docker.

## Status

Complete. `npm test` (offline) green; metrics + ablation reproduce byte-identical.
