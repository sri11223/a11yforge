import { vi, describe, it, expect, beforeAll, afterAll } from "vitest";
import { chromium, type Browser } from "playwright";
import { z } from "zod";

/**
 * Edge-case / robustness coverage (D3):
 *  1. Layer B degrades cleanly (never throws) on hostile DOMs — incl. a "button" whose click
 *     navigates and wipes window.__mut (the real-site "reading 'map'" class).
 *  2. Layer B still runs under a strict Content-Security-Policy (D1): helpers are injected via
 *     CDP page.evaluate, not a CSP-blocked <script> tag.
 *  3. The openrouter schema-retry (D2): invalid→valid succeeds within the 3-attempt bound;
 *     3× invalid throws cleanly; temperature=0 + seed pinned on every attempt.
 */

// --- (3) schema-retry: mock the OpenAI transport so we control replies ------------------------
const createMock = vi.fn();
vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create: createMock } };
  },
}));
// Imported after the mock so client() uses the stub.
import { complete } from "../src/llm/openrouter-client.js";
import { runLayerB } from "../src/layers/layerB-sr.js";

let browser: Browser;
beforeAll(async () => {
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
});

describe("Layer B degrades cleanly on hostile DOMs (never throws)", () => {
  it("a button that reloads on click (wipes window.__mut) → still resolves to an array", async () => {
    // checkLiveRegions clicks visible non-submit buttons; this one reloads the page, so the
    // later read of window.__mut lands in a fresh context (undefined). Must not crash.
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>x</title></head>
      <body><main><h1>Hi</h1><button type="button" onclick="location.reload()">Go</button></main></body></html>`;
    const findings = await runLayerB({ html }, { browser });
    expect(Array.isArray(findings)).toBe(true);
  });

  it("a near-empty document → resolves to an array, no throw", async () => {
    const findings = await runLayerB({ html: "<!doctype html><title>empty</title>" }, { browser });
    expect(Array.isArray(findings)).toBe(true);
  });
});

describe("Layer B runs under a strict CSP (D1: CDP-injected helpers, not addScriptTag)", () => {
  it("finds the heading-skip on a CSP page that would block <script> injection", async () => {
    const csp = `<meta http-equiv="Content-Security-Policy" content="script-src 'self'">`;
    // h1 → h3 is a heading-outline skip (WCAG 1.3.1); detecting it requires window.__b, which a
    // strict script-src CSP would block if injected via addScriptTag.
    const body = `<main><h1>Title</h1><h3>Sub</h3><p>body</p></main>`;
    const cspHtml = `<!doctype html><html lang="en"><head><meta charset="utf-8">${csp}<title>csp</title></head><body>${body}</body></html>`;
    const plainHtml = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>plain</title></head><body>${body}</body></html>`;

    const cspFindings = await runLayerB({ html: cspHtml }, { browser });
    const plainFindings = await runLayerB({ html: plainHtml }, { browser });
    // Detected under CSP → the helpers landed via CDP and the checks ran.
    expect(cspFindings.map((f) => f.wcag)).toContain("1.3.1");
    // And CSP didn't change the finding vs the plain page (control).
    expect(cspFindings.map((f) => f.wcag).sort()).toEqual(plainFindings.map((f) => f.wcag).sort());
  });
});

describe("openrouter schema-retry (D2): bounded reflexion, deterministic params", () => {
  const schema = z.object({ verdict: z.string() });
  const reply = (content: string) => ({ choices: [{ message: { content } }] });

  beforeAll(() => {
    process.env.A11YFORGE_MODE = "live";
    process.env.OPENROUTER_API_KEY ??= "test-key";
    process.env.JUDGE_MODEL = "test/judge-model";
  });

  it("first reply invalid, second valid → returns the parsed object within the bound", async () => {
    createMock.mockReset();
    createMock
      .mockResolvedValueOnce(reply("not valid json"))
      .mockResolvedValueOnce(reply('{"verdict":"good"}'));
    const out = await complete({ role: "judge", messages: [{ role: "user", content: "x" }], schema });
    expect(out).toEqual({ verdict: "good" });
    expect(createMock).toHaveBeenCalledTimes(2);
    for (const call of createMock.mock.calls) {
      expect(call[0]).toMatchObject({ temperature: 0, seed: 42 });
    }
  });

  it("three invalid replies → throws cleanly after the 3-attempt bound", async () => {
    createMock.mockReset();
    createMock.mockResolvedValue(reply("still not json"));
    await expect(
      complete({ role: "judge", messages: [{ role: "user", content: "x" }], schema }),
    ).rejects.toThrow(/schema validation failed after 3/);
    expect(createMock).toHaveBeenCalledTimes(3);
  });
});
