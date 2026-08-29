# Baseline vs. advanced — `alt-generic` (the thesis in one trace)

The single most illustrative trace: the same model (`claude-sonnet-5`), the same page, one shot vs.
the verify-loop. The page is a portfolio with a hero image and three captioned project thumbnails,
all shipping meaningless alt (`alt="image"` / `"photo"` / `"picture"`). It is **axe-clean** — a
scanner reports zero violations before and after either agent.

## Baseline (single-shot) — SHIPS a confident hallucination

Cassette [`7aee82ec…`](../../cassettes/7aee82ece375baf021829d64ad2a5516d6cfe36f1ec4bcf17105eccf7c0b6ac8.json)
(`claude-sonnet-5`, whole-page prompt; note the prompt even tells it **"No violations were
reported by the automated scanner"**). Given images it **cannot see**, the model invents detailed,
confident descriptions and ships them as `alt`:

| # | image | baseline's invented `alt` |
|---|---|---|
| 1 | **hero** (no caption) | "Close-up of Atlas Studio's recent brand identity work, featuring layered print and packaging materials." |
| 2 | harvest.jpg | "Harvest Table logo mark and stationery set on a wooden table." |
| 3 | lumen.jpg | "Lumen product packaging boxes stacked in warm lighting." |
| 4 | verge.jpg | "Verge campaign poster displayed on a city street." |

None of these were observed — they're fabricated from the filename and surrounding copy. The
**hero has no caption to ground any description**, so its invented alt is unfalsifiable and
dangerous: axe passes it, the deterministic backstops pass it, and even the (also-blind) LLM judge
rates it plausible. Scored outcome (committed `metrics.json`): baseline `alt-generic` →
**false-fix, hallucinated-alt = 1** — shipped as done, no escalation.

## Advanced (verify-loop) — REFUSES to guess, escalates

The advanced agent routes semantic alt to a **grounded rule, never the LLM** (see
[`../../src/agents/router.ts`](../../src/agents/router.ts)):

- The three thumbnails **have figcaptions** ("Harvest Table — identity", etc.) → grounded, so
  their redundant alt is set to `alt=""` (the caption already conveys it; no invention).
- The **hero has no caption/heading/link to ground it** → the agent does **not** write alt. It
  escalates to the human checkpoint with the original alt left untouched.

Scored outcome (committed `metrics.json`): advanced `alt-generic` → **needs-review = 1, hallucinated
= 0, false-fix = false**. See the runtime trace in [`alt-generic.md`](alt-generic.md).

## The contrast, in one line

| | Baseline (one shot) | Advanced (verify-loop) |
|---|---|---|
| Hero alt | **fabricated** confident description | left untouched, **escalated to a human** |
| Hallucinations shipped | **1** | **0** |
| Scored | **false-fix** | needs-review (honest) |
| A scanner sees | nothing wrong either way | nothing wrong either way |

Same model, same prompt family, same page. The only difference is that the advanced agent
**verifies and refuses to ship what it cannot ground** — turning the hot take ("the dangerous
failure is confident hallucination") into an enforced invariant.
