/**
 * End-to-end eval entrypoint — runs baseline and advanced agents over the same
 * corpus with identical seed/model settings, scores both with the A/B/C harness,
 * and emits metrics + trajectories. Reproducible: replay mode, one command.
 *
 * TODO(step-later): load corpus manifests → run both agents → score → report.
 */
export async function runEval(): Promise<void> {
  throw new Error("TODO: eval harness not implemented yet");
}

// Allow `tsx eval/run-eval.ts` once implemented.
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  runEval().catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  });
}
