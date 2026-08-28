import type { Finding, FixResult } from "../types.js";
import { complete } from "../llm/openrouter-client.js";
import { buildFixMessages, extractHtml } from "./fix-prompt.js";

/**
 * Baseline agent — a FAIR single-shot fixer. Receives the page HTML plus the
 * SAME Layer-A (scanner) violation list the advanced agent's fixer starts from,
 * makes ONE LLM call with the SHARED fix prompt, applies the output, and stops.
 * No routing, no verify-loop, no regression guard, no human checkpoint. Same
 * model / temperature / seed as the advanced fixer — the comparison isolates the
 * pipeline, not the model. See docs/BRAINSTORM.md §6.
 */

export interface AgentRun {
  html: string;
  fixes: FixResult[];
}

export async function runBaseline(html: string, scannerFindings: Finding[]): Promise<AgentRun> {
  const raw = (await complete({
    role: "fixer",
    messages: buildFixMessages(html, scannerFindings),
  })) as string;
  return { html: extractHtml(raw), fixes: [] };
}
