# A11yForge — Build Log

Chronological record of each build step: what was done and how it was verified.

---

## Step 1 — Brainstorm + repo scaffold

- Wrote `docs/BRAINSTORM.md` locking all 7 design decisions (verify-loop, Layer B
  engine, Layer C κ-gating, corpus, metrics, fair baseline, reproducibility) with
  alternatives → tradeoffs → decision + why.
- `git init`, added `.gitignore` + README stub, created private repo
  `sri11223/a11yforge`, committed and pushed.
- **Verified:** repo visible/private on GitHub; commit `571c7b7` present.

---

## Step 2 — Project scaffold (toolchain, types, client, smoke test)

**Done**
- `package.json` (ESM, `type: module`), `tsconfig.json` (strict + `noUncheckedIndexedAccess`),
  `.nvmrc` (22), `engines` Node `>=22 <23`, `.npmrc` (`save-exact=true`), minimal flat
  ESLint config. Scripts: `build`, `typecheck`, `test`, `lint`, placeholder `eval`.
- Installed and pinned exact versions (see below); committed `package-lock.json`.
  Installed **chromium only**.
- Folder structure with typed stubs (exported signatures + `TODO`) across
  `src/layers`, `src/agents`, `src/llm`, `src/metrics`, `src/report`, `eval`, `test`;
  `corpus/{injected,adversarial,real}` placeholders.
- `src/types.ts`: zod schemas + inferred types for `Finding`, `FixResult`, `Verdict`,
  and the corpus `Manifest` (matches the brainstorm schema).
- `src/llm/openrouter-client.ts`: OpenAI SDK → OpenRouter, `temperature=0`, fixed
  `seed=42`, `FIXER_MODEL`/`JUDGE_MODEL` from env (different families), zod-validated
  responses; routed through `src/llm/cassette.ts` (replay/record/live, default replay,
  SHA-256 request hashing). `.env.example` added.
- `test/smoke-axe.test.ts`: launches Playwright chromium, loads inline HTML with an
  `img` missing `alt`, runs `@axe-core/playwright`, asserts `image-alt` is detected.

**Pinned key versions**
- `axe-core` 4.13.0 · `@axe-core/playwright` 4.13.0 · `pa11y` 10.0.0
- `playwright` 1.62.1 · `@guidepup/virtual-screen-reader` 0.32.1 · `@guidepup/playwright` 0.19.1
- `zod` 4.5.1 · `openai` 7.8.0 · `cheerio` 1.2.0
- dev: `typescript` (pinned in lockfile), `tsx`, `vitest` 4.1.11, `@types/node`, `eslint`,
  `@eslint/js`, `typescript-eslint`
- **Playwright browser revision (for Dockerfile):** Playwright 1.62.1 →
  chromium-headless-shell build **v1234** (Chrome 151.0.7922.34)

**Verified**
- `npx tsc --noEmit` → clean (green).
- `npm test` → 1 passed (smoke test detects `image-alt`), no LLM key needed.

**Surprises / notes**
- `verbatimModuleSyntax` had to be dropped — it broke the CJS default import of
  `@axe-core/playwright`; switched the import to the named export `{ AxeBuilder }`.
- `@types/node` needed an explicit `"types": ["node"]` in tsconfig to resolve under
  NodeNext.
- `@axe-core/playwright` requires a page created from an explicit `browser.newContext()`
  (not `browser.newPage()`), or it throws "Please use browser.newContext()".
- Extra dev deps `@eslint/js` + `typescript-eslint` were added beyond the listed set so
  the flat ESLint config actually functions.

---

## Step 3 — Adversarial corpus (the thesis)

**Done**
- Built all **15 adversarial pages** under `corpus/adversarial/<slug>/`, each with a
  realistic look (branded nav, real content, proper-ish components) and a co-located
  `manifest.json` matching the locked `ManifestSchema`.
- The **5 scanner-invisible** pages (a scanner fundamentally cannot see these):
  `keyboard-trap-modal` (Tab force-cycled, no Esc, close is a click-only `<span>`),
  `css-reorder` (flex `order` makes visual ≠ DOM/tab order), `positive-tabindex`
  (tabindex 1..6 scrambles order), `live-region-missing` (add-to-cart confirmation
  injected into a plain `<div>`, no `aria-live`/`role=status`), `skip-link-broken`
  (`href="#main-content"` but `<main id="content">`).
- The other 10: `alt-generic`, `alt-is-filename`, `informative-emptied` (the false-fix
  trap), `aria-label-contradicts`, `icon-only-control` (role=button, no tabindex),
  `div-button-no-keys` (onclick only), `placeholder-as-label`, `color-only-status`,
  `redundant-alt-decorative`, `heading-skip` (kept deliberately — caught by Layer A's
  pa11y/HTMLCS engine, to stay honest about what the scanner is genuinely good at).
- Each manifest records: WCAG SC, type (mechanical/behavioral/semantic), selector,
  informative/decorative flag, `expectedCatchingLayer`, and the concrete `expectedFix`.

**Verified**
- `test/corpus-axe-clean.test.ts`: (a) HARD-asserts the 5 scanner-invisible pages report
  **zero** violations under a WCAG-2.x A/AA axe scan — the thesis proven mechanically;
  (b) validates all 15 manifests against `ManifestSchema`; (c) an informational scan
  reports the WCAG-axe result for every page.
- Result: **all 15 pages are WCAG-axe-clean** — 14 broken in ways no scanner sees, and
  `heading-skip` clean under WCAG-tagged axe (it is caught by the pa11y engine, not axe).
- `npx tsc --noEmit` clean; `npm test` → **36 passed** (2 files).

**Scope decision (honest)**
- The axe assertion runs the **WCAG 2.x A/AA success-criteria ruleset**
  (`wcag2a/2aa/21a/21aa/22aa`) — the standard compliance is legally measured against and
  the basis of the accessiBe claims. axe's own **best-practice advisories**
  (positive-tabindex hint, skip-link-target check, heading-order) are NOT WCAG success
  criteria and are out of scope; even where they'd hint, they don't capture the severity
  Layer B measures. This is documented in the test header.

**Surprises / notes**
- Every C-layer semantic page (`alt-generic`, `alt-is-filename`, `aria-label-contradicts`,
  `color-only-status`, `redundant-alt-decorative`) is axe-clean: axe only checks that
  `alt` exists, never whether it's meaningful — exactly the gap Layer C exists to fill.
- `aria-label-contradicts` uses a **text input** so axe's `label-content-name-mismatch`
  (2.5.3) rule does not apply — the contradiction stays invisible to axe (would be caught
  on a button/link).

---

## Step 4 — Layer A wired (axe-core + pa11y, normalized)

**Done**
- Implemented `src/layers/layerA-scanners.ts`: runs axe-core (via Playwright) and
  pa11y/HTMLCS (via Puppeteer, which pa11y bundles) over the same page and normalizes
  both into a single `Finding[]` (layer "A", type "mechanical", with `source`, selector,
  WCAG SC, impact, human message). Accepts `{ html }` (written to a temp file so both
  engines see identical input) or `{ url }`; optional shared Playwright `browser`.
- Two engines on purpose (not single-vendor). De-dupe by node+criterion (selector|SC),
  merging engines into `source` (e.g. `axe-core+pa11y`). Deterministic **stable sort**
  (selector → WCAG SC → id) so a page always yields byte-identical output.
- Added a minimal ambient type declaration `src/pa11y.d.ts` (pa11y ships no types).

**Principled scope decision (important, and it deviates from the original plan)**
- Layer A counts **DEFINITE failures only**: axe *violations* (WCAG 2.x A/AA tags) and
  pa11y *errors*. We deliberately EXCLUDE pa11y warnings/notices and axe best-practice
  rules — uniformly. Rationale: a probe showed warnings fire spuriously on the
  scanner-invisible pages (H48 "links should be a list", G90 onclick heuristic, etc.),
  so counting them would falsely flag those pages and **destroy the gap proof**.
- Consequence: **heading-skip is NOT a Layer-A catch.** Empirically neither engine flags
  it as a conformance error — axe's `heading-order` is best-practice (excluded) and
  HTMLCS emits only a *warning* (`1_3_1_A.G141`). Including the checks that would catch it
  (the best-practice tag) also makes axe flag `positive-tabindex` and `skip-link-broken`,
  which are two of our five B-exclusive pages. There is no non-cherry-picked line that
  catches heading-skip without breaking the gap, so heading-skip was **reclassified to
  Layer B** (deterministic heading-outline traversal). This is a *stronger* thesis result:
  even the canonical "scanners catch headings" belief is only advisory at conformance level.
- The genuine Layer-A catch is now **placeholder-as-label** — and it's a better example:
  axe reports NO violation (it treats the placeholder as an accessible name) while pa11y
  correctly errors (F68 + H91.InputText.Name). Single-vendor scanning misses it; the
  two-engine layer catches it. Its manifest was updated to `expectedCatchingLayer: A`.

**Verified**
- `test/layerA.test.ts` (9 tests): placeholder-as-label flagged by pa11y-not-axe; the 5
  B-exclusive pages AND heading-skip return zero Layer-A findings; **across all 15 pages,
  only placeholder-as-label yields findings**; output is byte-identical across repeat runs.
- `npx tsc --noEmit` clean; full suite `npm test` → **45 passed** (3 files).
- Normalized findings spot-checked: placeholder-as-label = 8 findings (F68/1.3.1 +
  H91.InputText.Name/4.1.2 for each of 4 inputs, all `source: pa11y`); heading-skip = [];
  keyboard-trap-modal = [].

**Headline**
- Two independent WCAG-conformance engines, run over 15 pages that are ALL genuinely
  broken, flag exactly **one** page. The other 14 — keyboard traps, focus scrambles,
  silent live regions, meaningless alt — pass with zero findings. The gap is now proven
  through the real pipeline, not a toy check.

---

## Step 5 — Layer B wired (the screen-reader / keyboard layer)

**Done**
- Implemented `src/layers/layerB-sr.ts` — the deterministic behavioral layer that finds
  what a scanner cannot. Emits `Finding[]` (layer "B", type "behavioral"), de-duped by
  node+criterion and stable-sorted for byte-identical output.
- Engines (per docs/BRAINSTORM.md §2): the **Guidepup virtual screen reader** is injected
  into the page (as a data-URL ESM module) and run as the announcement oracle — its spoken
  output is captured and attached to findings as `srReadingOrderSample`; the **CDP
  `Accessibility.getFullAXTree`** is pulled as the cross-check; if the virtual-SR fails to
  inject, everything still runs (pure-CDP/DOM fallback). The pass/fail logic runs on real
  Chromium via Playwright + CDP (real layout, JS, keyboard) — where determinism is
  strongest, which is the priority for this layer.
- Deterministic checks, each tied to the page it must catch:
  - **heading outline** (no skipped levels) → heading-skip
  - **skip-link target exists** → skip-link-broken
  - **tab order == DOM order** (positive-tabindex detection via real Tab traversal) → positive-tabindex
  - **visual order == DOM/reading order** (CSS `order` reordering via bounding boxes) → css-reorder
  - **dialog keyboard trap** (opens the dialog, Tab-cycles, tries Escape, checks for an
    operable close) → keyboard-trap-modal
  - **control operability** (focusable + Enter/Space via CDP getEventListeners) → div-button-no-keys, icon-only-control, modal close
  - **control accessible name** (meaningful, not empty/symbol-only) → modal close ("×")
  - **live region on dynamic update** (MutationObserver + real button clicks) → live-region-missing
- Ordering keeps interactive checks independent: static/order checks on a pristine load;
  reload before the live-region clicks; reload before the dialog check (which opens the
  modal and leaves it open so the control checks see the close control).

**Honest caveat (in code + docs):** Layer B is a *simulator* of reading order, keyboard
operability, and accessible-name presence — NOT a bug-for-bug NVDA/JAWS/VoiceOver replica.
We claim structure/order/operability fidelity (where the scanner gap lives), not literal
announcement-string equivalence.

**Verified**
- `test/layerB.test.ts` (16 tests): each expected violation is flagged on the right page
  (5 B-exclusive + heading-skip + icon-only-control + div-button-no-keys); the 7 B-clean
  pages (alt-generic, alt-is-filename, informative-emptied, aria-label-contradicts,
  color-only-status, redundant-alt-decorative, placeholder-as-label) produce **zero**
  Layer-B findings (no crying wolf); output is byte-identical across runs.
- `npx tsc --noEmit` clean; full suite `npm test` → **61 passed** (4 files).
- Spot check — keyboard-trap-modal → 3 findings: `2.1.2` trap + `2.1.1` non-focusable
  close (span) + `4.1.2` close announced only as "×"; alt-generic → `[]`.

**Surprises / notes**
- `vitest` uses **oxc** for transforms (not esbuild), so page.evaluate bodies serialize
  cleanly. Running Layer B under **tsx** injects an esbuild `__name` shim that is undefined
  in the browser context and throws — so ad-hoc probing must go through vitest (or compiled
  `dist/`), not `tsx`. The eval CLI should run from compiled output for this reason.
- Chromium parks focus on `<body>` between the positive-tabindex group and the auto group
  during Tab traversal; the tab-order check skips those blips instead of stopping (an early
  version stopped there and missed the scramble).
- Guidepup's `@guidepup/playwright` package is for *real* NVDA/VoiceOver; the virtual SR is
  the separate `@guidepup/virtual-screen-reader` browser bundle, injected directly.
