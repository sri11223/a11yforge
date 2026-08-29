import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { chromium, type Browser } from "playwright";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runAdvanced } from "../src/agents/advanced.js";
import { scanAll } from "../src/harness/scan-all.js";

/**
 * Advanced agent — replayed from committed cassettes (offline, deterministic).
 * The win is verification + honest escalation, not raw fix-count.
 */

beforeAll(() => {
  process.env.A11YFORGE_MODE = "replay";
  process.env.FIXER_MODEL ??= "anthropic/claude-sonnet-5";
  process.env.JUDGE_MODEL ??= "openai/gpt-4o-mini";
});

const DIR = join(process.cwd(), "corpus", "adversarial");
const readPage = (slug: string) => readFileSync(join(DIR, slug, "index.html"), "utf8");

let browser: Browser;
beforeAll(async () => { browser = await chromium.launch(); });
afterAll(async () => { await browser?.close(); });

describe("advanced agent: verification turns a false-fix into a true-fix", () => {
  it("icon-only-control: ends A/B/C clean where the baseline shipped B findings", async () => {
    const res = await runAdvanced(readPage("icon-only-control"), { browser, pageId: "icon-only-control" });
    // Every attempted fix was verified and accepted.
    expect(res.fixes.every((f) => f.outcome === "true-fix")).toBe(true);
    // Each committed fix went through the verify-loop (target resolved, no new findings).
    for (const f of res.fixes) {
      if (f.iterations.length) {
        const last = f.iterations[f.iterations.length - 1]!;
        expect(last.accepted).toBe(true);
        expect(last.newFindings).toEqual([]);
      }
    }
    // The shipped page is genuinely usable — Layer B is clean (baseline left B flagged).
    const after = await scanAll(res.html, { browser });
    expect(after.A.length).toBe(0);
    expect(after.B.length).toBe(0);
  });
});

describe("advanced agent: escalates ungrounded alt instead of hallucinating", () => {
  it("alt-generic: grounded grid images fixed by rule; ungrounded hero → needs-review", async () => {
    const res = await runAdvanced(readPage("alt-generic"), { browser, pageId: "alt-generic" });

    // Integrity: alt is NEVER written by the LLM — only rule (grounded) or checkpoint.
    for (const f of res.fixes.filter((x) => x.layer === "C")) {
      expect(f.strategy === "rule" || f.strategy === "checkpoint").toBe(true);
    }
    // The ungrounded hero is escalated, not guessed.
    expect(res.reviewQueue.length).toBeGreaterThanOrEqual(1);
    expect(res.fixes.some((f) => f.outcome === "needs-review")).toBe(true);
    // ...and its original meaningless alt is left untouched (no fabricated description shipped).
    expect(res.html).toContain('alt="image"');
    // The grounded grid images WERE fixed.
    expect(res.fixes.some((f) => f.outcome === "true-fix" && f.strategy === "rule")).toBe(true);
  });
});

describe("advanced agent: never ships a scanner-clean-but-broken page (universal escalation)", () => {
  it("v2-icon-focus-fav: an unfixable keyboard (Layer B) issue is escalated, never shipped silently", async () => {
    const dir = join(process.cwd(), "corpus", "injected-v2");
    const html = readFileSync(join(dir, "v2-icon-focus-fav", "index.html"), "utf8");
    const res = await runAdvanced(html, { browser, pageId: "v2-icon-focus-fav" });
    const after = await scanAll(res.html, { browser });

    // The page ships Layer-A clean (a scanner would call it "done")...
    expect(after.A.length).toBe(0);
    // ...but the not-focusable control could not be verify-fixed, so a residual B remains.
    expect(after.B.length).toBeGreaterThan(0);
    // INTEGRITY INVARIANT: every residual B/C on an A-clean page MUST be escalated — the agent
    // must never emit an issue it could not verify. So nothing broken ships without a flag.
    const escalated = new Set(res.reviewQueue.map((r) => r.selector));
    for (const f of [...after.B, ...after.C]) {
      expect(escalated.has(f.selector ?? "")).toBe(true);
    }
    expect(res.fixes.some((f) => f.outcome === "needs-review" && f.layer === "B")).toBe(true);
  });
});

describe("advanced agent is deterministic", () => {
  it("same page → identical html and outcome sequence across runs", async () => {
    const a = await runAdvanced(readPage("icon-only-control"), { browser });
    const b = await runAdvanced(readPage("icon-only-control"), { browser });
    expect(a.html).toBe(b.html);
    expect(a.fixes.map((f) => f.outcome)).toEqual(b.fixes.map((f) => f.outcome));
  });
});
