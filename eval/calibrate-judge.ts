import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { judge } from "../src/layers/layerC-judge.js";
import { cohensKappa } from "../src/metrics/stats.js";
import { gateModeForKappa } from "../src/layers/layerC-judge.js";

/**
 * Calibrate the Layer C judge against the expert anchor set.
 *
 * Run once WITH a key to record cassettes and publish kappa:
 *   A11YFORGE_MODE=record JUDGE_MODEL=openai/gpt-4o-mini node dist/eval/calibrate-judge.js
 * Thereafter it replays offline (default A11YFORGE_MODE=replay) and reproduces the
 * exact same kappa. Writes corpus/anchor-set/kappa.json.
 */

interface Anchor {
  id: string;
  kind: "alt" | "label";
  context: string;
  text: string;
  expertLabel: string;
}

async function main(): Promise<void> {
  const anchorsPath = join(process.cwd(), "corpus", "anchor-set", "anchors.json");
  const data = JSON.parse(readFileSync(anchorsPath, "utf8")) as { items: Anchor[] };
  const items = data.items;

  const judgeCats: string[] = [];
  const expertCats: string[] = [];
  const disagreements: { id: string; expert: string; judge: string; reason: string }[] = [];

  for (const it of items) {
    const verdict = await judge({ text: it.text, context: it.context, kind: it.kind });
    judgeCats.push(verdict.category);
    expertCats.push(it.expertLabel);
    if (verdict.category !== it.expertLabel) {
      disagreements.push({ id: it.id, expert: it.expertLabel, judge: verdict.category, reason: verdict.reason });
    }
    process.stdout.write(verdict.category === it.expertLabel ? "." : "x");
  }
  process.stdout.write("\n");

  const kappa = cohensKappa(judgeCats, expertCats);
  const toBinary = (c: string) => (c === "good" ? "meaningful" : "not-meaningful");
  const kappaBinary = cohensKappa(judgeCats.map(toBinary), expertCats.map(toBinary));
  const agreement = judgeCats.filter((c, i) => c === expertCats[i]).length / items.length;

  const out = {
    model: process.env.JUDGE_MODEL ?? "unknown",
    n: items.length,
    kappaCategory: Number(kappa.toFixed(4)),
    kappaBinary: Number(kappaBinary.toFixed(4)),
    rawAgreement: Number(agreement.toFixed(4)),
    gateMode: gateModeForKappa(kappa),
    disagreements,
    note:
      "Cohen's kappa of the LLM judge (JUDGE_MODEL) vs the expert anchor labels. Category = 4-way (good/generic/wrong/decorative-misuse); binary = meaningful vs not. Gate: >=0.6 hard, 0.4-0.6 advisory, <0.4 backstops-only. Reproduces offline via committed cassettes in replay mode.",
  };

  const outPath = join(process.cwd(), "corpus", "anchor-set", "kappa.json");
  writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n", "utf8");
  console.log(`kappa(category)=${out.kappaCategory}  kappa(binary)=${out.kappaBinary}  agreement=${out.rawAgreement}  gate=${out.gateMode}`);
  console.log(`Wrote ${outPath}`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
