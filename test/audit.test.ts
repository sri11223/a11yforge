import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { chromium, type Browser } from "playwright";
import { join } from "node:path";
import { audit, parseArgs, renderGapHtml } from "../src/cli/audit.js";

/**
 * `audit` CLI. Pure-function tests (arg parsing, HTML report) need no browser; the
 * detector tests run offline (Layer C backstops only — no key, no live URLs).
 */

describe("audit CLI arg parsing (pure)", () => {
  it("parses target + flags", () => {
    const a = parseArgs(["https://x.test", "--json", "o.json", "--html", "o.html", "--no-llm", "--ci", "--timeout", "5000"]);
    expect(a.target).toBe("https://x.test");
    expect(a.json).toBe("o.json");
    expect(a.html).toBe("o.html");
    expect(a.noLlm).toBe(true);
    expect(a.ci).toBe(true);
    expect(a.timeoutMs).toBe(5000);
  });
  it("defaults and --help", () => {
    const a = parseArgs(["./page.html"]);
    expect(a.target).toBe("./page.html");
    expect(a.noLlm).toBe(false);
    expect(a.ci).toBe(false);
    expect(a.timeoutMs).toBe(30000);
    expect(parseArgs(["--help"]).help).toBe(true);
  });
});

describe("audit gap-report HTML (pure)", () => {
  it("renders the gap headline and findings", () => {
    const html = renderGapHtml({
      target: "demo", scannerClean: true, gap: true,
      layerA: [], layerB: [{ id: "B:2.1.1:x", layer: "B", type: "behavioral", source: "t", wcag: "2.1.1", selector: ".x", message: "not focusable" }],
      layerC: [], summary: { mechanical: 0, behavioral: 1, semantic: 0, hiddenFromScanner: 1 }, judge: "off",
    });
    expect(html).toContain("Scanner-clean ≠ usable");
    expect(html).toContain("not focusable");
    expect(html).toContain("<title>");
  });
});

describe("audit detector (offline)", () => {
  let browser: Browser;
  beforeAll(async () => {
    process.env.A11YFORGE_MODE = "replay";
    browser = await chromium.launch();
  });
  afterAll(async () => {
    await browser?.close();
  });

  it("inline page: axe-clean but Layer B + C flag it → gap", async () => {
    const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>demo</title></head>
      <body><h1>Demo</h1><img src="hero.jpg" alt="image">
      <div role="button" aria-label="Play" onclick="void 0">&#9654;</div></body></html>`;
    const r = await audit("inline-demo", { browser, html: PAGE, noLlm: true });
    expect(r.scannerClean).toBe(true);
    expect(r.summary.behavioral).toBeGreaterThan(0);
    expect(r.summary.semantic).toBeGreaterThan(0);
    expect(r.gap).toBe(true);
    expect(r.judge).toBe("off");
  });

  it("fixture file: reads a local corpus page by path and finds the gap", async () => {
    const path = join(process.cwd(), "corpus", "adversarial", "icon-only-control", "index.html");
    const r = await audit(path, { browser, noLlm: true });
    expect(r.scannerClean).toBe(true); // axe-clean
    expect(r.summary.behavioral).toBeGreaterThan(0); // role=button not focusable
    expect(r.gap).toBe(true);
  });
});
