# Determinism proof — 3× byte-identical (offline replay, no API key)

Command (reproduces this file):

    npm run determinism
    # = npx tsc && node dist/eval/determinism-proof.js   (A11YFORGE_MODE=replay)

The full baseline-vs-advanced eval and the gated {A}/{A,B}/{A,B,C} ablation were each run
**three times** from committed LLM cassettes — **no OpenRouter key, no network LLM calls** —
and the SHA-256 of `out/metrics.json` and `out/ablation.json` was taken each run.

## metrics.json (SHA-256)

- run 1: `071387c287b8ba042e6645afaeaffd95a61ea976b881cb08e8d13f23e722f3a6`
- run 2: `071387c287b8ba042e6645afaeaffd95a61ea976b881cb08e8d13f23e722f3a6`
- run 3: `071387c287b8ba042e6645afaeaffd95a61ea976b881cb08e8d13f23e722f3a6`

## ablation.json (SHA-256)

- run 1: `93d88b2305a6b9595aebbdf53b88867da961ede2f33e9fab795c474128de16d2`
- run 2: `93d88b2305a6b9595aebbdf53b88867da961ede2f33e9fab795c474128de16d2`
- run 3: `93d88b2305a6b9595aebbdf53b88867da961ede2f33e9fab795c474128de16d2`

## Result

**PASS** — metrics identical, ablation identical across all three runs.
Reproduced with no API key in replay mode: the pipeline reproduces byte-for-byte from committed
cassettes — this is offline-replay reproducibility, not a claim that the LLM itself is deterministic.

> Reconfirmed under the final code: after the universal-escalation invariant was added
> (`src/agents/advanced.ts`), this proof was re-run and the 27-page `metrics.json` and
> `ablation.json` remain byte-identical to the sealed values above — the fix is a proven no-op
> on the headline corpus (see CHANGELOG "Robustness at scale").

> **Also verified from a fresh clone (2026-08-30).** A `git clone` of origin at `06a0d2e` into a new
> directory, fresh `node_modules` via `npm ci`, an **empty** `PLAYWRIGHT_BROWSERS_PATH` with
> `chromium-1234` installed separately by `npx playwright install chromium`, Node v22.22.3:
> `npm run eval` produced an `out/metrics.json` byte-identical to the committed `metrics.json`
> (SHA-256 `071387c287b8…`), and `npm test` passed 157/157. Cold: the clone, `node_modules`,
> `dist/`, the Playwright browser cache. NOT varied: same machine, same OS (Windows), same Node
> version — cross-platform and cross-machine reproduction are untested and not claimed.
