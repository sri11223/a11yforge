# Real-world deep audit — 20 sites (live, detection-only)

_Generated: 2026-08-29T19:33:14Z. LLM judge: on (openai/gpt-4o-mini). Non-deterministic, dated evidence —
separate from the sealed deterministic eval. Detection-only: we never modify or publish fixes to
sites we do not own._

## Totals

- Sites attempted: **20** · audited: **20** · skipped: **0**
- Layer A (scanner) findings: **552**
- Layer B (screen-reader / keyboard) findings: **109**
- Layer C (semantic alt/labels) findings: **97**
- **Issues hidden from the scanner (B + C): 206** — across 20 major real sites
- Pages a scanner calls clean: **1** — of which **0** still fail Layer B/C

> **These totals are a LOWER BOUND.** On big real DOMs some layers exceeded their per-layer
> budget or were blocked by the site's Content-Security-Policy, and are marked `*` below (a
> `0*` means "not measured", not "clean"): Layer A timed out on **2**, Layer B was
> unavailable on **3** (all large-DOM timeouts; after the CSP-safe injection no site is CSP-blocked), and the Layer C LLM
> judge degraded to deterministic backstops on **3**. The real issue counts are higher.

## Per-site

| Site | Category | A | B | C | hidden (B+C) | scanner-clean? | partial-data notes |
|---|---|---|---|---|---|---|---|
| www.npr.org | news | 143 | 1 | 14 | 15 | no | C judge→backstops |
| apnews.com | news | 0* | 0* | 1 | 1 | no | A timed out; B timed out; C judge→backstops |
| www.bbc.com/news | news | 22 | 9 | 1 | 10 | no | — |
| www.usa.gov | government | 0 | 0 | 0 | 0 | yes | — |
| www.gov.uk | government | 2 | 0 | 5 | 5 | no | — |
| www.nasa.gov | government/science | 6 | 0 | 33 | 33 | no | C judge→backstops |
| www.apple.com | big brand / e-commerce | 23 | 12 | 20 | 32 | no | — |
| www.microsoft.com | big brand | 38 | 11 | 4 | 15 | no | — |
| stripe.com | SaaS / fintech | 48 | 65 | 8 | 73 | no | — |
| vercel.com | SaaS / developer | 0* | 0* | 2 | 2 | no | A timed out; B timed out |
| developer.mozilla.org | developer docs | 15 | 0 | 1 | 1 | no | — |
| docs.python.org/3/ | developer docs | 31 | 1 | 0 | 1 | no | — |
| www.mit.edu | university | 9 | 1 | 0 | 1 | no | — |
| www.stanford.edu | university | 6 | 3 | 1 | 4 | no | — |
| www.nih.gov | healthcare / gov | 2 | 0 | 1 | 1 | no | — |
| www.mayoclinic.org | healthcare | 8 | 0 | 0 | 0 | no | — |
| www.who.int | healthcare / NGO | 7 | 2 | 2 | 4 | no | — |
| en.wikipedia.org/wiki/Accessibility | reference | 138 | 0* | 3 | 3 | no | B timed out |
| www.w3.org | standards | 2 | 1 | 0 | 1 | no | — |
| www.smashingmagazine.com | small business / publishing | 52 | 3 | 1 | 4 | no | — |

_`*` = that layer hit its per-layer timeout; the shown count is partial._

## Per-layer partial data (transparency)

| Site | What was partial |
|---|---|
| www.npr.org | C judge→backstops |
| apnews.com | A timed out; B timed out; C judge→backstops |
| www.nasa.gov | C judge→backstops |
| vercel.com | A timed out; B timed out |
| en.wikipedia.org/wiki/Accessibility | B timed out |

_No sites were skipped: all 20 navigated and were audited._

## Method & caveats

- **Live, full JS render:** navigate with `domcontentloaded` + a 2.5s settle (heavy ad/tracker
  sites never reach `load`/`networkidle`), then run A/B/C. Each layer has its own timeout so a
  slow layer degrades gracefully instead of dropping the whole site.
- Live sites change and A/B-test; counts are a snapshot at the timestamp above.
- Layer C used on (openai/gpt-4o-mini).
- **Detection-only** — we never modify or publish fixes to sites we don't own.
- Full machine-readable data incl. per-finding messages and per-layer errors: `real-world-20.json`.
