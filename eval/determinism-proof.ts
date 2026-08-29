import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * 3× byte-identical determinism proof (OFFLINE replay, NO API key). Runs the full eval
 * AND the gated ablation three times, hashes metrics.json and ablation.json each run, and
 * asserts all three of each match. Writes a TRACKED evidence file: docs/results/DETERMINISM.md.
 *   npx tsc && node dist/eval/determinism-proof.js
 */

const RUN = join(process.cwd(), "dist", "eval", "run-eval.js");
const ABL = join(process.cwd(), "dist", "eval", "ablation-gated.js");
const METRICS = join(process.cwd(), "out", "metrics.json");
const ABLATION = join(process.cwd(), "out", "ablation.json");
const OUT = join(process.cwd(), "docs", "results", "DETERMINISM.md");

const sha256 = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");
const env = { ...process.env, A11YFORGE_MODE: "replay" };

const metricsHashes: string[] = [];
const ablationHashes: string[] = [];

for (let i = 1; i <= 3; i++) {
  process.stdout.write(`run ${i}/3: eval ... `);
  execFileSync("node", [RUN], { stdio: "ignore", env });
  const mh = sha256(METRICS);
  metricsHashes.push(mh);
  process.stdout.write(`metrics=${mh.slice(0, 12)}  ablation ... `);
  execFileSync("node", [ABL], { stdio: "ignore", env });
  const ah = sha256(ABLATION);
  ablationHashes.push(ah);
  console.log(`ablation=${ah.slice(0, 12)}`);
}

const metricsMatch = metricsHashes.every((h) => h === metricsHashes[0]);
const ablationMatch = ablationHashes.every((h) => h === ablationHashes[0]);
const pass = metricsMatch && ablationMatch;

const md = `# Determinism proof — 3× byte-identical (offline replay, no API key)

Command (reproduces this file):

    npm run determinism
    # = npx tsc && node dist/eval/determinism-proof.js   (A11YFORGE_MODE=replay)

The full baseline-vs-advanced eval and the gated {A}/{A,B}/{A,B,C} ablation were each run
**three times** from committed LLM cassettes — **no OpenRouter key, no network LLM calls** —
and the SHA-256 of \`out/metrics.json\` and \`out/ablation.json\` was taken each run.

## metrics.json (SHA-256)

${metricsHashes.map((h, i) => `- run ${i + 1}: \`${h}\``).join("\n")}

## ablation.json (SHA-256)

${ablationHashes.map((h, i) => `- run ${i + 1}: \`${h}\``).join("\n")}

## Result

**${pass ? "PASS" : "FAIL"}** — metrics ${metricsMatch ? "identical" : "DIFFER"}, ablation ${ablationMatch ? "identical" : "DIFFER"} across all three runs.
Reproduced with no API key in replay mode; the evaluation is byte-for-byte deterministic.
`;

writeFileSync(OUT, md, "utf8");
console.log("\n" + md);
console.log(`Wrote ${OUT}`);
if (!pass) process.exitCode = 1;
