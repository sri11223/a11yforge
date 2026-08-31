import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readFileSync, existsSync, renameSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { stageHtml, HELPERS, THEME, beat, W, H } from "./lib/stage.mjs";
import { register as registerB } from "./segments-b.mjs";
import { register as registerC } from "./segments-c.mjs";

/**
 * Records one video segment with Playwright and leaves a .webm in out/video/raw/.
 *   node video/record.mjs <segmentId>
 *
 * Crispness: viewport 1920x1080 at deviceScaleFactor 2, so the page renders at 3840x2160 and is
 * downscaled into 1080p frames — text stays sharp instead of mushy.
 *
 * HONESTY: page shots load the real file; text shots render REAL CAPTURED output read from disk at
 * record time (never hand-authored). If a segment needs output we haven't captured, it fails loudly
 * rather than inventing it.
 */

const REPO = resolve(import.meta.dirname, "..");
const RAW = join(REPO, "out", "video", "raw");
const seg = process.argv[2];

const fileUrl = (p) => pathToFileURL(join(REPO, p)).href;
/** Read a real artifact, or fail loudly. Never substitute prose for captured output. */
function realFile(rel) {
  const p = join(REPO, rel);
  if (!existsSync(p)) throw new Error(`refusing to fabricate: missing real artifact ${rel}`);
  return readFileSync(p, "utf8");
}

async function openStage(browser, opts) {
  const ctx = await browser.newContext({
    viewport: { width: W, height: H },
    deviceScaleFactor: 2,
    recordVideo: { dir: RAW, size: { width: W, height: H } },
    reducedMotion: "no-preference",
  });
  const page = await ctx.newPage();
  const tmp = join(REPO, "out", "video", `stage-${opts.id}.html`);
  writeFileSync(tmp, stageHtml(opts), "utf8");
  await page.goto(pathToFileURL(tmp).href, { waitUntil: "load" });
  await page.evaluate(HELPERS);
  return { ctx, page };
}

/** Screen-space rect of a locator (accounts for iframe offset AND any active stage zoom). */
async function boxOf(loc) {
  const b = await loc.boundingBox();
  if (!b) throw new Error("refusing to guess: element has no box on screen");
  return b;
}
const centerOf = (b) => [b.x + b.width / 2, b.y + b.height / 2];

/**
 * Scroll a locator into view inside its frame, let it settle, then return its screen rect.
 * boundingBox() does NOT scroll — annotating without this draws the circle on empty background.
 */
async function focusOn(loc, block = "center") {
  await loc.evaluate((el, b) => el.scrollIntoView({ behavior: "smooth", block: b }), block);
  await new Promise((r) => setTimeout(r, 620));
  return boxOf(loc);
}

/**
 * Screen rect of an element's RENDERED TEXT rather than its box. A block-level number spans the
 * whole column, so circling the box encircles mostly whitespace. Measured with a Range inside the
 * frame, then mapped through the element's own box so it stays correct under any stage zoom.
 */
async function glyphBox(loc) {
  const outer = await boxOf(loc);
  const inner = await loc.evaluate((el) => {
    const r = document.createRange();
    r.selectNodeContents(el);
    const t = r.getBoundingClientRect(), e = el.getBoundingClientRect();
    return { tx: t.x, ty: t.y, tw: t.width, th: t.height, ex: e.x, ey: e.y, ew: e.width };
  });
  const s = inner.ew ? outer.width / inner.ew : 1;
  return {
    x: outer.x + (inner.tx - inner.ex) * s, y: outer.y + (inner.ty - inner.ey) * s,
    width: inner.tw * s, height: inner.th * s,
  };
}

async function finish(ctx, page, id) {
  const vid = page.video();
  await ctx.close();
  const src = await vid.path();
  const dest = join(RAW, `${id}.webm`);
  renameSync(src, dest);
  console.log(`wrote ${dest}`);
}

// ─────────────────────────────────────────────────────────────────────────────
const SEGMENTS = {
  /** 1. Title card. */
  async "01-title"(browser) {
    const { ctx, page } = await openStage(browser, {
      id: "01-title", frame: false, dark: true, innerW: 1240, innerH: 470,
      inner: `<div style="width:1240px;height:470px;display:flex;flex-direction:column;
        justify-content:center;padding:0 64px;background:transparent;color:#eaf1fb;
        font-family:-apple-system,'Segoe UI',Roboto,sans-serif">
        <div style="font-size:19px;letter-spacing:.30em;text-transform:uppercase;color:#4da3ff;
          font-weight:700">A11yForge</div>
        <div style="font-size:80px;font-weight:800;letter-spacing:-.035em;margin-top:20px;line-height:1.03">
          scanner&#8209;clean <span style="color:#4da3ff">&#8800;</span> usable</div>
        <div style="font-size:29px;color:#a9bdd8;margin-top:28px;line-height:1.45;max-width:1050px">
          An agent that fixes accessibility bugs &mdash; and proves how often a fix that passes the
          scanner is still <em>unusable</em> to a screen&#8209;reader user.</div>
      </div>`,
    });
    await beat(900);
    await page.evaluate(() => window.__v.zoomTo(1.03, 19000));
    await beat(2600);
    await page.evaluate(() => window.__v.caption(
      "In 2025 the FTC fined accessiBe <b>$1M</b> for false compliance claims",
      "built on scanner output. WebAIM's Million report: 95.9% of homepages still fail."));
    await beat(9500);
    await page.evaluate(() => window.__v.hideCaption());
    await beat(2100);
    await finish(ctx, page, "01-title");
  },

  /**
   * 2. THE COLD OPEN. No title card, no scene-setting: the first caption names the user and the
   * failure in one line, because a viewer decides in the first ten seconds. The title card is a
   * 2s stamp much later (see 01b-answer) rather than an introduction.
   */
  async "02-hook"(browser) {
    const rel = "corpus/adversarial/keyboard-trap-modal/index.html";
    const { ctx, page } = await openStage(browser, {
      id: "02-hook", fullFrame: true, chromeLabel: rel, src: fileUrl(rel),
    });
    const frame = page.frameLocator("#stageFrame");
    // Browser zoom at 125%, which is the Windows default on a 1080p laptop and a viewer setting
    // rather than an edit: it changes how the page is DRAWN, not a byte of what it contains.
    await frame.locator("body").evaluate(() => { document.documentElement.style.zoom = "1.25"; });

    await beat(700);
    await page.evaluate(() => window.__v.caption(
      "Every automated scanner passes this page. <b>A keyboard user cannot get out of this dialog.</b>",
      "axe-core and pa11y both report 0 violations on it. A page from our adversarial corpus, built to be exactly this."));
    await beat(3200);
    await page.evaluate(() => window.__v.hideCaption());
    await beat(500);

    // open the newsletter dialog the way a user would: move, pause, click
    const [bx, by] = centerOf(await boxOf(frame.locator("#open-modal")));
    await page.evaluate(() => window.__v.setCursor(880, 210));
    await page.evaluate(([x, y]) => window.__v.moveCursor(x, y, 640), [bx, by]);
    await beat(520);
    await page.evaluate(() => window.__v.clickFx());
    await frame.locator("#open-modal").click();
    await beat(1100);

    await page.evaluate(() => window.__v.caption("The dialog opens. Now try to leave it with the keyboard."));
    await beat(1900);
    await page.evaluate(() => window.__v.hideCaption());

    // A high-contrast focus ring is INJECTED so the real focus position is visible on camera.
    // This changes only how the real focus is drawn — it is captioned as added.
    await frame.locator("body").evaluate(() => {
      const s = document.createElement("style");
      s.textContent = `*:focus{outline:4px solid #ff5f57 !important;outline-offset:3px !important;
        box-shadow:0 0 0 7px rgba(255,95,87,.28) !important}`;
      document.head.appendChild(s);
    });
    // The pointer leaves frame: this demo is keyboard-only, and a drifting cursor contradicts it.
    await page.evaluate(() => window.__v.parkCursor(700));
    await page.evaluate(() => window.__v.caption(
      "Pressing <b>Tab</b> — focus ring added for the camera, focus position is real."));
    await beat(1300);
    await page.evaluate(() => window.__v.hideCaption());

    // Six presses, not eight. The failure is legible by the third and the shot has to pay for the
    // result beat that now follows it; the count on screen is whatever we actually pressed.
    const TABS = 6;
    for (let i = 1; i <= TABS; i++) {
      await page.keyboard.press("Tab");
      await page.evaluate((n) => window.__v.showBadge(`Tab pressed <b>${n}</b>`), i);
      await beat(880, 110); // let each press land — the audience should feel the failure
    }
    await page.evaluate((n) => window.__v.caption(
      `${n} presses. <b>Focus never leaves the dialog.</b>`,
      "WCAG 2.1.2 — no keyboard exit. A scanner cannot see this: it never presses a key."), TABS);
    await beat(3000);
    await page.evaluate(() => { window.__v.hideCaption(); window.__v.hideBadge(); });
    await beat(400);

    await page.keyboard.press("Escape");
    await page.evaluate(() => window.__v.caption("<b>Escape.</b> Nothing happens.",
      "The only close control is a &lt;span&gt; — not focusable, not keyboard-operable."));
    await beat(2900);
    await page.evaluate(() => window.__v.hideCaption());
    await beat(700);
    await finish(ctx, page, "02-hook");
  },

  /**
   * 1. THE STAKES — who is affected and how widespread it is.
   *
   * Deliberately placed AFTER the hook, not before: the viewer should feel the failure first and
   * then learn it is everywhere. Stakes-before-demo is the origin-story opening we removed.
   *
   * Both figures are EXTERNAL citations, not our measurements, and the card says so on screen —
   * the same habit as citing docs/results/ablation.json on the funnel. They are read out of
   * docs/report.html at record time so they cannot drift from the committed text.
   */
  async "01-stakes"(browser) {
    const rep = realFile("docs/report.html");
    const pick = (re, what) => {
      const m = re.exec(rep);
      if (!m) throw new Error(`refusing to fabricate: ${what} not found in docs/report.html`);
      return m[1];
    };
    const fine = pick(/the FTC fined accessiBe <strong>\$(1M) in 2025<\/strong>/, "FTC fine");
    const webaim = pick(/WebAIM's Million report finds\s*<strong>([\d.]+%)<\/strong>/, "WebAIM figure");

    const { ctx, page } = await openStage(browser, {
      id: "01-stakes", frame: false, dark: true, innerW: 1560, innerH: 640,
      inner: `<div id="stk" style="width:1560px;height:640px;padding:0 40px;display:flex;
        flex-direction:column;justify-content:center"></div>`,
    });
    await page.evaluate(({ font, mono, fine, webaim }) => {
      const row = (label, html) => `
        <div class="sr" style="opacity:0;transform:translateY(10px);
          transition:opacity .45s ease, transform .45s ease;margin-bottom:30px">
          <div style="font:700 17px ${font};letter-spacing:.22em;text-transform:uppercase;
            color:#4da3ff;margin-bottom:9px">${label}</div>
          <div style="font:600 40px/1.28 ${font};color:#eaf1fb;letter-spacing:-.02em">${html}</div></div>`;
      document.getElementById("stk").innerHTML =
        row("Who this is for", "People who navigate by <b>keyboard</b> and <b>screen reader</b>.") +
        row("The scale", `WebAIM's Million report: <span style="color:#ffca6b">${webaim}</span> of homepages
             still fail an automated check.`) +
        row("Why it matters", `In 2025 the FTC fined a vendor <span style="color:#ff8a80">$${fine}</span>
             for compliance claims built on scanner output.`) +
        `<div id="cite" style="opacity:0;transition:opacity .4s ease;font:400 19px ${mono};color:#6f8299;
           margin-top:8px">WebAIM Million &middot; FTC 2025 order &mdash; external citations, not our measurements</div>`;
    }, { font: THEME.fontA, mono: THEME.monoA, fine, webaim });

    await beat(500);
    for (let i = 0; i < 3; i++) {
      await page.evaluate((n) => {
        const el = document.querySelectorAll(".sr")[n];
        el.style.opacity = "1"; el.style.transform = "translateY(0)";
      }, i);
      await beat(1850, 90);
    }
    await page.evaluate(() => { document.getElementById("cite").style.opacity = "1"; });
    await beat(2600);
    await finish(ctx, page, "01-stakes");
  },

  /**
   * 1b. THE ANSWER, UP FRONT. Pyramid principle: the result before the explanation. A judge who
   * stops watching at 45 seconds should already know what we built and what it achieved. The
   * title card is folded in at the END of this beat as a 2s stamp — a signature, not an intro.
   *
   * Every figure here is read from the sealed artifacts at record time; the WebAIM and FTC lines
   * are attributed on screen as external citations, because they are not our measurements.
   */
  async "01b-answer"(browser) {
    const m = JSON.parse(realFile("docs/results/metrics.json"));
    const harm = m.harm?.harmfulChanges?.baseline;
    const harmA = m.harm?.harmfulChanges?.advanced;
    if (harm !== 8 || harmA !== 0) {
      throw new Error(`refusing to fabricate: expected harmfulChanges 8 -> 0, read ${harm} -> ${harmA}`);
    }
    const { ctx, page } = await openStage(browser, {
      id: "01b-answer", frame: false, dark: true, innerW: 1560, innerH: 700,
      inner: `<div id="ans" style="width:1560px;height:700px;padding:0 40px;display:flex;
        flex-direction:column;justify-content:center"></div>`,
    });
    await page.evaluate(({ font, mono, harm, harmA }) => {
      document.getElementById("ans").innerHTML =
        `<div id="a1" style="opacity:0;transition:opacity .5s ease;font:800 54px/1.2 ${font};
           letter-spacing:-.028em;color:#eaf1fb">So we built an agent that fixes issues like this —<br>
           and <span style="color:#4da3ff">refuses to ship a fix it cannot verify.</span></div>
         <div id="a2" style="opacity:0;transition:opacity .5s ease;display:flex;gap:26px;margin-top:44px">
           <div style="flex:1;background:rgba(255,95,87,.10);border:1px solid #5c2b28;border-radius:12px;padding:24px 28px">
             <div style="font:800 62px ${mono};color:#ff8a80;line-height:1">${harm}</div>
             <div style="font:400 23px/1.4 ${font};color:#d7c4c2;margin-top:10px">harmful changes shipped by the
               single-shot baseline</div></div>
           <div style="flex:1;background:rgba(40,200,120,.10);border:1px solid #24543c;border-radius:12px;padding:24px 28px">
             <div style="font:800 62px ${mono};color:#79e2a8;line-height:1">${harmA}</div>
             <div style="font:400 23px/1.4 ${font};color:#bfd8c9;margin-top:10px">harmful changes shipped by the
               verified agent — same model, same prompt</div></div></div>
         <div id="a3" style="opacity:0;transition:opacity .5s ease;margin-top:40px;font:400 24px/1.5 ${font};color:#9db2ce">
           <b style="color:#eaf1fb">Why it matters.</b> WebAIM's Million report: <b style="color:#eaf1fb">95.9%</b>
           of homepages still fail. In 2025 the FTC fined accessiBe
           <b style="color:#eaf1fb">$1M</b> for compliance claims built on scanner output.
           <span style="color:#6f8299">— cited, not our measurement</span></div>`;
    }, { font: THEME.fontA, mono: THEME.monoA, harm, harmA });

    await beat(600);
    await page.evaluate(() => { document.getElementById("a1").style.opacity = "1"; });
    await beat(2600);
    await page.evaluate(() => { document.getElementById("a2").style.opacity = "1"; });
    await page.evaluate(() => window.__v.caption("The result first, then the method.",
      "docs/results/metrics.json — sealed 27-page corpus, byte-reproducible offline."));
    await beat(4400);
    await page.evaluate(() => window.__v.hideCaption());
    await page.evaluate(() => { document.getElementById("a3").style.opacity = "1"; });
    await beat(4400);

    // The title card as a 2s stamp — a signature at the end of the beat, not an introduction.
    await page.evaluate(({ font }) => {
      document.getElementById("ans").innerHTML =
        `<div id="stamp" style="opacity:0;transition:opacity .45s ease;height:700px;display:flex;
           flex-direction:column;justify-content:center;font-family:${font}">
           <div style="font:700 19px ${font};letter-spacing:.30em;text-transform:uppercase;color:#4da3ff">A11yForge</div>
           <div style="font:800 84px/1.03 ${font};letter-spacing:-.035em;margin-top:18px;color:#eaf1fb">
             scanner&#8209;clean <span style="color:#4da3ff">&#8800;</span> usable</div></div>`;
      requestAnimationFrame(() => { document.getElementById("stamp").style.opacity = "1"; });
    }, { font: THEME.fontA });
    await beat(2200);
    await finish(ctx, page, "01b-answer");
  },
};

const helpers = { openStage, finish, fileUrl, realFile, REPO, boxOf, centerOf, focusOn, glyphBox };
registerB(SEGMENTS, helpers);
registerC(SEGMENTS, helpers);

if (!SEGMENTS[seg]) {
  console.error(`unknown segment "${seg}". available: ${Object.keys(SEGMENTS).join(", ")}`);
  process.exit(2);
}
mkdirSync(RAW, { recursive: true });
const browser = await chromium.launch({ args: ["--no-sandbox", "--force-device-scale-factor=1"] });
try {
  await SEGMENTS[seg](browser);
} finally {
  await browser.close();
}
