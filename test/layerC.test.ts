import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  runLayerC,
  deterministicBackstops,
  judge,
  gateModeForKappa,
} from "../src/layers/layerC-judge.js";
import { cohensKappa } from "../src/metrics/stats.js";
import type { Finding } from "../src/types.js";

// Replay is the default; pin the judge model so cassette hashes match the recorded ones.
beforeAll(() => {
  process.env.A11YFORGE_MODE = "replay";
  process.env.JUDGE_MODEL ??= "openai/gpt-4o-mini";
});

const ADV = join(process.cwd(), "corpus", "adversarial");
const readPage = (slug: string) => readFileSync(join(ADV, slug, "index.html"), "utf8");
const cats = (f: Finding[]) => f.map((x) => (x.detail as { category?: string })?.category);

// ---- 1. deterministic backstops (pure, offline) ---------------------------

describe("Layer C deterministic backstops catch the semantic pages (no LLM)", () => {
  it("alt-generic: generic-word backstop fires", () => {
    const f = deterministicBackstops(readPage("alt-generic"));
    expect(f.length).toBeGreaterThan(0);
    expect(f.every((x) => x.wcag === "1.1.1")).toBe(true);
    expect(cats(f)).toContain("generic");
  });

  it("alt-is-filename: filename backstop fires", () => {
    const f = deterministicBackstops(readPage("alt-is-filename"));
    expect(f.length).toBeGreaterThan(0);
    expect(f.some((x) => (x.detail as { rule?: string })?.rule === "filename-as-alt")).toBe(true);
  });

  it("informative-emptied: empty-alt-on-substantial-image backstop fires", () => {
    const f = deterministicBackstops(readPage("informative-emptied"));
    expect(f.some((x) => (x.detail as { rule?: string })?.rule === "informative-emptied")).toBe(true);
  });

  it("redundant-alt-decorative: decorative-alt backstop fires", () => {
    const f = deterministicBackstops(readPage("redundant-alt-decorative"));
    expect(cats(f)).toContain("decorative-misuse");
  });

  it("aria-label-contradicts: contradiction backstop fires (2.5.3)", () => {
    const f = deterministicBackstops(readPage("aria-label-contradicts"));
    expect(f.some((x) => x.wcag === "2.5.3")).toBe(true);
  });
});

describe("Layer C backstops do not cry wolf on non-semantic pages", () => {
  const CLEAN = [
    "keyboard-trap-modal",
    "css-reorder",
    "positive-tabindex",
    "live-region-missing",
    "skip-link-broken",
    "color-only-status",
    "div-button-no-keys",
    "icon-only-control",
    "placeholder-as-label",
    "heading-skip",
  ];
  for (const slug of CLEAN) {
    it(`${slug}: zero Layer-C backstop findings`, () => {
      const f = deterministicBackstops(readPage(slug));
      expect(f, `unexpected: ${JSON.stringify(f.map((x) => x.id))}`).toEqual([]);
    });
  }
});

// ---- 2. LLM judge (replay from committed cassettes) -----------------------

describe("Layer C judge (replay) agrees with expert anchors", () => {
  it("good anchor → meaningful / good", async () => {
    const v = await judge({
      text: "Barista pouring steamed milk into a latte",
      context: "Hero image on a coffee shop homepage.",
      kind: "alt",
    });
    expect(v.meaningful).toBe(true);
    expect(v.category).toBe("good");
  });

  it("generic anchor → not meaningful / generic", async () => {
    const v = await judge({
      text: "image",
      context: "Hero photo of a barista on a coffee shop homepage.",
      kind: "alt",
    });
    expect(v.meaningful).toBe(false);
    expect(v.category).toBe("generic");
  });
});

// ---- 3. published kappa reproduces offline --------------------------------

describe("judge calibration (Cohen's kappa) reproduces from cassettes", () => {
  it("kappa matches the published value and yields a hard gate", async () => {
    const anchors = JSON.parse(
      readFileSync(join(process.cwd(), "corpus", "anchor-set", "anchors.json"), "utf8"),
    ) as { items: { text: string; context: string; kind: "alt" | "label"; expertLabel: string }[] };
    const published = JSON.parse(
      readFileSync(join(process.cwd(), "corpus", "anchor-set", "kappa.json"), "utf8"),
    ) as { kappaCategory: number; gateMode: string };

    const judged: string[] = [];
    const expert: string[] = [];
    for (const a of anchors.items) {
      const v = await judge({ text: a.text, context: a.context, kind: a.kind });
      judged.push(v.category);
      expert.push(a.expertLabel);
    }
    const kappa = Number(cohensKappa(judged, expert).toFixed(4));
    expect(kappa).toBe(published.kappaCategory);
    expect(kappa).toBeGreaterThanOrEqual(0.6);
    expect(gateModeForKappa(kappa)).toBe("hard");
    expect(published.gateMode).toBe("hard");
  }, 60_000);
});

// ---- 4. runLayerC judge path (replay) ------------------------------------

describe("runLayerC with the judge (hard gate) catches nuance backstops can't", () => {
  const FIX = join(process.cwd(), "corpus", "fixtures");
  it("good-alt fixture → empty (judge confirms meaningful)", async () => {
    const f = await runLayerC(readFileSync(join(FIX, "good-alt.html"), "utf8"), {
      useJudge: true,
      gateMode: "hard",
    });
    expect(f).toEqual([]);
  });

  it("vague-alt fixture → one llm-judge finding (\"a chart\" is too vague)", async () => {
    const f = await runLayerC(readFileSync(join(FIX, "vague-alt.html"), "utf8"), {
      useJudge: true,
      gateMode: "hard",
    });
    expect(f.length).toBe(1);
    expect(f[0]!.source).toBe("llm-judge");
  });
});
