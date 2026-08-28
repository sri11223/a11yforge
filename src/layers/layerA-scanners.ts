import type { Finding } from "../types.js";

/**
 * Layer A — mechanical, deterministic. Runs axe-core (@axe-core/playwright) and
 * pa11y (HTMLCS) over a page and normalizes both engines into Finding[].
 * Two independent rule engines by design (no single-vendor dependency).
 *
 * TODO(step-later): launch chromium, inject page HTML, run axe + pa11y, dedupe/normalize.
 */
export async function runLayerA(_html: string): Promise<Finding[]> {
  throw new Error("TODO: Layer A (axe-core + pa11y) not implemented yet");
}
