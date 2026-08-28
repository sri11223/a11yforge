import type { Finding, FixResult } from "../types.js";

/**
 * Agent trajectory recorder — captures the full decision trace (input, each
 * verify-loop iteration, layer verdicts, accept/reject decisions) for the
 * "agent trajectories" deliverable.
 */

export interface TrajectoryStep {
  iteration: number;
  violationId: string;
  action: string;
  verdicts: Finding[];
  accepted: boolean;
  note?: string;
}

export interface Trajectory {
  pageId: string;
  agent: "baseline" | "advanced";
  steps: TrajectoryStep[];
  result: FixResult[];
}

/** TODO(step-later): serialize a Trajectory to a JSON artifact. */
export function writeTrajectory(_trajectory: Trajectory): void {
  throw new Error("TODO: trajectory writer not implemented yet");
}
