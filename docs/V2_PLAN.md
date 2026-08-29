# A11yForge V2 — plan (code authored; expanded eval deferred)

V2 turns the benchmark into a **product** and widens the evidence base. All code/assets below
are authored now; **no eval was run** — a 3× determinism proof of V1 is sealing in the
background, and running the eval (or regenerating `corpus/injected/`) would corrupt it.

## The four upgrades

1. **`a11yforge audit <url|path>` CLI** — `src/cli/audit.ts` (bin `a11yforge`). Points the full
   A/B/C detector at any URL or local HTML file and reports the gap between "scanner-clean"
   and "usable". Layers A+B are deterministic and run **offline with no key**; Layer C's LLM
   judge engages only when `OPENROUTER_API_KEY` is set and otherwise falls back gracefully to
   the deterministic backstops. Unit test: `test/audit.test.ts` (inline page, offline).
2. **Real-world evidence bucket (detection-only)** — `eval/snapshot-real.ts` freezes 4–5
   well-known public pages (news/gov/e-commerce/docs/reference) into `corpus/real/<slug>/`
   with `source.json` (url + timestamp). We **analyze and report**; we never modify or
   republish "fixes" to sites we don't own. See `corpus/real/README.md`.
3. **Corpus widening for significance** — `eval/build-injected-v2.ts` authors **18** more fair
   injected pages (one realistic, fairly-fixable violation each; honest, not rigged),
   materialized to **`corpus/injected-v2/`** (a separate bucket, so it doesn't disturb the
   `corpus/injected/` a running proof evaluates). With adversarial (15) + injected (12) +
   injected-v2 (18) = **45 pages**, the harm/regression McNemar has a real shot at α=0.05.
4. **Visual before/after** — `src/report/screenshot.ts` renders pre/post-fix HTML to PNG for
   the report (paired with the SR transcript, since many failures are invisible in a shot).

## Sequencing (strict, to protect the V1 determinism proof)

1. **Now:** author code + assets (this commit set). `tsc --noEmit` only — no eval, no
   Chromium, no writes to `out/` or `corpus/injected/`.
2. **After the V1 3× proof seals** (docs/results/DETERMINISM.md committed):
   - Add `injected-v2` to `run-eval.ts` BUCKETS (and `ablation-gated.ts`).
   - Record baseline + advanced cassettes for the 18 new pages (`A11YFORGE_MODE=auto`, key).
   - Re-run the full eval + gated ablation over 45 pages → refresh `docs/results/*`.
   - Re-run the determinism proof over the expanded corpus.
   - Generate real snapshots + audit them; generate before/after PNGs for the report.
   - Update CHANGELOG/report with the expanded-n numbers and the new significance result.

## Guardrails carried into V2

- **Never LLM-invent alt** (grounded rule-fix or human checkpoint) — the enforced invariant.
- **Honest corpus** — injected pages are realistic and fairly fixable, not traps.
- **Real sites are detection-only** — report the gap, never ship fixes to others.
- **Offline-reproducible** — the one-command path stays replay/no-key.
