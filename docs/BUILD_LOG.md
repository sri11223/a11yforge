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
