import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { route } from "../src/agents/router.js";
import { snapshot, checkRegression } from "../src/agents/regression-guard.js";
import { findAltGrounding } from "../src/agents/human-checkpoint.js";
import type { Finding } from "../src/types.js";

const mk = (layer: "A" | "B" | "C"): Finding => ({
  id: "x", layer, type: layer === "A" ? "mechanical" : layer === "B" ? "behavioral" : "semantic",
  source: "t", message: "m",
});

describe("router", () => {
  it("behavioral → llm; mechanical + semantic → rule (alt is never LLM-invented)", () => {
    expect(route(mk("A"))).toBe("rule");
    expect(route(mk("B"))).toBe("llm");
    expect(route(mk("C"))).toBe("rule");
  });
});

describe("regression guard (pre-commit gate)", () => {
  const base = `<!doctype html><html lang=en><head><title>t</title></head><body>
    <p>Alpha bravo charlie delta echo foxtrot golf hotel</p>
    <a href="/x">Link</a><button>Go</button>
    <figure><img src="chart.png" alt="Emissions chart falling 44 percent"></figure>
  </body></html>`;

  it("accepts a benign rewording", () => {
    const after = base.replace("Go", "Submit");
    expect(checkRegression(snapshot(base), snapshot(after)).ok).toBe(true);
  });

  it("rejects removing an image", () => {
    const after = base.replace(/<figure>[\s\S]*<\/figure>/, "");
    expect(checkRegression(snapshot(base), snapshot(after)).ok).toBe(false);
  });

  it("rejects dropping a focusable control", () => {
    const after = base.replace('<button>Go</button>', "");
    expect(checkRegression(snapshot(base), snapshot(after)).ok).toBe(false);
  });

  it("rejects emptying an informative (in-figure) image's alt", () => {
    const after = base.replace('alt="Emissions chart falling 44 percent"', 'alt=""');
    expect(checkRegression(snapshot(base), snapshot(after)).ok).toBe(false);
  });

  it("rejects wholesale content deletion", () => {
    const after = base.replace(/Alpha[^<]*/, "x");
    expect(checkRegression(snapshot(base), snapshot(after)).ok).toBe(false);
  });
});

describe("alt grounding (human checkpoint boundary)", () => {
  const altGeneric = readFileSync(
    join(process.cwd(), "corpus", "adversarial", "alt-generic", "index.html"),
    "utf8",
  );

  it("grid image with a descriptive figcaption is grounded", () => {
    const g = findAltGrounding(altGeneric, 'img[src="assets/harvest.jpg"]');
    expect(g.grounded).toBe(true);
    expect(g.source).toBe("figcaption");
  });

  it("hero image with no caption is NOT grounded → needs-review, not a guess", () => {
    const g = findAltGrounding(altGeneric, 'img[src="assets/hero.jpg"]');
    expect(g.grounded).toBe(false);
  });
});
