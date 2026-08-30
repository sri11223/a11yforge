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

The image pins the Playwright Chromium revision (Playwright 1.62.1). Expected tail of output —
this is verbatim what `run-eval` prints, abridged only where marked:

```
Pages=27  Issues=46  Buckets=adversarial,injected
GAP: of 24 axe-clean pages, 23 still fail B/C = 95.8%

                 baseline   advanced
true-fix issues       44         42
FALSE-FIX issues       2          0
needs-review           0          2
unresolved             0          2
regressions            6          0
false-fix PAGES        4          0
true-fix PAGES        22         23

HARM SHIPPED (false-fixes + regressions): baseline 8 → advanced 0
harmful PAGES: baseline 5 (18.5% [8.2, 36.7]) → advanced 0 (0.0% [0.0, 12.5])

false-fix rate: baseline 4.3% [1.2, 14.5] | advanced 0.0% [0.0, 7.7]
McNemar harmful-pages: b=5 c=0 χ²=3.20 p=0.0736
McNemar regressions:   b=3 c=0 χ²=1.33 p=0.2482
McNemar false-fix:     b=2 c=0 χ²=0.50 p=0.4795
McNemar true-fix:      b=2 c=0 χ²=0.50 p=0.4795

ABLATION (auditing shipped output at increasing depth):
                        baseline   advanced
{A} declared compliant      26         25
  ...Layer B reveals         2          0  (false-compliances a scanner+B audit catches)
  ...Layer C reveals         2          2  (adds semantic/hallucination catches)
  truly clean {A,B,C}       22         23

Wrote out/metrics.json
```

**Note which ablation this is.** The block above is the *audit-at-depth* view that `run-eval`
prints. It is **not** the gated `{A} → {A,B} → {A,B,C}` ablation we cite as 23 → 9 → 0 — that one
is a separate command, `npm run ablation`, documented below. Earlier revisions of this file wrongly
showed the gated numbers here; if you diffed our expected output against a real run and the
23 → 9 → 0 line was missing, that was our documentation error, not a reproduction failure.

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
model ids.

### The gated ablation (this is what produces 23 → 9 → 0)

```bash
npm run ablation          # → out/ablation.json
```

Expected tail, verbatim:

```
GATE       false-fix pages   true-fix pages   needs-review pages
{A}                  23                2                   0
{A,B}                 9               16                   0
{A,B,C}               0               23                   2

false-fixes caught by adding Layer B: 14
false-fixes caught by adding Layer C: 9
```

### Other entry points

- `npm test` — the offline suite (157 tests, 13 files; needs Chromium installed as above).
- `npm run trajectories` — regenerates `docs/trajectories/` (27 traces + index).
- `npm run determinism` — the 3× proof (below).

**About `docs/report.html`.** It is a **hand-authored document**, not a generated one. It cites the
generated artifacts in [`docs/results/`](docs/results/) — `metrics.json`, `ablation.json`,
`sr-transcript.json`, `real-world-20.json` — and *those* are the reproducible outputs, via
`npm run eval`, `npm run ablation` and the scripts in `eval/`. There is deliberately no report
generator: an earlier one existed, drifted out of step with the hand-authored report, and was
removed rather than left able to overwrite it.

## Determinism proof (3× byte-identical)

```bash
npm run determinism        # or: docker compose run --rm determinism
```

Runs **both** the eval and the gated ablation three times, SHA-256s `out/metrics.json` **and**
`out/ablation.json` on each run, asserts all three of each match, and writes
[`docs/results/DETERMINISM.md`](docs/results/DETERMINISM.md). The six committed hashes are the
evidence that the pipeline is byte-for-byte reproducible. **Runtime: ~60–90 min** (it is six
Playwright-heavy passes, not one).

### Verified from a fresh clone

On **2026-08-30** the sealed numbers were reproduced from a clean checkout, not just re-run in the
authoring tree: `git clone` of origin at commit `60e7204` into a new directory, fresh
`node_modules` via `npm ci`, an **empty** `PLAYWRIGHT_BROWSERS_PATH` with `chromium-1234` installed
separately by `npx playwright install chromium`, Node v22.22.3. `npm run eval` produced an
`out/metrics.json` **byte-identical** to the committed
[`docs/results/metrics.json`](docs/results/metrics.json) (SHA-256 `071387c287b8…`), and
`npm test` passed 157/157.

What was cold: the clone, `node_modules`, `dist/`, and the Playwright browser cache. What was
**not** varied: the same machine, the same OS (Windows) and the same Node version. We have not
tested cross-platform or cross-machine reproduction and do not claim it.

## Expected numbers (the committed reference)

Machine-readable: [`docs/results/metrics.json`](docs/results/metrics.json) and
[`docs/results/ablation.json`](docs/results/ablation.json). Headline: gap **95.8%**, harm
**8 → 0**, false-fix pages **4 → 0**, regressions **6 → 0**, gated ablation **23 → 9 → 0**
(from `npm run ablation`, *not* `npm run eval` — see above), Layer-C judge Cohen's **κ = 0.98**
(a single-annotator calibration check, not inter-annotator reliability). Significance is reported
honestly — not significant at n=27, and the exact tests, effect sizes and limitations are in
[`docs/results/STATISTICS.md`](docs/results/STATISTICS.md).

## Running LIVE (optional — requires an OpenRouter key)

Only needed to re-record cassettes from scratch; not required to reproduce our numbers.

```bash
export OPENROUTER_API_KEY=sk-or-...
export FIXER_MODEL=anthropic/claude-sonnet-5
export JUDGE_MODEL=openai/gpt-4o-mini
npx tsc && A11YFORGE_MODE=record node dist/eval/record-baseline.js   # re-record baseline
A11YFORGE_MODE=record node dist/eval/record-advanced.js               # re-record advanced
A11YFORGE_MODE=record node dist/eval/calibrate-judge.js               # re-record judge + κ
```

`A11YFORGE_MODE=auto` replays existing cassettes and records only missing calls (idempotent,
no re-spend). Fixer and judge are deliberately different model families.

## Notes

- Run agents/eval from compiled `dist/` (via the npm scripts), **not `tsx`** — tsx's esbuild
  shim injects a `__name` helper that breaks Playwright `page.evaluate` bodies.
- Cassettes contain only `{model, temperature, seed, messages}` + response — **no API key**.
