import { chromium, type Browser } from "playwright";
import { join } from "node:path";
import { screenshotHtml } from "../src/report/screenshot.js";

/**
 * Generate the raster sample images that a handful of corpus pages reference, so the pages render
 * as real, self-contained pages instead of broken-image placeholders. ORIGINAL, deterministic,
 * rendered compositions — no third-party assets, no license risk, no network. Pure decoration:
 * the eval scores alt/roles/structure, never whether a file loads, so committing these changes no
 * finding (verified by a byte-identical eval diff after). Run from dist/:
 *   node dist/eval/build-corpus-images.js
 */

interface Img { path: string; w: number; h: number; kind: "portrait" | "scene"; from: string; to: string; label: string; }

const IMAGES: Img[] = [
  { path: "corpus/adversarial/alt-is-filename/staff/DSC_0042.jpg",            w: 480, h: 480, kind: "portrait", from: "#6b7f9e", to: "#2b384c", label: "" },
  { path: "corpus/adversarial/alt-is-filename/staff/IMG_20240118_final.jpg",  w: 480, h: 480, kind: "portrait", from: "#9e7f6b", to: "#4c382b", label: "" },
  { path: "corpus/adversarial/alt-is-filename/staff/headshot-v2-web.png",     w: 480, h: 480, kind: "portrait", from: "#6b9e83", to: "#2b4c3a", label: "" },
  { path: "corpus/injected/inj-alt-filename-heading/assets/IMG_5521.jpg",     w: 800, h: 450, kind: "scene",    from: "#c98a5e", to: "#5b3a29", label: "" },
  { path: "corpus/injected/inj-alt-generic-caption/assets/dawn.jpg",          w: 800, h: 450, kind: "scene",    from: "#f6b26b", to: "#b23a55", label: "" },
  { path: "corpus/injected-v2/v2-alt-filename-team/assets/DSC_1180.jpg",      w: 800, h: 450, kind: "scene",    from: "#5c7cba", to: "#20304f", label: "" },
  { path: "corpus/injected-v2/v2-alt-generic-hero/assets/aurora.jpg",         w: 800, h: 450, kind: "scene",    from: "#3aa675", to: "#173d6b", label: "" },
];

function html(img: Img): string {
  const portrait = `
    <div class="art">
      <div class="bust"></div>
    </div>`;
  const scene = `
    <div class="art">
      <div class="sun"></div>
    </div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;padding:0}
    .art{width:${img.w}px;height:${img.h}px;position:relative;overflow:hidden;
      background:linear-gradient(150deg,${img.from},${img.to})}
    .bust{position:absolute;left:50%;bottom:0;transform:translateX(-50%);
      width:${Math.round(img.w * 0.62)}px;height:${Math.round(img.h * 0.62)}px;
      background:rgba(255,255,255,.16);border-radius:50% 50% 0 0}
    .bust::before{content:"";position:absolute;left:50%;top:-${Math.round(img.h * 0.20)}px;transform:translateX(-50%);
      width:${Math.round(img.w * 0.30)}px;height:${Math.round(img.w * 0.30)}px;background:rgba(255,255,255,.22);border-radius:50%}
    .sun{position:absolute;right:16%;top:22%;width:${Math.round(img.h * 0.34)}px;height:${Math.round(img.h * 0.34)}px;
      border-radius:50%;background:radial-gradient(closest-side,rgba(255,255,255,.6),rgba(255,255,255,0))}
  </style></head><body>${img.kind === "portrait" ? portrait : scene}</body></html>`;
}

async function main(): Promise<void> {
  const browser: Browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  try {
    for (const img of IMAGES) {
      await screenshotHtml(html(img), join(process.cwd(), img.path), { browser, width: img.w, height: img.h, fullPage: false });
      console.log(`image: ${img.path} (${img.w}x${img.h})`);
    }
  } finally {
    await browser.close();
  }
  console.log(`Wrote ${IMAGES.length} corpus images`);
}

main().catch((e: unknown) => { console.error(e); process.exitCode = 1; });
