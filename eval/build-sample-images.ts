import { chromium, type Browser } from "playwright";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { screenshotHtml } from "../src/report/screenshot.js";

/**
 * Generate the sample images the `alt-generic` demo page references, so the report's
 * before/after screenshots render as real, production-looking pages instead of broken-image
 * placeholders. These are ORIGINAL, deterministic, rendered gradient/geometry compositions —
 * no third-party assets, no license risk, no network. They are pure decoration: the eval keys
 * off alt/roles/structure, never whether a file loads, so committing them changes no finding.
 * Run from dist/: node dist/eval/build-sample-images.js
 */

const OUT = join(process.cwd(), "corpus", "adversarial", "alt-generic", "assets");

interface Swatch { file: string; w: number; h: number; from: string; to: string; label: string; tag: string; }

const SWATCHES: Swatch[] = [
  { file: "hero.jpg", w: 1200, h: 525, from: "#c98a5e", to: "#5b3a29", label: "Atlas Studio", tag: "Brand systems" },
  { file: "harvest.jpg", w: 600, h: 450, from: "#d98f3a", to: "#7a3b12", label: "Harvest Table", tag: "Identity" },
  { file: "lumen.jpg", w: 600, h: 450, from: "#5c7cba", to: "#20304f", label: "Lumen", tag: "Packaging" },
  { file: "verge.jpg", w: 600, h: 450, from: "#4a9d7f", to: "#173d33", label: "Verge", tag: "Campaign" },
];

function swatchHtml(s: Swatch): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;padding:0}
    .art{width:${s.w}px;height:${s.h}px;position:relative;overflow:hidden;
      background:linear-gradient(135deg,${s.from},${s.to});
      font-family:Georgia,'Times New Roman',serif;color:#fff}
    .art::before{content:"";position:absolute;right:-12%;top:-30%;width:60%;height:150%;
      background:radial-gradient(closest-side,rgba(255,255,255,.22),transparent);transform:rotate(18deg)}
    .art::after{content:"";position:absolute;left:8%;bottom:10%;width:${Math.round(s.h*0.5)}px;height:${Math.round(s.h*0.5)}px;
      border:2px solid rgba(255,255,255,.35);border-radius:50%}
    .cap{position:absolute;left:6%;bottom:8%;z-index:2}
    .cap .t{font-size:${Math.round(s.h*0.11)}px;font-weight:700;letter-spacing:.01em;line-height:1.05}
    .cap .g{font-size:${Math.round(s.h*0.05)}px;letter-spacing:.28em;text-transform:uppercase;opacity:.85;margin-top:.4em}
  </style></head><body>
  <div class="art"><div class="cap"><div class="t">${s.label}</div><div class="g">${s.tag}</div></div></div>
  </body></html>`;
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const browser: Browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  try {
    for (const s of SWATCHES) {
      await screenshotHtml(swatchHtml(s), join(OUT, s.file), { browser, width: s.w, height: s.h, fullPage: false });
      console.log(`image: ${s.file} (${s.w}x${s.h})`);
    }
  } finally {
    await browser.close();
  }
  console.log(`Wrote sample images to ${OUT}`);
}

main().catch((e: unknown) => { console.error(e); process.exitCode = 1; });
