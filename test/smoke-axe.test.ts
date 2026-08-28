import { describe, it, expect, afterAll } from "vitest";
import { chromium, type Browser } from "playwright";
import { AxeBuilder } from "@axe-core/playwright";

/**
 * "hello axe" smoke test — proves the toolchain works end to end:
 * Playwright chromium launches, loads HTML with a known violation (img missing
 * alt), and @axe-core/playwright detects it. No LLM key required.
 */

let browser: Browser | undefined;

afterAll(async () => {
  await browser?.close();
});

describe("toolchain smoke test", () => {
  it(
    "detects a missing image alt via axe-core",
    async () => {
      browser = await chromium.launch();
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.setContent(
        `<!doctype html><html lang="en"><head><title>smoke</title></head>
         <body><img src="cat.jpg"></body></html>`,
      );

      const results = await new AxeBuilder({ page }).analyze();
      const ids = results.violations.map((v) => v.id);

      expect(ids).toContain("image-alt");
    },
    60_000,
  );
});
