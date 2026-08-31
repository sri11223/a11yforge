# Reproducing A11yForge

Everything below runs **offline in replay mode** — it replays committed, content-hashed LLM
cassettes, so it needs **no OpenRouter API key**, makes **no network LLM calls**, and costs
**≈ $0**. A judge on a clean machine gets the same numbers we report.


## The 60-second version (start here)

The fastest currently-documented path is 20–35 minutes. This one is about a minute and it is the
whole thesis: a page every automated scanner passes, that a keyboard user cannot escape.

```bash
git clone https://github.com/sri11223/a11yforge.git && cd a11yforge
npm ci && npx playwright install chromium chromium-headless-shell && npm run build
node dist/src/cli/audit.js audit corpus/adversarial/keyboard-trap-modal/index.html --no-llm; echo $?
```

Expect: `Automated scanner (Layer A): 0 violations — 'clean'`, then three issues a scanner cannot
see, then **`1`** from `echo $?`. That non-zero exit is what a CI gate turns into a failed check.

## Prerequisites

| | |
| --- | --- |
| **Node** | 22.x (see `.nvmrc`; `engines` is `>=22 <23`) with npm 10+ |
| **or Docker** | with Compose **V2** — the commands below use `docker compose`, not `docker-compose` |
| **Network** | the npm registry, plus the Chrome-for-Testing CDN. pa11y's Puppeteer pulls its own Chrome (~180 MB) unless you set `A11YFORGE_PA11Y_CHROMIUM=1` to reuse the Playwright build |
| **API key** | **none, at any point**, for everything under this heading |
| **Disk** | ≈ 50 MB clone + ~700 MB `node_modules` + ~150 MB Playwright Chromium + ~180 MB pa11y Chrome — or ~2–3 GB for the Docker image |
| **Working dir** | run every command from the repo root: cassette and corpus paths resolve from `process.cwd()` |
| **Verified on** | Windows 11 with Node 22.22.3. Other platforms and Node minors are untested — we do not claim them. |

## Option A — Docker (only Docker required)

> **Status of this path.** `Dockerfile` previously ran `npm ci` while `package.json` had
> `"prepare": "npm run build"`, so tsc ran before the source was copied and failed the install. That
> is now `npm ci --ignore-scripts`. **We have not re-verified the in-container byte-match since that
> fix** — no Docker daemon was available on the authoring machine. The last confirmed in-container
> reproduction predates the `prepare` script; the local path in Option B is the one verified from a
> fresh clone (see below).

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
npx playwright install chromium chromium-headless-shell
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

### The solution itself, on any page you like

The eval above measures the agent; this is the agent. It needs no key and no corpus — point it at a
URL or a local file:

```bash
npm run audit -- corpus/adversarial/keyboard-trap-modal/index.html --no-llm
npm run audit -- https://example.com
npm run audit -- <url|path> --html gap.html      # also writes a standalone HTML report
```

Flags: `--no-llm` (deterministic backstops only, no key needed) · `--html <file>` ·
`--timeout <ms>` (URL navigation, default 30000) · `--ci` (strict: non-zero if *any* issue is found,
A/B or C) · `--help`.

**Exit codes are the product:** `0` = nothing a scanner misses · `1` = gaps found · `2` = usage or
fetch error. That `1` is what the GitHub Action turns into a failed check.

**What to expect** on the trap page above: Layer A reports `0 violations — 'clean'`, then
`SCANNER-CLEAN ≠ USABLE — 3 issue(s) a scanner cannot see`, listing WCAG 2.1.2 (focus trapped),
2.1.1 (click handler on a non-focusable element) and 4.1.2 (no accessible name), each with a
selector — and the process exits `1`.
**Runtime** a few seconds per page. **Cost** $0 without a key; a fraction of a cent per page with
one, since only Layer C calls a model.

### The two arms being compared

There is no separate baseline command: `npm run eval` runs **both** arms in the same process over
the same corpus, same model, same seed, same token budget — only the pipeline differs, which is the
point. If you want to read them:

- **baseline** — [`src/agents/baseline.ts`](src/agents/baseline.ts): one LLM call given the page plus
  the same Layer-A violation list, apply the output, stop. No routing, no verify-loop, no regression
  guard, no checkpoint.
- **advanced** — [`src/agents/advanced.ts`](src/agents/advanced.ts): route → fix attempt →
  pre-commit regression guard → re-verify A/B/C → accept, reflex (max 3, diagnostic fed back), or
  escalate.

The comparison is **paired per issue** on identical pages, which is why McNemar is the right test and
why `metrics.json` reports both arms side by side.

### Other entry points

- `npm test` — the offline suite (157 tests, 13 files; needs Chromium installed as above).
- `npm run trajectories` — regenerates `docs/builder-trajectories/` (27 traces + index).
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


### Did you get *our* numbers?

`npm run determinism` compares three consecutive runs **against each other**, which passes even if
the pipeline has drifted away from every published number. To check your run against what we
published:

```bash
sha256sum out/metrics.json docs/results/metrics.json
sha256sum out/ablation.json docs/results/ablation.json
```

Both pairs must match. The committed values are:

```
metrics.json   071387c287b8ba042e6645afaeaffd95a61ea976b881cb08e8d13f23e722f3a6
ablation.json  93d88b2305a6b9595aebbdf53b88867da961ede2f33e9fab795c474128de16d2
```

`eval/determinism-proof.ts` now asserts this equality too, so a drifted pipeline fails the proof
instead of passing it.

### Commands for numbers that had none

| Number | Command | Notes |
| --- | --- | --- |
| n=45 column, ablation **38 → 13 → 0** | `A11YFORGE_WIDE=1 npm run eval` then `A11YFORGE_WIDE=1 npm run ablation` | writes `out/metrics-wide.json` / `out/ablation-wide.json`; roughly 1.7× the n=27 runtimes |
| gated ablation runtime | `npm run ablation` | three gated passes, so ≈ 3× the eval — budget ~60–105 min |
| κ = **0.9792** | `A11YFORGE_MODE=replay JUDGE_MODEL=openai/gpt-4o-mini node dist/eval/calibrate-judge.js` | offline from committed judge cassettes. `JUDGE_MODEL` has **no default** here, so the bare command throws. It rewrites the tracked `corpus/anchor-set/kappa.json`. |
| **206** real-site barriers | `npx tsc && node dist/eval/audit-real-20.js` (no npm script) | **live, key-requiring, dated and non-deterministic** — deliberately outside the reproducible offline path. `audit-real`/`snapshot-real` cannot run from a fresh clone: `corpus/real/**/index.html` is gitignored. |
| `docs/builder-trajectories/*.md` + `narration-diff.*` | `npm run trajectories` | needs Chromium; ~18 min |
| `docs/builder-trajectories/judge-verdicts.md` | `node eval/export-judge-trajectory.mjs` | reads cassettes only; instant |

### One exception to the offline guarantee

`src/cli/audit.ts` sets `A11YFORGE_MODE ??= "live"` when **both** `OPENROUTER_API_KEY` and
`JUDGE_MODEL` are in the environment. If you have a key in your shell profile, the `audit` examples
above will make **billed live calls**. Pass `--no-llm`, or unset the key, to stay offline.

`docker-compose.yml` mounts `./docs/results` read-write for the determinism service, so that run
**overwrites the committed `DETERMINISM.md`** and dirties your tree. Expected; `git checkout
docs/results/DETERMINISM.md` restores it.

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
