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
