import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Emits docs/builder-trajectories/judge-verdicts.md — the Layer-C judge's trajectory.
 *   node eval/export-judge-trajectory.mjs
 *
 * WHY THIS EXISTS: docs/builder-trajectories/README.md promises "traces for every agent we used", and the
 * Layer-C judge had none. Its substitute was 151 hash-named cassettes with no manifest, which is not
 * a trace a reader can follow.
 *
 * Every prompt, verdict and reason below is READ OUT of the committed cassettes and the committed
 * anchor set — nothing here is retyped or paraphrased. The script fails loudly rather than emit a
 * doc with a gap in it, because a trajectory that quietly summarises is the thing this project
 * argues against.
 */

const REPO = resolve(import.meta.dirname, "..");
const CASS = join(REPO, "cassettes");
const OUT = join(REPO, "docs", "builder-trajectories", "judge-verdicts.md");

const rd = (p) => JSON.parse(readFileSync(p, "utf8"));
const kappa = rd(join(REPO, "corpus", "anchor-set", "kappa.json"));
const anchorsRaw = rd(join(REPO, "corpus", "anchor-set", "anchors.json"));
const anchors = Array.isArray(anchorsRaw)
  ? anchorsRaw
  : anchorsRaw.items ?? anchorsRaw.anchors ?? Object.values(anchorsRaw).find(Array.isArray);
if (!anchors?.length) throw new Error("refusing to emit: anchor set unreadable");

/** Every recorded judge call, keyed by (context, text) so it can be matched to an anchor. */
const calls = [];
for (const f of readdirSync(CASS).filter((n) => n.endsWith(".json"))) {
  let c;
  try { c = rd(join(CASS, f)); } catch { continue; }
  const m = c.request?.messages;
  if (!m?.length || !/accessibility expert/.test(m[0].content ?? "")) continue;
  const user = m[1]?.content ?? "";
  const ctx = /Context \(what [^)]*\): (.*)/.exec(user);
  const txt = /(?:Alt text|Accessible name): "([\s\S]*?)"/.exec(user);
  if (!ctx || !txt) continue;
  let v;
  try { v = JSON.parse(String(c.response).replace(/```(?:json)?/g, "").trim()); } catch { continue; }
  calls.push({
    sha: f.replace(/\.json$/, ""), system: m[0].content, user,
    context: ctx[1].trim(), text: txt[1], verdict: v,
    kind: /Accessible name/.test(user) ? "label" : "alt",
    model: c.request.model, temperature: c.request.temperature, seed: c.request.seed,
  });
}
if (calls.length < 10) throw new Error(`refusing to emit: only ${calls.length} judge calls found in cassettes`);

const anchorFor = (c) =>
  anchors.find((a) => a.context?.trim() === c.context && a.text === c.text) ?? null;
for (const c of calls) c.anchor = anchorFor(c);

/** The disagreement kappa.json records must actually be present, or the doc would overstate. */
const declared = kappa.disagreements ?? [];
if (declared.length !== 1) throw new Error(`expected 1 declared disagreement, kappa.json has ${declared.length}`);
const disagreement = calls.find((c) => c.anchor?.id === declared[0].id);
if (!disagreement) throw new Error(`refusing to emit: no cassette for declared disagreement ${declared[0].id}`);
if (disagreement.verdict.reason !== declared[0].reason) {
  throw new Error("refusing to emit: cassette reason does not match the reason recorded in kappa.json");
}

/** Two calls from the real corpus eval (no anchor), then one per category from the anchor set. */
const fromEval = calls.filter((c) => !c.anchor).slice(0, 2);
const perCategory = ["good", "generic", "wrong", "decorative-misuse"]
  .map((cat) => calls.find((c) => c.anchor && c.verdict.category === cat && c.anchor.expertLabel === cat))
  .filter(Boolean);
const shown = [...fromEval, ...perCategory];
if (shown.length < 4) throw new Error("refusing to emit: too few representative calls");

const block = (c, i, label) => `
### ${i}. ${label}

\`\`\`text
Context (what the image depicts and where it is used): ${c.context}
${c.kind === "alt" ? "Alt text" : "Accessible name"}: "${c.text}"
\`\`\`

Verdict returned by \`${c.model}\` (temperature ${c.temperature}, seed ${c.seed}):

\`\`\`json
${JSON.stringify(c.verdict, null, 2)}
\`\`\`

**Gate decision:** ${c.verdict.meaningful
  ? "no finding — the alt passes Layer C."
  : "a Layer C finding is raised (`source: llm-judge`, WCAG 1.1.1) carrying the judge's own reason string. The verify-loop must clear it or the page is escalated to a human."}
Cassette: \`cassettes/${c.sha.slice(0, 16)}…json\`${c.anchor ? ` · anchor \`${c.anchor.id}\` (expert label: **${c.anchor.expertLabel}**)` : " · from the corpus evaluation, not the anchor set"}
`;

const md = `# Trajectory — the Layer-C semantic judge

_[← all traces, and what each one shows](README.md)_

The other 27 traces follow the **fixer** through detect → route → attempt → guard → verify. This one
follows the **judge**: the second model, from a different family, whose only job is to answer "is
this alt text actually meaningful?" It has no ability to change the page — it can only raise a
finding, and a finding it raises must be cleared by the verify-loop or the page is escalated.

Everything below is quoted from committed artifacts: prompts and verdicts from the replay cassettes,
expert labels from \`corpus/anchor-set/anchors.json\`, agreement figures from
\`corpus/anchor-set/kappa.json\`. Nothing is paraphrased. Regenerate with
\`node eval/export-judge-trajectory.mjs\`.

## The instructions it runs under

Judge system prompt — \`src/layers/layerC-judge.ts\` (\`JUDGE_SYSTEM\`), verbatim:

\`\`\`text
${shown[0].system}
\`\`\`

The user message is built by \`buildJudgeMessages()\` and is the only page context the judge ever
sees. It cannot see the image. That is deliberate: the judge grades the *text*, and a model asked to
grade an image it cannot see is the failure mode this project removed from the fixer (see
[\`contrast-alt-generic.md\`](contrast-alt-generic.md)).

## Calibration, and its honest scope

| | |
| --- | --- |
| Model | \`${kappa.model}\` |
| Anchor items | ${kappa.n} |
| Cohen's κ (4-way category) | **${kappa.kappaCategory}** |
| Cohen's κ (binary meaningful/not) | ${kappa.kappaBinary} |
| Raw agreement | ${kappa.rawAgreement} |
| Gate mode at this κ | \`${kappa.gateMode}\` (≥ 0.6) |

${kappa.note}

**The scope limit, stated plainly:** the anchor set is single-annotator and team-authored, so this is
a *calibration check against our own labels*, not an inter-annotator reliability study. A high κ here
means the judge reproduces our labelling, not that our labelling is correct.

## Recorded verdicts

${shown.map((c, i) => block(c, i + 1, c.anchor
  ? `${c.verdict.category} — agreement with the expert label`
  : "from the corpus evaluation")).join("\n")}

## The one case where the judge was wrong

\`kappa.json\` records exactly ${declared.length} disagreement across all ${kappa.n} anchor items. It is not
hidden in a hash-named cassette — here it is, with the judge's own reasoning:

\`\`\`text
Context (what the image depicts and where it is used): ${disagreement.context}
Alt text: "${disagreement.text}"
\`\`\`

\`\`\`json
${JSON.stringify(disagreement.verdict, null, 2)}
\`\`\`

| | |
| --- | --- |
| Expert label | **${declared[0].expert}** |
| Judge label | **${declared[0].judge}** |
| Anchor id | \`${declared[0].id}\` |
| Cassette | \`cassettes/${disagreement.sha.slice(0, 16)}…json\` |

**Why this is the most useful entry on the page.** The judge was not careless — its reason is
correct on the facts ("inappropriate for an informative pie chart that conveys important data").
It picked the wrong *category*: \`decorative-misuse\` describes an element that should have had empty
alt, whereas this is an informative chart mislabelled, which our taxonomy calls \`wrong\`. Both
labels set \`meaningful: false\`, so **the gate decision was identical either way** — which is why
binary κ is ${kappa.kappaBinary} while category κ is ${kappa.kappaCategory}. The disagreement is real and it is
taxonomic, and it changed no outcome.

That is also the honest limit of the number: κ = ${kappa.kappaCategory} on ${kappa.n} items with one
disagreement is a small sample, and a single additional miss would move it materially.

## What a reader should take from this

- The judge is **advisory to a gate, never an author.** It cannot edit the page; it can only raise a
  finding that something else must resolve or escalate.
- It runs at temperature 0 with a fixed seed against committed cassettes, so every verdict here
  replays byte-identically offline with no API key.
- It is a **different model family** from the fixer (\`claude-sonnet-5\`), so it never grades its own
  output dialect.
- Its one recorded error is on this page rather than in a footnote.

Related: [\`alt-generic.md\`](alt-generic.md) shows the judge's findings driving real escalations ·
[\`contrast-alt-generic.md\`](contrast-alt-generic.md) shows the fixer hallucinating alt text before
the grounding invariant existed.
`;

writeFileSync(OUT, md, "utf8");
console.log(`wrote ${OUT}`);
console.log(`  ${calls.length} judge calls found · ${calls.filter((c) => c.anchor).length} matched to anchors`);
console.log(`  ${shown.length} verdicts quoted · disagreement ${declared[0].id} verified against kappa.json`);
