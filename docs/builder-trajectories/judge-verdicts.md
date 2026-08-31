# Trajectory — the Layer-C semantic judge

_[← all traces, and what each one shows](README.md)_

The other 27 traces follow the **fixer** through detect → route → attempt → guard → verify. This one
follows the **judge**: the second model, from a different family, whose only job is to answer "is
this alt text actually meaningful?" It has no ability to change the page — it can only raise a
finding, and a finding it raises must be cleared by the verify-loop or the page is escalated.

Everything below is quoted from committed artifacts: prompts and verdicts from the replay cassettes,
expert labels from `corpus/anchor-set/anchors.json`, agreement figures from
`corpus/anchor-set/kappa.json`. Nothing is paraphrased. Regenerate with
`node eval/export-judge-trajectory.mjs`.

## The instructions it runs under

Judge system prompt — `src/layers/layerC-judge.ts` (`JUDGE_SYSTEM`), verbatim:

```text
You are an accessibility expert. Judge ONLY the semantic meaningfulness and accuracy of the given alt text or accessible name for a screen-reader user. Do NOT consider mechanical validity, keyboard operability, color, or layout. Categories: good = accurate and useful; generic = present but vacuous or too vague to convey the content; wrong = inaccurate, mismatched, misleading, or a file name; decorative-misuse = describes a decorative element that should have empty alt. Respond with raw JSON only.
```

The user message is built by `buildJudgeMessages()` and is the only page context the judge ever
sees. It cannot see the image. That is deliberate: the judge grades the *text*, and a model asked to
grade an image it cannot see is the failure mode this project removed from the fixer (see
[`contrast-alt-generic.md`](contrast-alt-generic.md)).

## Calibration, and its honest scope

| | |
| --- | --- |
| Model | `openai/gpt-4o-mini` |
| Anchor items | 64 |
| Cohen's κ (4-way category) | **0.9792** |
| Cohen's κ (binary meaningful/not) | 1 |
| Raw agreement | 0.9844 |
| Gate mode at this κ | `hard` (≥ 0.6) |

Cohen's kappa of the LLM judge (JUDGE_MODEL) vs the expert anchor labels. Category = 4-way (good/generic/wrong/decorative-misuse); binary = meaningful vs not. Gate: >=0.6 hard, 0.4-0.6 advisory, <0.4 backstops-only. Reproduces offline via committed cassettes in replay mode.

**The scope limit, stated plainly:** the anchor set is single-annotator and team-authored, so this is
a *calibration check against our own labels*, not an inter-annotator reliability study. A high κ here
means the judge reproduces our labelling, not that our labelling is correct.

## Recorded verdicts


### 1. from the corpus evaluation

```text
Context (what the image depicts and where it is used): Our head barista at work
Alt text: "Barista pouring steamed milk into a latte"
```

Verdict returned by `openai/gpt-4o-mini` (temperature 0, seed 42):

```json
{
  "meaningful": true,
  "category": "good",
  "reason": "The alt text accurately describes the action of the barista, providing useful context for the image.",
  "confidence": 0.9
}
```

**Gate decision:** no finding — the alt passes Layer C.
Cassette: `cassettes/037f5cdd098bef20…json` · from the corpus evaluation, not the anchor set


### 2. from the corpus evaluation

```text
Context (what the image depicts and where it is used): Quarterly revenue by region
Alt text: "a chart"
```

Verdict returned by `openai/gpt-4o-mini` (temperature 0, seed 42):

```json
{
  "meaningful": false,
  "category": "generic",
  "reason": "The alt text 'a chart' is too vague and does not convey specific information about the content of the chart, which is quarterly revenue by region.",
  "confidence": 0.9
}
```

**Gate decision:** a Layer C finding is raised (`source: llm-judge`, WCAG 1.1.1) carrying the judge's own reason string. The verify-loop must clear it or the page is escalated to a human.
Cassette: `cassettes/d1e492c510ba57a1…json` · from the corpus evaluation, not the anchor set


### 3. good — agreement with the expert label

```text
Context (what the image depicts and where it is used): Shop listing for a ceramic mug.
Alt text: "Hand-glazed ochre stoneware mug, front view"
```

Verdict returned by `openai/gpt-4o-mini` (temperature 0, seed 42):

```json
{
  "meaningful": true,
  "category": "good",
  "reason": "The alt text accurately describes the item (a ceramic mug) and provides specific details about its appearance (hand-glazed, ochre, stoneware, front view), which is useful for screen-reader users.",
  "confidence": 1
}
```

**Gate decision:** no finding — the alt passes Layer C.
Cassette: `cassettes/05fe7015c11f61c8…json` · anchor `good-10` (expert label: **good**)


### 4. generic — agreement with the expert label

```text
Context (what the image depicts and where it is used): A specific bar chart showing survey results by age group.
Alt text: "chart"
```

Verdict returned by `openai/gpt-4o-mini` (temperature 0, seed 42):

```json
{
  "meaningful": false,
  "category": "generic",
  "reason": "The alt text 'chart' is too vague and does not convey specific information about the content of the bar chart or the survey results it represents.",
  "confidence": 0.9
}
```

**Gate decision:** a Layer C finding is raised (`source: llm-judge`, WCAG 1.1.1) carrying the judge's own reason string. The verify-loop must clear it or the page is escalated to a human.
Cassette: `cassettes/185f1ef88533ee79…json` · anchor `gen-07` (expert label: **generic**)


### 5. wrong — agreement with the expert label

```text
Context (what the image depicts and where it is used): A photo of the company CEO at a podium.
Alt text: "Product"
```

Verdict returned by `openai/gpt-4o-mini` (temperature 0, seed 42):

```json
{
  "meaningful": false,
  "category": "wrong",
  "reason": "The alt text 'Product' does not accurately describe the image of the company CEO at a podium.",
  "confidence": 0.9
}
```

**Gate decision:** a Layer C finding is raised (`source: llm-judge`, WCAG 1.1.1) carrying the judge's own reason string. The verify-loop must clear it or the page is escalated to a human.
Cassette: `cassettes/06de2224c351eabe…json` · anchor `wrong-08` (expert label: **wrong**)


### 6. decorative-misuse — agreement with the expert label

```text
Context (what the image depicts and where it is used): A decorative ornament at the end of an article.
Alt text: "ornament"
```

Verdict returned by `openai/gpt-4o-mini` (temperature 0, seed 42):

```json
{
  "meaningful": false,
  "category": "decorative-misuse",
  "reason": "The alt text describes a decorative element that should have empty alt text.",
  "confidence": 0.9
}
```

**Gate decision:** a Layer C finding is raised (`source: llm-judge`, WCAG 1.1.1) carrying the judge's own reason string. The verify-loop must clear it or the page is escalated to a human.
Cassette: `cassettes/004b62a7b798fdc6…json` · anchor `dec-16` (expert label: **decorative-misuse**)


## The one case where the judge was wrong

`kappa.json` records exactly 1 disagreement across all 64 anchor items. It is not
hidden in a hash-named cassette — here it is, with the judge's own reasoning:

```text
Context (what the image depicts and where it is used): An informative pie chart of budget allocation.
Alt text: "decorative"
```

```json
{
  "meaningful": false,
  "category": "decorative-misuse",
  "reason": "The alt text 'decorative' is inappropriate for an informative pie chart that conveys important data about budget allocation.",
  "confidence": 0.9
}
```

| | |
| --- | --- |
| Expert label | **wrong** |
| Judge label | **decorative-misuse** |
| Anchor id | `wrong-16` |
| Cassette | `cassettes/ace6e2558c9adef9…json` |

**Why this is the most useful entry on the page.** The judge was not careless — its reason is
correct on the facts ("inappropriate for an informative pie chart that conveys important data").
It picked the wrong *category*: `decorative-misuse` describes an element that should have had empty
alt, whereas this is an informative chart mislabelled, which our taxonomy calls `wrong`. Both
labels set `meaningful: false`, so **the gate decision was identical either way** — which is why
binary κ is 1 while category κ is 0.9792. The disagreement is real and it is
taxonomic, and it changed no outcome.

That is also the honest limit of the number: κ = 0.9792 on 64 items with one
disagreement is a small sample, and a single additional miss would move it materially.

## What a reader should take from this

- The judge is **advisory to a gate, never an author.** It cannot edit the page; it can only raise a
  finding that something else must resolve or escalate.
- It runs at temperature 0 with a fixed seed against committed cassettes, so every verdict here
  replays byte-identically offline with no API key.
- It is a **different model family** from the fixer (`claude-sonnet-5`), so it never grades its own
  output dialect.
- Its one recorded error is on this page rather than in a footnote.

Related: [`alt-generic.md`](alt-generic.md) shows the judge's findings driving real escalations ·
[`contrast-alt-generic.md`](contrast-alt-generic.md) shows the fixer hallucinating alt text before
the grounding invariant existed.
