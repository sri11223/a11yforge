# A11yForge — verifiable agentic remediation

**An evaluation harness for agents that never ship a fix they can't verify** — measured by what
the naive agent breaks: **8 harmful changes → 0**, same model, same prompt, only the verify-loop
differs. Accessibility is the proving ground: the rare domain where **"looks fixed" (scanner-green)
and "is fixed" (a screen-reader user succeeds) diverge measurably**, so the difference between a
careful agent and a careless one becomes a number.

## Who this is for, and what's blocking them

**The user we build for** is the developer or team who owns a web product and is accountable for
its accessibility — and, standing behind them, the people who actually navigate that product by
keyboard and by screen reader.

**Their bottleneck is that the only thing which scales is the thing that can't see the problem.**
Automated scanners are cheap, fast and CI-friendly, and they catch roughly **13–57%** of real WCAG
issues. Everything they miss — keyboard traps, scrambled reading order, a label that exists but
means nothing — needs a human with a screen reader, which does not scale to every pull request. So
teams ship a green check and an unusable page. Overlay widgets promise to close that gap and
[don't](https://www.ftc.gov/news-events/news/press-releases/2025/01/ftc-takes-action-against-accessibe-deceiving-consumers-about-its-ai-powered-web-accessibility-tool):
the FTC fined accessiBe **$1M** in 2025 for compliance claims built on exactly that kind of output.
And when a team hands the job to an LLM instead, they get a new failure — fixes that *look* right,
pass the scanner, and are worse than the bug, because nothing in the loop can tell the difference.

**Why closing it is worth doing.** WebAIM's Million report finds **95.9%** of homepages still fail
an automated check — and that check is the shallow one. The cost of the gap is paid twice: in legal
exposure, and by every person who hits a dialog they cannot escape. What's been missing is not
another detector but a way to **verify that a remediation actually worked** before it merges. That
is the whole of what A11yForge does.

## What it is (20 seconds)

- **The tool** — point it at any page and it finds the barriers a scanner misses. This is the path
  we actually run, so it is the one we recommend:
  ```bash
  git clone https://github.com/sri11223/a11yforge && cd a11yforge
  npm ci
  npx playwright install chromium        # required — see the note below
  npm run audit -- <url|path>            # → Layer A/B/C gap report; exit 1 if scanner-clean-but-broken
  ```
  **Why the explicit browser step:** `playwright@1.62.1` ships **no postinstall**, so installing this
  package does *not* download a browser. Layers A and B both drive Playwright Chromium, so without
  that step the audit fails at launch. (pa11y's bundled Puppeteer *does* fetch its own Chrome on
  install, which is why only Playwright needs the extra command.)
  Layer C's judge is optional — set `OPENROUTER_API_KEY` + `JUDGE_MODEL`, else it falls back to
  deterministic backstops.
  <details><summary>Alternative: <code>npx github:…</code> (untested — read this first)</summary>

  `npx github:sri11223/a11yforge audit <url|path>` should work once the repo is public and after a
  separate `npx playwright install chromium`, because the `prepare` script builds on fetch. We have
  **not verified it end-to-end** — the repo was private while this was written, so the path could not
  be exercised, and our packaging test installed a local tarball with the browser download skipped.
  Treat it as unproven until someone runs it. A published `npx a11yforge` follows if we release to npm;
  the **GitHub Action works today** (see "Use in CI").
  </details>
- **The proof** — a reproducible offline eval: the ablation **23 → 9 → 0** (scanner-only verification
  ships 23 broken pages; the full stack ships 0), replayed byte-for-byte from committed cassettes.
- **The field check** — separately, a *live, dated, detection-only* audit of **20 production sites**
  found **206** barriers hidden from scanners (141 excluding one site's repeated animation-ticker
  finding). Live sites change, so this one is evidence, not a reproducible fixture.

**Dev journey (CI):** a developer opens a PR → the A11yForge check **blocks the merge** on a
scanner-clean-but-broken page (keyboard trap, wrong reading order, meaningless alt) → they fix it,
or the agent escalates it to human review. The false-green never merges.

Automated scanners catch only ~13–57% of real WCAG issues. The FTC fined accessiBe $1M (2025)
for false compliance claims. WebAIM Million: 95.9% of homepages still fail. A page can pass
every automated check and still trap a keyboard user, scramble reading order, or ship a
confidently-hallucinated `alt`.

## The evidence, strongest first (reproduced offline — [`docs/results/`](docs/results/))

1. **Categorical — ablation 23 → 0.** A scanner-only verify gate ships **23** broken pages as
   "compliant"; `{A,B}` → **9**; the full `{A,B,C}` stack → **0**. Proof by construction, not a
   p-value.
2. **Real-world — 206 hidden barriers** (141 excluding one site's repeated ticker finding).
   Across **20 live production sites**, Layer-B/C issues a scanner cannot see (honest lower bound;
   a CSP-safe Layer-B injection now measures the formerly CSP-blocked sites). Scanner-clean ≠
   usable, in the wild.
3. **Mechanism — harm eliminated.** A fair single-shot baseline ships 6 regressions + 2
   false-fixes; the verify-loop + regression guard ship **zero** (same model, same prompt).
   Holds on the sealed 27 and on the extended 45, where it reaches significance — with the
   caveats below, which we state rather than let a reader find.
4. **Integrity — 2 escalations, 0 guesses** (n=27; 4 at n=45). Where an alt can't be grounded in
   the page's own markup, the agent flags it for a human instead of inventing a description.

### Measured twice: the sealed 27, and an extended 45

| Measure | n=27 (sealed, determinism-proven) | n=45 (extended superset) |
|---|---|---|
| Gap (axe-clean pages still failing B/C) | 95.8% | 97.4% |
| Harmful changes shipped | 8 → 0 | 10 → 0 |
| Harmed pages | 5 → 0 | 6 → 0 |
| Ablation (false-fix pages by verify depth) | 23 → 9 → 0 | 38 → 13 → 0 |
| Harm significance (two-sided) | p=0.074 χ² / **0.063 exact** — not significant, underpowered | p=0.041 χ² / **0.031 exact** — **significant** |

The 45-page set is the **same 27 pages plus 18 more** generated by a different procedure
(`injected-v2`) — a superset, **not a second independent study**; we say so because anyone checking the
buckets sees the overlap immediately. Every pattern holds when the corpus is extended. Two honest
limits: at n=27 there are only 5 discordant pairs and, with c=0, the smallest *attainable* two-sided
exact p is 0.0625, so that set **cannot** reach α=0.05 on this contrast by construction; and the 18
extra pages contributed exactly **one** more discordant pair (b: 5 → 6), so **crossing α=0.05 rests on
a single extra harmed page**. The direction is consistent everywhere we measured (c=0 on every harm
contrast), but we will not dress that up as more than it is.

### The trade-off, with its accounting

**The baseline fixes more issues than we do** — 44 vs 42 at n=27, 66 vs 60 at n=45 — and at n=45 that
coverage difference is **itself significant, in the baseline's favour** (exact p=0.031). It is not a
failure to find fixes: it is deliberate abstention under the never-ship-what-you-can't-verify
invariant, and every forgone issue is accounted for — at n=45, **4 escalated to a human + 4 left
unresolved = 8 declined**, against the baseline's 0.

So the quantified trade: **forgo 8 issues of automatic coverage, eliminate 10 harmful changes across
6 pages** — both effects significant at n=45, in opposite directions.

### The claim hierarchy — and the p-value is *not* the top of it

Ordered by robustness, not by which number sounds best:

1. **Zero counter-examples (primary).** Across **all 45 pages**, on every harm contrast in both
   sets, the advanced-only cell is **c = 0** — not one case where the verified agent harmed a page
   the baseline left intact, false-fixed where the baseline did not, or regressed where it did not.
   No counter-examples, and it does not hinge on a single pair.
2. **Categorical harm elimination.** 8 → 0 and 10 → 0 harmful changes; false-fix rate 4.3% → 0% and
   2.9% → 0%; harmful-page rate 18.5% → 0% and 13.3% → 0%, with **non-overlapping Wilson intervals
   at n=45**. Counts, not inference.
3. **Dose-response.** False-fix pages fall monotonically with verification depth — 23 → 9 → 0 and
   38 → 13 → 0, same shape on both sets, independent of discordant-pair counts. (A pattern, not a
   formal trend test.)
4. **The significance test, last, with its fragility inline.** Harm is significant at n=45 (exact
   0.031) but not at n=27 (exact 0.0625 — which is the *α-floor* there), and the crossing rests on a
   single additional discordant pair. It corroborates; it does not carry the argument.

**The significance test is the weakest evidence we have here, not the strongest — the robust finding
is that across 45 pages the verified agent never once did harm the baseline avoided.** Full
derivation, exact tests, effect sizes (ARR, NNT) and limitations:
[`docs/results/STATISTICS.md`](docs/results/STATISTICS.md).

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

**Verified from a fresh clone (2026-08-30).** Not just re-run in the authoring tree: a `git clone`
of origin at `60e7204` into a new directory, fresh `node_modules` via `npm ci`, an **empty**
`PLAYWRIGHT_BROWSERS_PATH` with `chromium-1234` installed separately, Node v22.22.3 — `npm run eval`
produced an `out/metrics.json` **byte-identical** to the committed
[`docs/results/metrics.json`](docs/results/metrics.json), and `npm test` passed 157/157. Cold: the
clone, `node_modules`, `dist/`, the browser cache. Not varied: same machine, same OS, same Node — we
have not tested cross-platform reproduction and do not claim it.


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

## Related work — independent convergence, and how we differ

Three 2025–26 papers converged, in parallel with this build, on parts of the same design. We do not
predate them and do not claim to outperform them overall; our contribution is **depth of
verification per fix**, not repair breadth.

**External corroboration of our central claim:** Wanscher et al. ran a dual-condition protocol
measuring harm as carefully as benefit — six small open-weight models over twenty live sites — and
report that **unverified generation improved and regressed pages at similar rates (24 improvements
vs 20 regressions)**. An independent team, different stack, our conclusion. A11yForge's verification
is what closes that gap (harm 8 → 0, same model and prompt).

| Work | Theirs | Ours (delta) |
|---|---|---|
| **Verified Repair** — Wanscher, Lorensen, Shafiq, Moghaddam, Alipour ([arXiv:2608.24913](https://arxiv.org/abs/2608.24913)) | Chrome extension, local 7B–14B models, **additive CSS** over 18 WCAG/W3C cognitive metrics; audit–inject–verify that **accepts only if violations strictly decrease**; trilingual seeded-violation benchmark (57 detected, no false positives; 126 harmful candidates rejected) | Closest work — they independently invented the strictly-decrease gate and seeded benchmark. They are **CSS-only, never generate content**; we repair HTML/ARIA/alt. They verify via axe + computed-style probes; we add a **CDP a11y-tree layer, a virtual-screen-reader transcript, and a calibrated LLM judge**. They report **no inter-rater statistic** (their flagged limitation); we publish **Cohen's κ** vs a human anchor set. Their guarantees were validated with **stub generators**; ours against a **real LLM fixer** under byte-identical cassette replay |
| **AccessGuru** — Fathallah, Hernández, Staab ([arXiv:2507.19549](https://arxiv.org/abs/2507.19549)) | **Syntactic / Semantic / Layout** taxonomy driving prompting + metrics; real-world-violation benchmark; semantic accuracy vs human expert corrections; up to **84%** avg violation-score decrease (vs ≤50% prior) | Their taxonomy **parallels our mechanical/semantic/behavioral routing** — acknowledged, not claimed as ours. We add a **pre-commit regression guard** (fix-by-deletion/hiding rejected at the gate) and a structural **grounded-or-escalate** rule for alt text |
| **A11YRepair** — Huang, Zhu, Zhang, Xie, Chen ([arXiv:2606.21926](https://arxiv.org/abs/2606.21926), ASE 2026) | **Repo-level** source repair: clusters related violations, decomposes by root cause, WCAG-driven localization/synthesis; A11YBench (60 real GitHub projects); patches **merged into Google, Microsoft, Facebook, IBM, Kubernetes, Docker, Alibaba** projects | **Our scope limitation, said plainly:** they are repo-level across many files with landed upstream patches; **A11yForge is single-page**. Orthogonal contribution — verification depth per fix, not breadth |

Stated with the same hedging as our own numbers: **we are not aware of any tool or paper that
ships** (a) a screen-reader-transcript verification layer inside the fix loop, (b) a structural
*grounded-or-escalate* invariant making alt hallucination impossible rather than discouraged, or
(c) a fully cassette-sealed, byte-identical-replayable remediation evaluation.

## Deliverables

- **Code + improvement changelog:** this repo · [`docs/CHANGELOG.md`](docs/CHANGELOG.md)
- **Reproduction guide:** [`REPRODUCE.md`](REPRODUCE.md)
- **End-to-end report:** [`docs/report.html`](docs/report.html) (self-contained)
- **Agent trajectories:** [`docs/trajectories/`](docs/trajectories/) — "Traces for every agent we
  used": runtime decision traces (readable + raw JSONL), a [reflexion deep-dive](docs/trajectories/reflexion-icon-only-control.md)
  and a [baseline-vs-advanced contrast](docs/trajectories/contrast-alt-generic.md) quoting the
  actual model I/O from the 151 committed [`cassettes/`](cassettes/), plus the coding-agent build trace.
- **Coding-agent trajectory (how the repo was built):** [`docs/WORK_TRAJECTORY.md`](docs/WORK_TRAJECTORY.md) — the two-agent (orchestrator + builder) build trace, step by step, each backed by a commit
- **Coding-agent disclosure & build arc:** [`docs/CODING_AGENT.md`](docs/CODING_AGENT.md)
- **Design decisions:** [`docs/BRAINSTORM.md`](docs/BRAINSTORM.md) · **Build log:** [`docs/BUILD_LOG.md`](docs/BUILD_LOG.md)

## Stack

TypeScript / Node 22 · Playwright (Chromium, pinned) · axe-core · pa11y ·
@guidepup/virtual-screen-reader · cheerio · OpenRouter (fixer `claude-sonnet-5`, judge
`gpt-4o-mini` — different families, temperature 0, fixed seed) · Docker.

## Status

Complete. `npm test` (offline) green; metrics + ablation reproduce byte-identical.

## The main failure mode

**The dangerous failure is not laziness — it is confident hallucination.** A strong model asked to
fix a generic `alt` will happily invent a description for an image it has never seen: *"Lumen
product packaging boxes stacked in warm lighting."* Fluent, specific, plausible, and wrong. Every
automated layer waves it through — axe passes it, the deterministic backstops pass it, and even a
second LLM judge, also blind to the image, rates it meaningful. It is *more* dangerous than the
original bug, because the original bug was at least detectable.

That is why the fix is **structural, not a prompt instruction**: the agent may write `alt` only from
grounding already present in the page (a caption, a heading, a link target), and where no grounding
exists it leaves the original untouched and escalates to a human. Hallucination is made
*impossible*, not *discouraged*. The honest cost is visible in our own numbers — the baseline fixes
**more** issues than we do (44 vs 42 on the sealed corpus, 66 vs 60 extended, significant at n=45),
because we decline 4 and 8 respectively where it declines none. We publish that row.

Our other real limitations, stated in full in [`docs/results/STATISTICS.md`](docs/results/STATISTICS.md):
significance on harm rests on a single additional discordant pair; the corpus is adversarial by
construction, so **95.8%** is a property of the test set and not a field prevalence claim; κ is a
single-annotator calibration check rather than a reliability study; Layer B is a deterministic
simulator of reading order and operability, **not** a bug-for-bug NVDA/JAWS replica and no
substitute for testing with real screen-reader users; and the 20-site field number is dated,
detection-only, and a lower bound.

## Hot take

**Scanner-green is not a measure of accessibility — it is a measure of what your scanner can see,
and an agent optimising against it will happily make the page worse while turning the check green.**

The industry's mistake was not weak detection; it was treating *"the checker passes"* as
*"the fix worked."* An LLM handed that objective learns the cheapest way to satisfy it: empty the
`alt`, hide the offending node, invent a description. Every one of those is scanner-green and
user-hostile, which is precisely why the FTC action landed.

So the useful unit of progress in agentic remediation is not fix count — it is **harm shipped**, and
the only defensible way to drive it to zero is to make the agent prove usability against layers the
fixer cannot game, and to let it **refuse** when it cannot. An agent that declines is worth more
than an agent that guesses. We would rather ship 42 verified fixes and 4 honest escalations than 44
fixes and 8 harms we didn't notice.
