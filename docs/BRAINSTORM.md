# A11yForge — Design Brainstorm (locked decisions)

> "Scanner-clean ≠ usable." An agent that fixes WCAG violations **and** proves, with a
> reproducible number, how often a scanner-clean fix is still unusable to a screen-reader user.
>
> Evidence backing the thesis: automated scanners catch only ~13–57% of real WCAG issues;
> the FTC fined accessiBe $1M (2025) for false compliance claims; WebAIM Million reports 95.9%
> of homepages still fail. Our job is to *measure* that gap honestly and *close* it with an agent
> whose fixes are gated on real usability, not on re-running the scanner.

For each key decision below: **Alternatives → Tradeoffs → Decision + why.**

---

## 1. Verify-loop architecture

**Alternatives**
- **A. Whole-page passes.** Fix everything in one shot, re-run A/B/C on the whole page, repeat until clean or budget spent.
- **B. Per-violation passes.** Iterate each violation individually; verify each fix in isolation.
- **C. Hybrid — per-violation fix + local accept criteria + whole-page regression sweep after each applied fix.**

**Tradeoffs**
- Whole-page is simplest and cheapest in LLM calls, but attribution is terrible: you can't tell which edit resolved (or broke) what, one bad fix can mask another, and the regression guard has nothing to anchor to.
- Per-violation gives clean attribution and lets the regression guard reason about a single localized change, but pure isolation misses cross-violation interactions (fixing focus order can change what a live region announces).
- Hybrid keeps attribution and adds a global sweep so interactions are caught, at the cost of more verifier runs per iteration.

**Decision — C (hybrid).** Loop is **per-violation with a whole-page regression sweep after every applied fix.**
- **Accept criteria for a candidate fix to violation `v`:** (A) `v` no longer appears in Layer A; **and** (B) the Layer-B checks relevant to `v` pass (accessible name present, element focusable/operable, focus order unchanged, no new trap); **and** (C) if `v` is semantic, the judge returns *meaningful* **or** a deterministic backstop passes; **and** the **regression guard** finds no new A/B/C failure anywhere on the page and no structural content loss.
- **Regression guard is part of accept criteria, not a post-hoc check.** It runs on the candidate DOM *before* the fix is committed to the working document, so a "fix by deleting/hiding" is rejected at the gate. It compares before/after snapshots of (i) accessible-node count, (ii) visible-text inventory, (iii) focusable-control set, (iv) informative/decorative status from ground truth. Reject if a fix reduces accessible nodes, removes informative content, silently converts informative→decorative, or drops a previously-focusable control.
- **Retry / backoff:** bounded **reflexion** — max **3** attempts per violation. On rejection, the structured verifier diagnostics (which layer failed, why) are fed back into the fixer prompt for the next attempt. No time-based backoff inside the loop (it's deterministic, temp=0); only transient LLM/network errors get a small fixed retry. After 3 failed attempts, mark the violation **unresolved**; if the failure is semantic ambiguity, route to the **human checkpoint** instead of guessing.

**Why:** attribution + regression safety are the whole point of the "advanced" agent and directly serve the "catch fix-by-deleting" requirement. The extra verifier cost is acceptable because verification is deterministic and cheap relative to the credibility it buys.

---

## 2. Layer B engine (the screen-reader layer)

**Alternatives**
- **A. Real screen reader** via `@guidepup/guidepup` driving NVDA (Windows) / VoiceOver (macOS).
- **B. Virtual screen reader** — `@guidepup/virtual-screen-reader`, operating on the real accessibility tree in a headless browser.
- **C. Pure CDP AX-tree walk** — `Accessibility.getFullAXTree` + a Tab-order walk, no SR dependency at all.

**Tradeoffs**
- Real SR has the highest fidelity — actual announcement strings from NVDA/JAWS/VoiceOver — but it is **OS-locked** (VoiceOver=macOS-only, NVDA=Windows-only), **timing-flaky** (speech-server state varies run to run), and **not Dockerable**. Making it the critical path would destroy reproducibility (15 pts).
- Virtual SR is **deterministic, cross-platform, headless-Docker-friendly**, and reads the *real* accessibility tree (role/name/state), which is exactly what focus-order / operability / accessible-name checks need. Its limitation: it **approximates** SR navigation and announcement; it is not a bug-for-bug replica of any shipping SR's announcement strings.
- Pure CDP is **fully deterministic** with no extra moving parts and gives roles/names/states/focusability directly, but it models the *tree* rather than *SR navigation semantics*, so it's a weaker instrument for "what would a user actually experience walking this page."

> **⚠ Correction (implementation reality — see [`CODING_AGENT.md`](CODING_AGENT.md)):**
> This planned "virtual-SR primary" decision was **reversed in implementation**, and we
> keep the original text here only as the historical plan. In the shipped code the
> **deterministic CDP/DOM checks are the source of truth for Layer B findings** (focus-order
> Tab walk, `getEventListeners` operability, MutationObserver live-region, heading/skip-link,
> bounding-box order); the **virtual-SR provides the announcement transcript as evidence +
> cross-check**, not the detection. This is stricter, deterministic, and it's why the metrics
> are byte-identical whether the SR is engaged or not. (A bug had the SR silently disabled for
> several steps; the findings never depended on it — confirmed by byte-identical re-runs.)

**Decision (as planned) — B primary, C as corroborating cross-check, C as the degraded fallback.**
- **Primary:** `@guidepup/virtual-screen-reader` drives the Layer-B traversal.
- **Cross-check:** every Layer-B run also pulls `Accessibility.getFullAXTree` via CDP and asserts the two agree on roles/names/focusable set (belt-and-suspenders; disagreement is logged as a warning, not a silent pass).
- **Fallback:** if virtual-SR proves flaky in CI, Layer B degrades to the **pure-CDP** walk (focus-order Tab-cycle, trap detection, accessible-name presence) which is 100% deterministic. The finding survives the fallback.
- **Optional real-SR spot-check:** a `GUIDEPUP_REAL=1` profile runs a small subset against real NVDA/VoiceOver on a developer machine, reported **separately as corroboration** — never in the reproducible critical path.

**Honest caveat (stated in README + report):** Layer B is a **simulator of reading order, keyboard operability, and accessible-name presence — NOT a bug-for-bug NVDA/JAWS/VoiceOver replica.** We do **not** claim literal announcement-string equivalence. We claim fidelity of *structure, order, and operability*, which is where the scanner gap actually lives.

**What Layer B checks:** focus/reading order (DOM+tab order vs visual order), keyboard traps (Tab cycle never escapes; Esc fails to dismiss), accessible-name presence on interactive elements, live-region presence for dynamic content, skip-link target validity, and positive-`tabindex` reading-order scrambling.

---

## 3. Layer C — LLM judge, calibration, and κ-gating

**Alternatives for trusting the judge**
- **A. Trust the LLM judge outright** as a hard gate.
- **B. Calibrate against a human anchor set and gate on Cohen's κ, with deterministic backstops.**
- **C. Skip the LLM entirely; use only deterministic string/regex rules for semantics.**

**Tradeoffs**
- Trusting outright is fast but circular — an LLM grading an LLM invites correlated blind spots, and a miscalibrated judge either rubber-stamps garbage alt (thesis undermined) or rejects good fixes (advanced agent looks worse than baseline).
- Calibration + κ-gating makes the judge's reliability an *empirical, published* number and degrades gracefully when it's weak — but requires building and labeling an anchor set.
- Deterministic-only can't tell "a smiling barista holding a latte" (good) from "a person" (weak-but-not-wrong); it under-detects semantic nuance. But it *cannot be gamed by model bias* and needs no key.

**Decision — B, with C's rules as the floor.**
- **Calibration:** hand-label an anchor set of alt/label samples across `good | generic | wrong | decorative-misuse`. Compute **Cohen's κ** for judge-vs-human on that set and publish it.
- **κ-gating policy:**
  - **κ ≥ 0.6** → Layer C is a **hard gate** in the verify-loop.
  - **0.4 ≤ κ < 0.6** → **advisory** — Layer C flags items to the human checkpoint but does not fail the build on its own.
  - **κ < 0.4** → **deterministic backstops only**; the LLM judge is reported as "not reliable" and excluded from gating.
- **Deterministic semantic backstops (so the FINDING survives a weak judge):** pure regex/string rules that need no LLM —
  - `alt ∈ {image, photo, picture, img, graphic, icon, logo, spacer}` (case-insensitive) → fail;
  - `alt` matches a filename pattern (`\.(jpe?g|png|gif|svg|webp|avif)$`, `IMG_\d+`, `DSC_\d+`, `screenshot`) → fail;
  - `alt` on an **informative** image is empty/whitespace → fail (the "emptied to satisfy the scanner" cheat);
  - `alt` duplicates adjacent visible text verbatim (redundant SR noise) → fail;
  - trivially short `alt` on an image flagged informative in ground truth → flag.
  These are the backbone of `gap%` and `false-fix rate`, so the headline numbers do not depend on the LLM being good.
- **Different model families:** the **fixer** and the **judge** use **different model families** via OpenRouter (e.g., fixer = one vendor's model, judge = a different vendor's) to reduce correlated bias — an LLM should not grade its own dialect. Both run temperature=0, pinned model id, fixed seed, `zod`-constrained JSON output; schema violations are rejected and retried.
- **Scope discipline:** the judge evaluates **semantic meaningfulness only** — never mechanical (Layer A) or behavioral (Layer B). This prevents double-counting and scope creep.

---

## 4. Corpus design

**Alternatives**
- **A. Injected-only** (clean pages + programmatic violation injection): perfect ground truth, low external validity.
- **B. Adversarial-only** (hand-built pages that pass axe but fail usability): proves the thesis, but small and artificial.
- **C. Real-only** (frozen real-world homepages): high external validity, but ground truth is partial/subjective.
- **D. All three buckets, each labeled and reported for what it is.**

**Tradeoffs:** injected gives clean true-fix/regression measurement; adversarial is the *proof* of the gap; real gives external validity but only best-effort labels. Mixing them without labeling their provenance would let us over-claim.

**Decision — D (three buckets, provenance-tagged).**
- **`injected/`** — clean pages with programmatically injected, fully-labeled violations. Primary source for true-fix / regression / false-fix.
- **`adversarial/`** — hand-built pages that **PASS axe but FAIL usability** (the thesis proof set). Each mapped to its catching layer.
- **`real/`** — a few frozen real-world homepage snapshots for external validity; labeled best-effort and **reported separately** because ground truth is partial.

**Ground-truth manifest schema (JSON, one per page):**
```jsonc
{
  "id": "css-reorder",
  "source": "adversarial",              // injected | adversarial | real
  "expectedUsable": "visual order matches focus order for the primary nav",
  "violations": [
    {
      "id": "focus-order-1",
      "wcag": "2.4.3",
      "type": "behavioral",             // mechanical | behavioral | semantic
      "selector": "nav .cta",
      "informative": true,              // for images/regions; null if n/a
      "expectedCatchingLayer": "B",     // A | B | C
      "expectedFix": "remove CSS `order` reordering / fix DOM order",
      "notes": "flexbox order scrambles visual vs tab order"
    }
  ]
}
```

**Adversarial → catching-layer map (the proof set):**

| Page | axe passes because | Real failure | Layer |
|------|--------------------|--------------|-------|
| `alt-generic` | alt present | `alt="image"`/`"photo"` — meaningless | **C** (+ deterministic) |
| `alt-is-filename` | alt present | `alt="IMG_2043.jpg"` | **C** (+ regex) |
| `informative-emptied` | `alt=""` is valid | informative image marked decorative → content lost | **C + regression guard** |
| `css-reorder` | DOM order logical | flex `order`/absolute pos scrambles focus vs visual | **B** |
| `positive-tabindex` | focusable, named | `tabindex="1,2,3"` scrambles reading order | **B** |
| `keyboard-trap-modal` | roles/names present | focus never escapes on Tab/Esc | **B** |
| `div-button-no-keys` | some rules pass | `div role=button` not focusable / no key handler | **B** (A partial) |
| `placeholder-as-label` | placeholder present | no real label; name lost on input | **B** (A partial) |
| `aria-label-contradicts` | has a name | `aria-label` contradicts visible text | **C** (B surfaces) |
| `live-region-missing` | valid static markup | toast never announced (no `aria-live`) | **B** |
| `skip-link-broken` | link present | `href="#main"` targets missing id | **B** |
| `color-only-status` | contrast passes | state by color alone | **C** (+ manual) |
| `icon-only-control` | may pass if aria-hidden | icon button, no accessible name | **B** (A partial) |
| `heading-skip` | — | h1→h4 jump | **A (partial)** — kept to show what A *does* catch |
| `redundant-alt-decorative` | alt present | verbose alt on decorative icon = SR noise | **C** |

Pages `css-reorder`, `positive-tabindex`, `keyboard-trap-modal`, `live-region-missing`, `skip-link-broken` are the **B-exclusive** set (a scanner fundamentally cannot see them). `heading-skip` is deliberately A-catchable to keep us honest about Layer A's real, nonzero value.

---

## 5. Metric definitions

Two granularities everywhere: **per-issue** (each ground-truth violation) and **per-page** (aggregate). Same corpus, same seed, temperature=0, pinned models/versions for both agents.

- **Gap %** (the finding, agent-independent): of issues/pages where **Layer A passes**, the fraction that **Layer B or C flags**.
  `gap% = |A-clean ∧ (B-fail ∨ C-fail)| / |A-clean|`.
- **True-fix rate:** of targeted violations, fraction ending **A-clean ∧ B-clean ∧ C-meaningful ∧ no regression**.
  `true-fix = |verified-fixed| / |targeted|`.
- **Regression rate:** fraction of attempted fixes that introduce a **new** A/B/C failure or break a previously-passing element.
  `regression = |fixes introducing ≥1 new failure| / |fixes attempted|`.
- **False-fix rate** (the headline that separates baseline from advanced): fraction of fixes that are **A-clean but fail B or C** (the cheat: empty/generic alt, deleted/hidden element, contradictory aria).
  `false-fix = |A-clean ∧ (B-fail ∨ C-fail)| / |fixes attempted|`.

**Baseline vs advanced comparison:** identical corpus/seed/model settings; only the pipeline differs. Because the comparison is **paired per-issue on the same pages**, use **McNemar's test** on the fixed/not-fixed contingency table for significance. Report **effect sizes** (Δ true-fix, Δ false-fix, Δ regression) **and raw counts**, not just percentages. **Honest small-n reporting:** state `n` explicitly, attach **Wilson score confidence intervals**, and do **not** claim significance the corpus size can't support. Also publish the judge's **Cohen's κ** alongside any Layer-C-dependent metric.

---

## 6. Baseline design (a *fair* single-shot)

**Alternatives:** (A) a deliberately weak baseline (no violation list, tiny model) — easy to beat, dishonest; (B) a fair single-shot with everything identical except the pipeline; (C) "no-op / scanner-only auto-fix" as an additional reference point.

**Decision — B, with C reported as an extra reference row.**
- The baseline receives the **same input** as the advanced agent's fixer: the page HTML **plus the same Layer-A violation list**. It makes **one** LLM call ("fix this HTML given these violations"), applies the output, and stops. **No** routing, **no** verify-loop, **no** regression guard, **no** human checkpoint.
- **Fairness guardrails:** identical fixer **model**, temperature=0, same seed, comparable token budget, and an equally well-written fix instruction. The comparison isolates the **remediation pipeline**, not detection or model quality — the baseline is *not* handicapped on what it's told is wrong.
- Baseline output is scored by the **exact same A/B/C harness** as the advanced agent.
- Optionally include a **"scanner-only auto-fix"** reference row (mechanical rule fixes with no LLM) to show where pure determinism lands.

**Why:** the win must come from the *engineering* (route → verify-loop → regression guard → checkpoint), and a judge will (rightly) discount a rigged baseline. A fair baseline that still loses on false-fix rate is the credible story.

---

## 7. Reproducibility strategy

**Alternatives:** (A) "works on my machine" + documented steps; (B) Docker + pinned deps + committed lockfile; (C) B **plus** LLM record/replay cassettes for offline determinism; (D) C **plus** a 3× byte-identical determinism proof.

**Decision — D.**
- **Pin everything:** exact `axe-core` version (rule sets shift between minors), `pa11y` version, **Playwright + browser revision** pinned in the Dockerfile, Node version (`.nvmrc` + `engines`), committed `package-lock.json`, pinned OpenRouter **model ids**, `temperature=0`, fixed **seed**.
- **LLM determinism via record/replay cassettes:** the reproducible eval runs against **recorded LLM responses** (keyed by a hash of the exact prompt), so results are deterministic offline and independent of live-model nondeterminism. A separate **live mode** (documented, needs an OpenRouter key) records fresh cassettes.
- **One command:** `make eval` → `docker compose run eval` builds the image and runs the full pipeline end-to-end.
- **Determinism proof:** run the full eval **3×** and assert the metrics JSON is **byte-identical** (hash and compare); publish the three matching hashes as the reproducibility proof.
- **Trajectories:** every agent run emits a structured trajectory (input, each verify-loop iteration, layer verdicts, accept/reject decisions) for the "agent trajectories" deliverable.

---

## Locked decisions — summary

1. **Verify-loop:** per-violation fix + local accept criteria + whole-page regression sweep; regression guard is a *pre-commit gate*; bounded reflexion (max 3) with structured feedback; ambiguous → human checkpoint.
2. **Layer B:** *(plan)* virtual-SR primary, CDP cross-check, pure-CDP fallback. **⚠ Implemented reality (see [`CODING_AGENT.md`](CODING_AGENT.md)):** deterministic CDP/DOM checks are the source of truth for findings; virtual-SR is the announcement transcript + cross-check. Honest "simulator, not NVDA/JAWS" caveat; optional real-SR spot-check off the critical path.
3. **Layer C:** κ-gated LLM judge (≥0.6 hard / 0.4–0.6 advisory / <0.4 backstops-only); deterministic semantic backstops keep the finding alive; fixer ≠ judge model family.
4. **Corpus:** injected + adversarial + real, provenance-tagged; JSON ground-truth manifest with informative/decorative flag and expected catching layer.
5. **Metrics:** gap% / true-fix / regression / false-fix, per-issue + per-page; McNemar for paired significance; Wilson CIs + raw counts + explicit n; κ published.
6. **Baseline:** fair single-shot — same input, model, seed, budget; only the pipeline differs; scanner-only auto-fix as an extra reference row.
7. **Reproducibility:** pinned deps + browser revision + lockfile; Docker; `make eval` one command; LLM record/replay cassettes; 3× byte-identical determinism proof.
