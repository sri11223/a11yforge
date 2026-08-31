# How A11yForge was built — the two-agent work trajectory

This is the honest trajectory of the **coding agents** that built A11yForge (the required
"agent trajectories for every agent you used" deliverable, coding-agent side). The runtime
agent's own traces are in [`trajectories/`](trajectories/); the tool disclosure is in
[`CODING_AGENT.md`](CODING_AGENT.md).

> **The machine-checkable counterpart to this narrative** is
> [`coding-agent-trajectories/`](../coding-agent-trajectories/): every orchestrator instruction and every
> builder tool call, extracted from the session records. Tool-result bodies are omitted and secrets
> redacted — see that folder's README for why.

## The setup

Two Claude **Opus 5** (`anthropic/claude-opus-5`) agents ran a disciplined build loop:

- an **Orchestrator** held the plan and sent the Builder **one step at a time**;
- the **Builder** did all the work (code, tests, corpus, docs, git) in the repo;
- after every step the Builder **verified against real files** (`tsc`, `vitest`, file/JSON
  checks, `git`), reported back, and the Orchestrator **verified independently** before
  green-lighting the next step.

> **Commit-hash note.** A message-only history rewrite re-created every commit, so the hashes cited
> in earlier drafts of this file no longer resolve on the public repo. Every SHA below has been
> re-pointed to its post-rewrite equivalent, and each was verified two ways: reachable from `HEAD`
> (`git merge-base --is-ancestor <sha> HEAD`) and **byte-identical tree**
> (`git rev-parse <old>^{tree}` equals `<new>^{tree}`). 23 of 23 passed both checks.

Runtime LLMs (used by the product, not the coding loop) are disclosed in `CODING_AGENT.md`:
OpenRouter fixer `claude-sonnet-5` + judge `gpt-4o-mini` (different families, temp 0, seed),
everything replay-cassette reproducible. Every claim below is backed by a real commit.

## The build, step by step

Format: **instruction (gist) → what the Builder did (commit) → how it was verified → the
decision that shaped the next step.**

1. **Brainstorm & lock decisions.** *"For each design choice, list alternatives → tradeoffs →
   decision."* → `docs/BRAINSTORM.md`, private repo created (**7543a7a**). Verified: repo
   private on GitHub, doc covers all 7 decisions. → Locked three-layer design + κ-gating +
   fair-baseline rule.
2. **Scaffold.** *"ESM + strict TS, pin exact deps, cassette client, hello-axe smoke test."*
   → toolchain + typed stubs + record/replay cassettes (**fed9787**). Verified: `tsc` clean,
   smoke test detects `image-alt`. Snags fixed in the open: dropped `verbatimModuleSyntax`
   (broke axe's CJS import), axe needs `browser.newContext()`.
3. **Corpus (the thesis).** *"Build realistic adversarial pages that pass axe but fail real
   use; nail the 5 scanner-invisible ones."* → 15 pages + ground-truth manifests
   (**7e7f253**). Verified: a test HARD-asserts the 5 invisible pages are **zero-violation**
   under a WCAG axe scan — the thesis proven mechanically; all 15 manifests schema-valid.
4. **Layer A (axe + pa11y).** *"Two engines, normalized, deterministic."* → `Finding[]`
   normalizer, stable-sorted (**cf8776d**). **Self-catch / anti-cherry-pick:** a probe showed
   pa11y flags `heading-skip` only as a *warning* and axe's heading rule is *best-practice*;
   including those would also flag two B-exclusive pages and break the gap proof — so Layer A
   counts **definite failures only** and `heading-skip` was **reclassified A→B**. Reported the
   deviation; Orchestrator signed off ("the honest, uniform principle").
5. **Layer B (SR/keyboard).** *"Virtual-SR + CDP, deterministic; catch what it should, never
   cry wolf."* → 8 behavioral checks (**c5aa025**). Verified: each violation caught on the
   right page; the 7 B-clean pages produce zero findings; byte-identical across runs.
6. **Layer C (semantic judge).** *"Deterministic backstops first, then a κ-calibrated LLM
   judge, different family from the fixer."* → backstops + judge + 64-item expert anchor set
   (**4d8e448**). Verified: **Cohen's κ = 0.9792** (hard gate), recorded then reproduced
   offline; a key was present so real cassettes were recorded and committed.
7. **Fair baseline.** *"One shot, same model/prompt/seed; only the pipeline differs."* →
   baseline + scanner-only reference + scan-all harness (**5f1c28d**). **Reframing finding:**
   `claude-sonnet-5` single-shot is *genuinely strong* — it did not do crude `alt=""`/hiding.
   Reported honestly; the Orchestrator re-framed the win from "fixes more" to **harm
   elimination**, and told us to hold onto the confident-hallucination insight as the hot take.
8. **Advanced agent.** *"Route → verify-loop[A,B,C] → regression guard → human checkpoint →
   memory."* → supporting modules (**1524604**) then the verify-loop (**ee13f7c**).
   **Best decision in the build:** an early router sent alt to the LLM and it *fabricated*
   descriptions for images it never saw. We caught it, **removed the C→LLM alt path**, and made
   alt **rule-from-grounding-or-escalate** — the alt path no longer calls the LLM, so there is no alt-writing prompt to jailbreak. Routed around rather than sealed (a behavioural fix returns a whole document the guard does not screen for invented alt), and not
   discouraged. Verified: icon-only-control ends A/B clean; ungrounded hero → needs-review with
   alt untouched.
9. **Metrics + ablation.** *"Per-issue + per-page gap/true-fix/false-fix/regression; McNemar;
   honest small-n; add the injected bucket for power; ablate the layers."* → scorer
   (**c9db197**), full eval + injected bucket + gated ablation (**72775d2**), plus a fix to
   actually track the results JSON that a broad `results/` gitignore had swallowed
   (**48425fe**). Verified offline: **gap 95.8%**, **harm 8→0**, **ablation 23→9→0**.
   **Refused to fake significance:** McNemar p=0.074 (harmful-pages) — reported as *not
   significant at n=27*; led with the significance-independent ablation instead. Orchestrator:
   "do NOT widen the corpus just to chase p<0.05."
10. **Report + trajectories + disclosure.** *"A report a person would sign; export the runtime
    trajectories; disclose the coding agents."* → `report.html` (**9f77b0e**), trajectories
    (**80601d9**), disclosure + build log (**3bf7d37**). **Self-catch:** discovered the
    virtual SR had been **silently disabled** since step 5 (a wrong module-resolve path); fixed
    it (**2f07427**), then found the SR pollutes same-page checks and isolated it (**80601d9**), and added a
    guard test that fails loudly on silent fallback (**a4676c0**). Re-verified: metrics
    reproduce **byte-identical** — the fix moved no number.
11. **Reproducibility.** *"Docker + one command, offline replay, 3× determinism proof."* →
    Dockerfile (pinned browser rev) + Makefile + `npm run eval` + REPRODUCE.md (**ceffb52**),
    then a proof that hashes metrics.json AND ablation.json (**d48662d**). The one command runs
    with **no API key**. Corrected the last over-claim: annotated BRAINSTORM's "virtual-SR
    primary" with the implemented reality (deterministic CDP/DOM = source of truth).
12. **V2 (product-grade), one item at a time.** *"Make it a real tool."* → production
    `a11yforge audit <url|path>` CLI with `--json/--html/--ci/--no-llm/--timeout`, graceful
    errors, CI exit codes, offline fallback, tests (**2932e0d** → **3ca575c**); real-world
    detection-only snapshot bucket + 18 more fair injected pages in a separate bucket, and a
    before/after screenshot util (**f34747a**, **dd5bf00**) — all authored without disturbing
    the running determinism proof (`corpus/injected-v2/`; no change to the eval path the determinism proof runs — it did add `eval/build-injected-v2.ts` and `eval/snapshot-real.ts`).
13. **V2 item 3 — robustness at scale + the silent-ship self-catch.** *"Widen to 45 pages as a
    supplementary check; never overwrite the sealed V1."* → wide-mode eval/ablation writing
    separate `*-wide.json` files. The widened run **exposed a real bug in our own agent** (two
    `not-focusable` pages shipped A-clean-but-broken with no flag). We generalized the escalation
    rule to a universal invariant, **proved byte-identical on the sealed 27** (fix is a no-op
    there), then re-ran wide: harmful pages 2→0, ablation 38→13→0, gap 97.4%. Reported the
    significance honestly (harmful-pages p=0.041 *on our own corpus, a byproduct of the fix*) and
    the cost of conservatism (baseline true-fixes 6 the advanced escalates, p=0.041 χ² / 0.031
    exact, in the baseline's favour). Kept 27 as the headline; added a "Robustness at scale"
    section. *(Corrected: this line previously read 7 and p=0.023, which matched neither
    `metrics-wide.json` — `mcnemar.trueFix.b = 6`, `p = 0.0412` — nor any other document. It was
    the only place those figures appeared.)*

## The honest self-catches (the part we're proudest of)

- **heading-skip A→B** — refused to cherry-pick a rule that would have flattered Layer A.
- **"the baseline is strong"** — reported it plainly and let it reframe the win to harm
  elimination, rather than rigging a weak baseline.
- **Removed the C→LLM alt path** — caught the model confidently hallucinating alt and made it
  routed around rather than merely discouraged — though not sealed, since the guard does not screen a behavioural fix for invented alt; this became the hot take.
- **Silently-disabled virtual SR** — found it, fixed it, and *proved* the metrics were
  unaffected (byte-identical), documenting the whole thing.
- **Refused to fake significance** — reported p=0.074 as not significant; led with the
  ablation, which doesn't depend on discordant-pair counts.
- **The silent-ship self-catch (our thesis, on us — again, and worse)** — widening the eval
  corpus from 27 to 45 pages caught the advanced agent *silently shipping a scanner-clean-but-broken
  page*: two `not-focusable` keyboard controls it couldn't fix were left in the output as A-clean
  with no flag. The escalation invariant had only ever covered ungrounded alt; an unresolvable
  behavioral issue slipped through. We generalized it to **"never ship an issue you can't verify"**
  (any residual A/B/C after the verify-loop → human checkpoint, never emitted as done). Critically,
  we proved the fix is **byte-identical on the sealed 27-page corpus** before adopting it — the bug
  never manifested there, so the determinism-proven headline stands — and kept 27 as the headline
  with 45 as a supplementary robustness section (gap 97.4%, ablation 38→13→0, harmful pages 6→0).
  Finding our own product's exact failure mode inside our own agent, and fixing it by principle
  rather than patch, is the self-catch we're proudest of.
- **The stale-diff false-positive (our own thesis, on us)** — Docker-verifying the clean-env
  build surfaced two real qualification-gate bugs a judge would have hit: `npm ci` aborting on
  an ERESOLVE peer conflict, and pa11y's Puppeteer failing to find Chrome in the image. Worse,
  the first "container reproduces the metrics ✅" was a **false green**: the container had
  crashed and the diff was comparing a *stale* `out/metrics.json` from a prior local run. We
  caught it (the container also printed a non-zero exit), fixed the *check* (delete `out/`
  first so the diff can only pass on a genuine fresh container write), fixed the image (legacy
  peer deps; pa11y reuses the image's Playwright Chromium), and only then confirmed a true
  byte-match. This is literally our own thesis — *a green check you don't validate is false
  comfort; scanner-clean ≠ usable* — playing out in our own build harness.

## Human/orchestrator checkpoints

Every step above was gated: the Orchestrator independently verified commits, corrected course
(reframing to harm-elimination; "don't chase p<0.05"; keep V2 one-at-a-time), signed off on
each deviation (the Layer-A principle, the no-LLM-alt invariant, the SR fix), and steered the
report's framing (lead with gap 95.8% / harm 8→0 / integrity). The discipline — small verified
steps, honest deviations surfaced immediately, nothing shipped that couldn't be reproduced —
is the method, not just the result.
