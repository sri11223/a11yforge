import type { Manifest } from "../types.js";

/**
 * Regression guard — a PRE-COMMIT gate in the verify-loop. Compares before/after
 * snapshots and rejects a candidate fix that "cheats": reduces the accessible-node
 * count, removes informative content, silently converts informative→decorative,
 * or drops a previously-focusable control. See docs/BRAINSTORM.md §1.
 */

export interface DomSnapshot {
  accessibleNodeCount: number;
  visibleText: string[];
  focusableSelectors: string[];
}

export interface RegressionResult {
  ok: boolean;
  reasons: string[];
}

/**
 * TODO(step-later): snapshot diff (node count, visible text, focusable set) +
 * ground-truth informative/decorative cross-check.
 */
export function checkRegression(
  _before: DomSnapshot,
  _after: DomSnapshot,
  _manifest?: Manifest,
): RegressionResult {
  throw new Error("TODO: regression guard not implemented yet");
}
