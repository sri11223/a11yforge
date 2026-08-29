# Reproducing A11yForge

Everything below runs **offline in replay mode** — it replays committed, content-hashed LLM
cassettes, so it needs **no OpenRouter API key**, makes **no network LLM calls**, and costs
**≈ $0**. A judge on a clean machine gets the same numbers we report.

## Option A — Docker (only Docker required)

```bash
git clone https://github.com/sri11223/a11yforge.git
cd a11yforge
docker compose run --rm eval
```

The image pins the Playwright Chromium revision (Playwright 1.62.1). Expected tail of output:

```
Pages=27  Issues=46  Buckets=adversarial,injected
GAP: of 24 axe-clean pages, 23 still fail B/C = 95.8%

                 baseline   advanced
true-fix issues       44         42
FALSE-FIX issues       2          0
needs-review           0          2
regressions            6          0
false-fix PAGES        4          0
HARM SHIPPED (false-fixes + regressions): baseline 8 → advanced 0

ABLATION: {A} 23 → {A,B} 9 → {A,B,C} 0 false-fix pages  (B catches 14, C catches 9)
```

Written to `out/metrics.json`. **Runtime:** ~20–35 min (Playwright-heavy; LLM calls are
replayed instantly). **Cost:** $0 (no key).

## Option B — local (Node 22)

```bash
git clone https://github.com/sri11223/a11yforge.git
cd a11yforge
npm ci                 # pinned deps (package-lock.json)
npx playwright install chromium
npm run eval           # → out/metrics.json   (one command; make eval also works)
```

`npm run eval` needs no env vars — it defaults to `A11YFORGE_MODE=replay` and the recorded
model ids. Other entry points: `npm test` (offline suite), `npm run ablation`,
`npm run report` (rebuilds `docs/report.html`), `npm run trajectories`.

## Determinism proof (3× byte-identical)

```bash
npm run determinism        # or: docker compose run --rm determinism
```

Runs the eval three times, SHA-256s `out/metrics.json` each run, asserts all three match, and
writes [`docs/results/DETERMINISM.md`](docs/results/DETERMINISM.md). The three
committed hashes are the evidence that the pipeline is byte-for-byte reproducible.

## Expected numbers (the committed reference)

Machine-readable: [`docs/results/metrics.json`](docs/results/metrics.json) and
[`docs/results/ablation.json`](docs/results/ablation.json). Headline: gap **95.8%**, harm
**8 → 0**, false-fix pages **4 → 0**, regressions **6 → 0**, ablation **23 → 9 → 0**,
Layer-C judge Cohen's **κ = 0.98**. McNemar significance is reported honestly (not significant
at n=27 — see [`docs/CHANGELOG.md`](docs/CHANGELOG.md)).

## Running LIVE (optional — requires an OpenRouter key)

Only needed to re-record cassettes from scratch; not required to reproduce our numbers.

```bash
export OPENROUTER_API_KEY=sk-or-...
export FIXER_MODEL=anthropic/claude-sonnet-5
export JUDGE_MODEL=openai/gpt-4o-mini
A11YFORGE_MODE=record npx tsc && node dist/eval/record-baseline.js   # re-record baseline
A11YFORGE_MODE=record node dist/eval/record-advanced.js               # re-record advanced
A11YFORGE_MODE=record node dist/eval/calibrate-judge.js               # re-record judge + κ
```

`A11YFORGE_MODE=auto` replays existing cassettes and records only missing calls (idempotent,
no re-spend). Fixer and judge are deliberately different model families.

## Notes

- Run agents/eval from compiled `dist/` (via the npm scripts), **not `tsx`** — tsx's esbuild
  shim injects a `__name` helper that breaks Playwright `page.evaluate` bodies.
- Cassettes contain only `{model, temperature, seed, messages}` + response — **no API key**.
