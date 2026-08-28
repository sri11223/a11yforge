import { describe, it, expect } from "vitest";
import { scorePage, summarize } from "../src/metrics/score.js";
import type { LayerScan } from "../src/harness/scan-all.js";
import type { Finding } from "../src/types.js";

const F = (layer: "A" | "B" | "C", wcag: string, selector: string, rule?: string): Finding => ({
  id: `${layer}:${wcag}:${selector}`, layer,
  type: layer === "A" ? "mechanical" : layer === "B" ? "behavioral" : "semantic",
  source: "t", selector, wcag, message: "m", ...(rule ? { detail: { rule } } : {}),
});
const scan = (a: Finding[] = [], b: Finding[] = [], c: Finding[] = []): LayerScan => ({ A: a, B: b, C: c });

// An image with a descriptive caption grounds an empty-alt fix; a bare hero does not.
const grounded = `<figure><img src="g.jpg" alt="image"><figcaption>Harvest Table brand identity</figcaption></figure>`;
const hero = `<main><h1>Selected work</h1><img src="h.jpg" alt="image"></main>`;

describe("scorePage — false-fix is symmetric and honest", () => {
  it("structural false-fix: A-clean after but Layer B still fails", () => {
    const before = scan([], [F("B", "2.1.1", ".btn")], []);
    const after = scan([], [F("B", "4.1.3", ".btn")], []); // axe clean, B still broken (regression too)
    const s = scorePage("p", "baseline", "<html></html>", "<html></html>", before, after);
    expect(s.falseFixPage).toBe(true);
    expect(s.trueFixPage).toBe(false);
  });

  it("hallucination false-fix: ungrounded alt shipped as a description", () => {
    const before = scan([], [], [F("C", "1.1.1", 'img[src="h.jpg"]', "generic-word")]);
    const after = scan([], [], []); // scan says resolved (alt no longer generic)...
    const shipped = hero.replace('alt="image"', 'alt="A team of designers reviewing prints"');
    const s = scorePage("p", "baseline", hero, shipped, before, after);
    expect(s.hallucinatedAlt).toBe(1);
    expect(s.issues[0]!.klass).toBe("false-fix");
    expect(s.falseFixPage).toBe(true);
  });

  it("honest escalation: ungrounded alt left + flagged for review is NOT a false-fix", () => {
    const before = scan([], [], [F("C", "1.1.1", 'img[src="h.jpg"]', "generic-word")]);
    const after = scan([], [], [F("C", "1.1.1", 'img[src="h.jpg"]', "generic-word")]); // still flagged
    const s = scorePage("p", "advanced", hero, hero, before, after, new Set(['img[src="h.jpg"]']));
    expect(s.hallucinatedAlt).toBe(0);
    expect(s.issues[0]!.klass).toBe("needs-review");
    expect(s.falseFixPage).toBe(false);
  });

  it("grounded true-fix: empty alt with a descriptive caption", () => {
    const before = scan([], [], [F("C", "1.1.1", 'img[src="g.jpg"]', "generic-word")]);
    const after = scan([], [], []);
    const shipped = grounded.replace('alt="image"', 'alt=""');
    const s = scorePage("p", "advanced", grounded, shipped, before, after);
    expect(s.issues[0]!.klass).toBe("true-fix");
    expect(s.trueFixPage).toBe(true);
  });
});

describe("summarize", () => {
  it("aggregates issue classes", () => {
    const before = scan([], [F("B", "2.1.1", ".x")], []);
    const after = scan([], [], []);
    const s = scorePage("p", "advanced", "<a href=/>x</a>", "<a href=/>x</a>", before, after);
    const sum = summarize("advanced", [s]);
    expect(sum.trueFix).toBe(1);
    expect(sum.falseFix).toBe(0);
  });
});
