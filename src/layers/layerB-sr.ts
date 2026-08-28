import type { Finding } from "../types.js";

/**
 * Layer B — behavioral, deterministic. Virtual screen-reader traversal
 * (@guidepup/virtual-screen-reader) cross-checked against the CDP
 * Accessibility.getFullAXTree. Detects focus/reading order, keyboard traps,
 * missing live regions, broken skip links, and accessible-name presence — the
 * failures a scanner fundamentally cannot see.
 *
 * Caveat (per docs/BRAINSTORM.md §2): this is a SIMULATOR of order/operability/
 * name, NOT a bug-for-bug NVDA/JAWS/VoiceOver replica.
 *
 * TODO(step-later): virtual-SR traversal + CDP AX-tree cross-check + pure-CDP fallback.
 */
export async function runLayerB(_html: string): Promise<Finding[]> {
  throw new Error("TODO: Layer B (virtual-SR + CDP AX-tree) not implemented yet");
}
