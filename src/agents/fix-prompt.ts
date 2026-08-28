import type { ChatMessage } from "../llm/openrouter-client.js";
import type { Finding } from "../types.js";

/**
 * The SHARED fix prompt used by BOTH the baseline (single-shot) and the advanced
 * agent's fixer. Keeping it identical is what makes the comparison fair: the only
 * difference between baseline and advanced is the pipeline (verify-loop, regression
 * guard, checkpoint), never the model, the prompt, or what it's told is wrong.
 */

export const FIX_SYSTEM =
  "You are an expert web accessibility (WCAG 2.1 AA) engineer. You are given an HTML page " +
  "and a list of accessibility violations an automated scanner detected. Fix the accessibility " +
  "problems and return the COMPLETE corrected HTML document. Automated scanners miss most issues, " +
  "so also address anything else you can identify: keyboard operability (Enter/Space activation, " +
  "focus traps, focus order, positive tabindex), screen-reader experience (live regions for dynamic " +
  "updates, accessible names, meaningful alt text and labels, reading order), and semantic structure " +
  "(heading levels, skip links). Return ONLY the HTML document — no explanation and no markdown fences.";

/** Build the (system,user) messages for one fix pass. */
export function buildFixMessages(html: string, scannerFindings: Finding[]): ChatMessage[] {
  const list = scannerFindings.length
    ? scannerFindings
        .map((f) => `- [${f.wcag ?? "?"}] ${f.message}${f.selector ? ` (selector: ${f.selector})` : ""}`)
        .join("\n")
    : "No violations were reported by the automated scanner.";
  return [
    { role: "system", content: FIX_SYSTEM },
    { role: "user", content: `Scanner-reported violations:\n${list}\n\nHTML:\n${html}` },
  ];
}

/** Strip an optional ```html … ``` fence some models add around the returned document. */
export function extractHtml(raw: string): string {
  const fenced = /```(?:html)?\s*([\s\S]*?)```/i.exec(raw);
  return (fenced ? fenced[1]! : raw).trim();
}

/**
 * Targeted fix prompt used by the advanced agent's verify-loop: fix ONE behavioral
 * issue and nothing else, with optional feedback from a rejected prior attempt.
 * Semantic alt is NEVER fixed via this path (grounded rule-fix or human checkpoint
 * only) so the model cannot invent descriptions for pixels it never saw.
 */
export function buildTargetedFixMessages(
  html: string,
  target: { wcag?: string; message: string; selector?: string },
  feedback?: string,
): ChatMessage[] {
  const system =
    "You are an expert web accessibility engineer. Fix ONLY the single issue described " +
    "below and change as little else as possible. Preserve all visible text, controls, and " +
    "images — never delete, hide, or empty content to satisfy a checker. Return the COMPLETE " +
    "corrected HTML document only — no explanation, no markdown fences.";
  const fb = feedback
    ? `\n\nYour previous attempt was rejected by automated verification:\n${feedback}\nAddress this in the corrected HTML.`
    : "";
  return [
    { role: "system", content: system },
    {
      role: "user",
      content:
        `Issue to fix: [${target.wcag ?? "?"}] ${target.message}` +
        `${target.selector ? ` (selector: ${target.selector})` : ""}${fb}\n\nHTML:\n${html}`,
    },
  ];
}
