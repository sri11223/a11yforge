import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * 3× byte-identical determinism proof: run the full offline eval three times, hash the
 * resulting metrics.json each time, and assert all three hashes match. Writes the proof
 * (the three matching hashes) to docs/results/determinism-proof.txt. Run from dist/:
 *   npx tsc && node dist/eval/determinism-proof.js
 */

const RUN = join(process.cwd(), "dist", "eval", "run-eval.js");
const METRICS = join(process.cwd(), "out", "metrics.json");
const PROOF = join(process.cwd(), "docs", "results", "determinism-proof.txt");

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

const hashes: string[] = [];
for (let i = 1; i <= 3; i++) {
  process.stdout.write(`run ${i}/3 ... `);
  execFileSync("node", [RUN], { stdio: "ignore", env: { ...process.env, A11YFORGE_MODE: "replay" } });
  const h = sha256(METRICS);
  hashes.push(h);
  console.log(h);
}

const allMatch = hashes.every((h) => h === hashes[0]);
const lines = [
  "A11yForge — determinism proof (offline replay, no API key)",
  "Full eval run 3×; SHA-256 of out/metrics.json each run:",
  ...hashes.map((h, i) => `  run ${i + 1}: ${h}`),
  "",
  allMatch ? "RESULT: PASS — all three hashes identical (byte-for-byte reproducible)." : "RESULT: FAIL — hashes differ.",
];
writeFileSync(PROOF, lines.join("\n") + "\n", "utf8");
console.log("\n" + lines.join("\n"));
console.log(`\nWrote ${PROOF}`);
if (!allMatch) process.exitCode = 1;
