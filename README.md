# A11yForge — verifiable agentic remediation

**An evaluation harness for agents that never ship a fix they can't verify** — measured by what
the naive agent breaks: **8 harmful changes → 0**, same model, same prompt, only the verify-loop
differs. Accessibility is the proving ground: the rare domain where **"looks fixed" (scanner-green)
and "is fixed" (a screen-reader user succeeds) diverge measurably**, so the difference between a
careful agent and a careless one becomes a number.

Automated scanners catch only ~13–57% of real WCAG issues. The FTC fined accessiBe $1M (2025)
for false compliance claims. WebAIM Million: 95.9% of homepages still fail. A page can pass
every automated check and still trap a keyboard user, scramble reading order, or ship a
confidently-hallucinated `alt`.

## The evidence, strongest first (reproduced offline — [`docs/results/`](docs/results/))

1. **Categorical — ablation 23 → 0.** A scanner-only verify gate ships **23** broken pages as
   "compliant"; `{A,B}` → **9**; the full `{A,B,C}` stack → **0**. Proof by construction, not a
   p-value.
2. **Real-world — 127 hidden barriers.** Across **20 live production sites**, 127 Layer-B/C issues
   a scanner cannot see (honest lower bound). Scanner-clean ≠ usable, in the wild.
3. **Mechanism — harm 8 → 0.** A fair single-shot baseline ships 6 regressions + 2 false-fixes;
   the verify-loop + regression guard ship **zero** (same model/prompt). An existence proof of the
   method — not statistically significant at n=27 (p=0.074); on the widened 45-page corpus the
   harmful-page difference reaches p=0.041, *significant on our own benchmark* (external-validity
   caveat), not a bare "p<0.05".
4. **Integrity — 2 escalations, 0 guesses.** Where an alt can't be grounded in the page's own
   markup, the agent flags it for a human instead of inventing a description.

**The gap number, honestly:** on the sealed corpus (27 pages = 15 adversarial + 12 injected), 23 of
the 24 axe-clean pages still fail Layer B/C — **95.8%**. The corpus is *adversarial by construction*
(built to isolate what scanners miss), so this characterizes the corpus, not field prevalence; the
20-site number above is the field evidence.

## Reproduce it (one command, offline, no API key)

```bash
npm ci && npm run eval          # → out/metrics.json (Node 22)
```

or with only Docker:

```bash
docker compose run --rm eval    # same numbers, no local Node needed
```

Both replay committed LLM cassettes (`A11YFORGE_MODE=replay`) — **reproducible byte-for-byte**
(the pipeline replays identically offline; this is not a claim that the LLM itself is
deterministic), no OpenRouter key, near-zero cost. Full walkthrough + expected output:
[`REPRODUCE.md`](REPRODUCE.md). Reproducibility proof (3× byte-identical replay):
[`docs/results/DETERMINISM.md`](docs/results/DETERMINISM.md).

## Use in CI — block the false-green before merge

A11yForge ships as a GitHub Action ([`action.yml`](action.yml)) that runs `a11yforge audit`
and **fails the check when a page is scanner-clean but still unusable** — the thesis, enforced
in the dev workflow. Layers A+B are deterministic and run with **no API key**; Layer C degrades
to its deterministic backstops (pass `no-llm: true`, the default). Add to any repo:

```yaml
# .github/workflows/a11y.yml
name: A11yForge gap check
on: [pull_request]
permissions: { contents: read, pull-requests: write }
jobs:
  a11y:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: sri11223/a11yforge@main
        with:
          target: path/or/glob/to/page.html   # a file, directory, or URL
          comment: "true"                       # post the gap report on the PR
          github-token: ${{ github.token }}
```

The action self-builds from its own checkout, so it works **without publishing to npm**. It
writes a job summary, optionally comments on the PR, and exits non-zero on the gap (use
`ci: "true"` to also fail on plain Layer-A violations). A live demo runs on this repo's own
pages — an accessible page passes, a scanner-clean-but-broken page is caught — in
[`.github/workflows/a11y.yml`](.github/workflows/a11y.yml).

Locally, the same check: `npm run audit -- <url|path> [--ci] [--no-llm] [--html report.html]`.

## Three verification layers

- **Layer A — mechanical (deterministic):** `axe-core` + `pa11y` (two independent engines);
  definite WCAG 2.x A/AA failures only.
- **Layer B — behavioral (deterministic):** the **CDP/DOM checks are the source of truth**
  (focus/reading order, keyboard traps, operability via CDP event listeners, live regions,
  skip links, heading outline); the **Guidepup virtual screen reader supplies the announcement
  transcript** as evidence + cross-check — it does not drive the decisions. *Simulator of
  order/operability/name, not a bug-for-bug NVDA/JAWS replica.*
- **Layer C — semantic (calibrated LLM judge):** meaningfulness of alt/labels only, validated
  against a 64-item expert anchor set (**Cohen's κ = 0.98**, hard gate ≥ 0.6). *That κ is
  judge-vs-expert-labels agreement on a single-annotator, team-authored anchor set — a
  calibration check, not inter-annotator reliability.* Deterministic backstops keep the finding
  alive even when the judge is weak. **Alt is never LLM-invented** —
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
