import { type Browser, type Page, type CDPSession } from "playwright";
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { Finding } from "../types.js";

/**
 * Layer B — behavioral, deterministic. The screen-reader / keyboard layer that
 * finds what a scanner fundamentally cannot see: keyboard traps, focus/reading
 * order, keyboard operability, accessible-name presence on custom controls,
 * missing live regions, broken skip links, and skipped heading levels.
 *
 * Engines (see docs/BRAINSTORM.md §2):
 *  - PRIMARY announcement oracle: the Guidepup virtual screen reader
 *    (@guidepup/virtual-screen-reader), injected into the page. Its spoken output
 *    is captured as the "what a screen-reader user hears" evidence.
 *  - CROSS-CHECK: CDP Accessibility.getFullAXTree (the real accessibility tree a
 *    screen reader consumes) — used to corroborate roles/names.
 *  - FALLBACK: if the virtual-SR fails to inject, the CDP AX tree provides the
 *    reading order instead; the deterministic checks still run.
 *
 * The deterministic pass/fail logic runs on real Chromium via Playwright + CDP
 * (real layout, real JS, real keyboard) because that is where determinism and
 * fidelity are strongest — reproducibility is the priority for this layer.
 *
 * HONEST CAVEAT: this is a *simulator* of reading order, keyboard operability,
 * and accessible-name presence — NOT a bug-for-bug NVDA/JAWS/VoiceOver replica.
 * We claim structure / order / operability fidelity, which is exactly where the
 * scanner gap lives; we do NOT claim literal announcement-string equivalence.
 */

const require = createRequire(import.meta.url);

/** Browser-side helpers injected into every page: selector paths, visibility, ACCName. */
const HELPERS = `
window.__b = {
  cssPath(el) {
    if (!el || el.nodeType !== 1) return el === document.body ? 'body' : '';
    const parts = [];
    while (el && el.nodeType === 1 && el.tagName !== 'HTML') {
      let s = el.tagName.toLowerCase();
      const p = el.parentElement;
      if (p) {
        const sibs = [...p.children].filter(c => c.tagName === el.tagName);
        if (sibs.length > 1) s += ':nth-of-type(' + (sibs.indexOf(el) + 1) + ')';
      }
      parts.unshift(s);
      el = el.parentElement;
    }
    return parts.join(' > ');
  },
  isVisible(el) {
    if (!el || el.nodeType !== 1) return false;
    const r = el.getBoundingClientRect();
    const st = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none' && st.opacity !== '0';
  },
  name(el) {
    const al = el.getAttribute && el.getAttribute('aria-label');
    if (al && al.trim()) return al.trim();
    const lb = el.getAttribute && el.getAttribute('aria-labelledby');
    if (lb) {
      const t = lb.split(/\\s+/).map(id => (document.getElementById(id) || {}).textContent || '').join(' ').trim();
      if (t) return t;
    }
    const tag = el.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') {
      if (el.id) {
        const l = document.querySelector('label[for="' + (window.CSS ? CSS.escape(el.id) : el.id) + '"]');
        if (l && l.textContent.trim()) return l.textContent.trim();
      }
      const pl = el.closest && el.closest('label');
      if (pl && pl.textContent.trim()) return pl.textContent.trim();
    }
    const title = el.getAttribute && el.getAttribute('title');
    if (title && title.trim()) return title.trim();
    const txt = (el.textContent || '').trim();
    if (txt) return txt;
    const img = el.querySelector && el.querySelector('img[alt]');
    if (img && img.alt.trim()) return img.alt.trim();
    return '';
  },
  isMeaningfulName(s) { return !!s && /[a-z0-9]/i.test(s); }
};
`;

/** Compute the virtual-SR browser bundle as a data-URL module (injected per scan). */
let SR_DATA_URL: string | null = null;
function srDataUrl(): string | null {
  if (SR_DATA_URL) return SR_DATA_URL;
  try {
    const bundlePath = require.resolve("@guidepup/virtual-screen-reader/browser.js");
    const code = readFileSync(bundlePath, "utf8");
    SR_DATA_URL = "data:text/javascript;base64," + Buffer.from(code).toString("base64");
    return SR_DATA_URL;
  } catch {
    return null;
  }
}

export interface LayerBInput {
  html?: string;
  url?: string;
}
export type NavWait = "load" | "domcontentloaded" | "networkidle" | "commit";
export interface LayerBOptions {
  browser?: Browser;
  /** Navigation wait condition (default "load"; use "domcontentloaded" for heavy real pages). */
  navWaitUntil?: NavWait;
}

interface RawB {
  wcag: string;
  selector: string;
  message: string;
  detail?: Record<string, unknown>;
}

async function injectHelpers(page: Page): Promise<void> {
  // Inject the window.__b helpers via page.evaluate (CDP Runtime.evaluate), NOT addScriptTag.
  // A <script> tag is blocked by a strict Content-Security-Policy (script-src), which previously
  // made Layer B unmeasurable on CSP-locked real sites; CDP evaluation is exempt from page CSP,
  // so the deterministic checks now run there too. HELPERS is a single `window.__b = {…}`
  // assignment, so the IIFE wrap is behaviour-identical (verified byte-identical on the corpus).
  await page.evaluate(`(() => { ${HELPERS} })()`);
}

/**
 * Capture the virtual screen-reader spoken transcript (announcement evidence +
 * cross-check). NOTE: this does NOT drive which Layer-B findings fire — those come
 * from the deterministic CDP/DOM checks. If the SR fails to engage we WARN loudly
 * (a silent fallback previously masked the SR never running) and fall back to the
 * deterministic-only path; the test suite asserts the SR is actually engaged so this
 * cannot regress unnoticed.
 */
async function gatherSpokenLog(page: Page): Promise<string[] | null> {
  const dataUrl = srDataUrl();
  if (!dataUrl) {
    console.warn("[layerB] virtual-SR bundle not resolvable — falling back to CDP/DOM only");
    return null;
  }
  try {
    await page.addScriptTag({
      type: "module",
      content: `import { virtual } from "${dataUrl}"; window.__vsr = virtual; window.__vsrReady = true;`,
    });
    await page.waitForFunction("window.__vsrReady === true", { timeout: 15000 });
    return await page.evaluate(async () => {
      const v = (window as unknown as { __vsr: any }).__vsr;
      await v.start({ container: document.body });
      for (let i = 0; i < 120; i++) {
        const before = await v.lastSpokenPhrase();
        await v.next();
        const after = await v.lastSpokenPhrase();
        if (i > 2 && before === after) break;
      }
      const log = (await v.spokenPhraseLog()) as string[];
      await v.stop();
      return log;
    });
  } catch (err) {
    console.warn("[layerB] virtual-SR failed to engage — falling back to CDP/DOM only:", (err as Error).message);
    return null;
  }
}

/** CROSS-CHECK / FALLBACK: pull the CDP accessibility tree (best-effort). */
async function gatherAxTree(client: CDPSession): Promise<number> {
  try {
    await client.send("Accessibility.enable");
    const res = (await client.send("Accessibility.getFullAXTree")) as { nodes: unknown[] };
    return res.nodes.length;
  } catch {
    return 0;
  }
}

async function keyboardListeners(client: CDPSession, selector: string): Promise<string[]> {
  try {
    const { result } = (await client.send("Runtime.evaluate", {
      expression: `document.querySelector(${JSON.stringify(selector)})`,
    })) as { result: { objectId?: string } };
    if (!result.objectId) return [];
    const { listeners } = (await client.send("DOMDebugger.getEventListeners", {
      objectId: result.objectId,
    })) as { listeners: { type: string }[] };
    return listeners.map((l) => l.type);
  } catch {
    return [];
  }
}

// ---- deterministic checks -------------------------------------------------

async function checkHeadingOutline(page: Page): Promise<RawB[]> {
  return page.evaluate(() => {
    const out: RawB[] = [];
    const hs = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6,[role=heading]")].filter((e) =>
      window.__b.isVisible(e),
    );
    let prev = 0;
    for (const h of hs) {
      const al = h.getAttribute("aria-level");
      const level = al ? parseInt(al, 10) : parseInt(h.tagName.replace("H", ""), 10);
      if (!Number.isFinite(level)) continue;
      if (prev > 0 && level > prev + 1) {
        out.push({
          wcag: "1.3.1",
          selector: window.__b.cssPath(h),
          message: `Heading outline skips a level: <h${prev}> is followed by <h${level}> (levels ${prev + 1}..${level - 1} are skipped), so screen-reader heading navigation is broken.`,
          detail: { from: prev, to: level },
        });
      }
      prev = level;
    }
    return out;
  });
}

async function checkSkipLinks(page: Page): Promise<RawB[]> {
  return page.evaluate(() => {
    const out: RawB[] = [];
    const links = [...document.querySelectorAll('a[href^="#"]')] as HTMLAnchorElement[];
    for (const a of links) {
      const href = a.getAttribute("href") || "";
      if (href.length <= 1) continue; // bare "#"
      const id = decodeURIComponent(href.slice(1));
      const target = document.getElementById(id) || document.querySelector(`[name="${CSS.escape(id)}"]`);
      if (!target) {
        out.push({
          wcag: "2.4.1",
          selector: window.__b.cssPath(a),
          message: `In-page/skip link points to "${href}" but no element with that id exists, so activating it does not move focus (bypass fails).`,
          detail: { href },
        });
      }
    }
    return out;
  });
}

async function checkTabOrder(page: Page): Promise<RawB[]> {
  const focusables = await page.$$eval(
    "a[href],button,input,select,textarea,[tabindex]",
    (els) =>
      els
        .filter((e) => {
          if (!window.__b.isVisible(e)) return false;
          const ti = e.getAttribute("tabindex");
          if (ti !== null && parseInt(ti, 10) < 0) return false;
          if ((e as HTMLButtonElement).disabled) return false;
          return true;
        })
        .map((e) => window.__b.cssPath(e)),
  );
  if (focusables.length < 2) return [];

  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur?.();
    document.body.setAttribute("tabindex", "-1");
    document.body.focus();
  });

  const tabSeq: string[] = [];
  const maxPress = focusables.length * 2 + 4;
  for (let i = 0; i < maxPress; i++) {
    await page.keyboard.press("Tab");
    const p = await page.evaluate(() => window.__b.cssPath(document.activeElement as Element));
    // Chromium parks focus on <body>/document between the positive-tabindex group
    // and the auto group — skip those blips instead of stopping.
    if (!p || p === "body") continue;
    if (focusables.includes(p) && !tabSeq.includes(p)) tabSeq.push(p);
    if (tabSeq.length >= focusables.length) break;
  }
  await page.evaluate(() => document.body.removeAttribute("tabindex"));

  const domCommon = focusables.filter((f) => tabSeq.includes(f));
  const tabCommon = tabSeq.filter((t) => focusables.includes(t));
  if (JSON.stringify(domCommon) !== JSON.stringify(tabCommon)) {
    return [
      {
        wcag: "2.4.3",
        selector: "html > body",
        message: `Keyboard focus order does not follow DOM/reading order (likely positive tabindex). Tab order: ${tabCommon.join(", ")}. DOM order: ${domCommon.join(", ")}.`,
        detail: { tabOrder: tabCommon, domOrder: domCommon },
      },
    ];
  }
  return [];
}

async function checkVisualOrder(page: Page): Promise<RawB[]> {
  return page.evaluate(() => {
    const out: RawB[] = [];
    const containers = [...document.querySelectorAll<HTMLElement>("*")].filter((el) => {
      const st = getComputedStyle(el);
      return /flex|grid/.test(st.display) && el.children.length > 1;
    });
    for (const c of containers) {
      const kids = [...c.children].filter((k) => window.__b.isVisible(k));
      if (kids.length < 2) continue;
      // Scope to CSS-`order`-driven reordering (precise, avoids false positives).
      const usesOrder = kids.some((k) => getComputedStyle(k).order !== "0");
      if (!usesOrder) continue;
      const withRect = kids.map((k, i) => ({ i, r: k.getBoundingClientRect() }));
      const rowH = Math.min(...withRect.map((w) => w.r.height)) || 1;
      const visual = [...withRect].sort((a, b) =>
        Math.abs(a.r.top - b.r.top) > rowH * 0.5 ? a.r.top - b.r.top : a.r.left - b.r.left,
      );
      const domSeq = withRect.map((w) => w.i).join(",");
      const visSeq = visual.map((w) => w.i).join(",");
      if (domSeq !== visSeq) {
        out.push({
          wcag: "1.3.2",
          selector: window.__b.cssPath(c),
          message: `Visual order differs from DOM/reading order: children are shown in a different sequence (via CSS 'order') than a screen reader reads them, distorting meaning.`,
          detail: { domOrder: domSeq, visualOrder: visSeq },
        });
      }
    }
    return out;
  });
}

async function checkLiveRegions(page: Page): Promise<RawB[]> {
  await page.evaluate(() => {
    (window as unknown as { __mut: string[] }).__mut = [];
    const record = (target: Node | null) => {
      let el: Element | null =
        target && target.nodeType === 1 ? (target as Element) : (target?.parentElement ?? null);
      if (!el) return;
      const live = el.closest('[aria-live],[role="status"],[role="alert"],[role="log"],output');
      if (!live) {
        const path = window.__b.cssPath(el);
        const arr = (window as unknown as { __mut: string[] }).__mut;
        if (path && !arr.includes(path)) arr.push(path);
      }
    };
    const obs = new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type === "childList") {
          m.addedNodes.forEach((n) => {
            if ((n.textContent || "").trim()) record(m.target);
          });
        } else if (m.type === "characterData") {
          record(m.target);
        }
      }
    });
    obs.observe(document.body, { subtree: true, childList: true, characterData: true });
  });

  const buttons = await page.$$eval("button", (els) =>
    els
      .filter((b) => window.__b.isVisible(b) && (b.getAttribute("type") || "button") !== "submit")
      .map((b) => window.__b.cssPath(b)),
  );
  for (const sel of buttons) {
    try {
      await page.click(sel, { timeout: 1000 });
      await page.evaluate(() => new Promise((r) => setTimeout(r, 0)));
    } catch {
      /* ignore */
    }
  }

  const mutated = await page.evaluate(() => (window as unknown as { __mut: string[] }).__mut);
  return mutated.map((sel) => ({
    wcag: "4.1.3",
    selector: sel,
    message: `Content updated dynamically inside an element with no live region (aria-live / role=status), so screen-reader users are not notified of the change.`,
  }));
}

async function checkDialogTraps(page: Page): Promise<RawB[]> {
  const out: RawB[] = [];
  const dialogs = await page.$$eval("[role=dialog],[role=alertdialog],dialog", (els) =>
    els.map((e) => window.__b.cssPath(e)),
  );

  for (const dsel of dialogs) {
    let visible = await page.evaluate((s) => {
      const e = document.querySelector(s);
      return e ? window.__b.isVisible(e) : false;
    }, dsel);

    if (!visible) {
      const triggers = await page.$$eval(
        "button",
        (els, ds) =>
          els
            .filter((b) => window.__b.isVisible(b) && !b.closest(ds as string))
            .map((b) => window.__b.cssPath(b)),
        dsel,
      );
      for (const t of triggers) {
        try {
          await page.click(t, { timeout: 1000 });
        } catch {
          continue;
        }
        visible = await page.evaluate((s) => {
          const e = document.querySelector(s);
          return e ? window.__b.isVisible(e) : false;
        }, dsel);
        if (visible) break;
      }
    }
    if (!visible) continue;

    const inner = await page.evaluate((s) => {
      const d = document.querySelector(s);
      if (!d) return [] as string[];
      return [...d.querySelectorAll("a[href],button,input,select,textarea,[tabindex]")]
        .filter((e) => {
          const ti = e.getAttribute("tabindex");
          return window.__b.isVisible(e) && !(ti !== null && parseInt(ti, 10) < 0);
        })
        .map((e) => window.__b.cssPath(e));
    }, dsel);
    if (inner.length === 0) continue;

    await page.evaluate((s) => (document.querySelector(s) as HTMLElement | null)?.focus(), inner[0]!);

    let escaped = false;
    for (let i = 0; i < inner.length + 3; i++) {
      await page.keyboard.press("Tab");
      const inside = await page.evaluate((s) => {
        const d = document.querySelector(s);
        return d ? d.contains(document.activeElement) : true;
      }, dsel);
      if (!inside) {
        escaped = true;
        break;
      }
    }

    await page.keyboard.press("Escape");
    const closedByEsc = await page.evaluate((s) => {
      const e = document.querySelector(s);
      return e ? !window.__b.isVisible(e) : true;
    }, dsel);

    const hasOperableClose = await page.evaluate((s) => {
      const d = document.querySelector(s);
      if (!d) return false;
      const cand = [...d.querySelectorAll('button,a[href],[role="button"]')].filter((e) =>
        window.__b.isVisible(e),
      );
      return cand.some((e) => {
        const n = (window.__b.name(e) || "").toLowerCase();
        const ti = e.getAttribute("tabindex");
        const focusable = e.matches("button,a[href]") || (ti !== null && parseInt(ti, 10) >= 0);
        return focusable && /close|dismiss|cancel|done/.test(n);
      });
    }, dsel);

    if (!escaped && !closedByEsc && !hasOperableClose) {
      out.push({
        wcag: "2.1.2",
        selector: dsel,
        message: `Keyboard focus is trapped in the dialog: Tab does not move focus out, Escape does not dismiss it, and there is no keyboard-operable close control.`,
        detail: { escaped, closedByEsc, hasOperableClose },
      });
    }
  }
  return out;
}

async function checkControls(page: Page, client: CDPSession): Promise<RawB[]> {
  const candidates = await page.$$eval(
    "[onclick],[role=button],[role=link],[role=menuitem],[role=menuitemcheckbox],[role=tab],[role=switch],[role=checkbox],[role=radio]",
    (els) =>
      els
        .filter((e) => !e.matches("button,a[href],input,select,textarea,summary"))
        .filter((e) => window.__b.isVisible(e))
        .map((e) => {
          const ti = e.getAttribute("tabindex");
          return {
            path: window.__b.cssPath(e),
            focusable: ti !== null && parseInt(ti, 10) >= 0,
            name: window.__b.name(e),
            meaningful: window.__b.isMeaningfulName(window.__b.name(e)),
            role: e.getAttribute("role") || "",
          };
        }),
  );

  const out: RawB[] = [];
  for (const c of candidates) {
    const keys = await keyboardListeners(client, c.path);
    const hasKeyHandler = keys.some((k) => k === "keydown" || k === "keyup" || k === "keypress");
    if (!c.focusable) {
      out.push({
        wcag: "2.1.1",
        selector: c.path,
        message: `Element behaves as a control${c.role ? ` (role="${c.role}")` : " (has a click handler)"} but is not keyboard-focusable (no tabindex), so keyboard/screen-reader users cannot reach it.`,
        detail: { role: c.role, listeners: keys },
      });
    } else if (!hasKeyHandler) {
      out.push({
        wcag: "2.1.1",
        selector: c.path,
        message: `Custom control${c.role ? ` (role="${c.role}")` : ""} is focusable but has no keyboard activation handler (click only), so Enter/Space do nothing.`,
        detail: { role: c.role, listeners: keys },
      });
    }
    if (!c.meaningful) {
      out.push({
        wcag: "4.1.2",
        selector: c.path,
        message: `Control has no meaningful accessible name (announced as "${c.name || "(empty)"}"), so a screen-reader user cannot tell what it does.`,
        detail: { name: c.name },
      });
    }
  }
  return out;
}

// ---- orchestration --------------------------------------------------------

function toFindings(raw: RawB[], spoken: string[] | null): Finding[] {
  const groups = new Map<string, RawB>();
  for (const r of raw) {
    const key = `${r.selector}|${r.wcag}`;
    if (!groups.has(key)) groups.set(key, r);
  }
  const findings: Finding[] = [];
  for (const [, r] of groups) {
    findings.push({
      id: `B:${r.wcag}:${r.selector}`,
      layer: "B",
      type: "behavioral",
      source: "virtual-sr+cdp",
      selector: r.selector,
      wcag: r.wcag,
      message: r.message,
      detail: { ...r.detail, ...(spoken ? { srReadingOrderSample: spoken.slice(0, 16) } : {}) },
    });
  }
  return findings.sort(
    (a, b) =>
      (a.selector ?? "").localeCompare(b.selector ?? "") ||
      (a.wcag ?? "").localeCompare(b.wcag ?? "") ||
      a.id.localeCompare(b.id),
  );
}

export async function runLayerB(input: LayerBInput, opts: LayerBOptions = {}): Promise<Finding[]> {
  let url = input.url;
  let cleanup: (() => void) | undefined;
  if (!url) {
    if (input.html === undefined) throw new Error("runLayerB requires `html` or `url`");
    const dir = mkdtempSync(join(tmpdir(), "a11yforge-b-"));
    const file = join(dir, "page.html");
    writeFileSync(file, input.html, "utf8");
    url = pathToFileURL(file).href;
    cleanup = () => rmSync(dir, { recursive: true, force: true });
  }

  const browser = opts.browser ?? (await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] }));
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const client = await context.newCDPSession(page);
  const nav = opts.navWaitUntil ?? "load";

  try {
    const raw: RawB[] = [];

    // Pass 1 — pristine page: static/order checks. The virtual SR is captured on an
    // ISOLATED page (below) because starting it injects a live-region announcer node into
    // the DOM, which would otherwise pollute these checks and the verify-loop's re-scans.
    await page.goto(url, { waitUntil: nav });
    await injectHelpers(page);
    await gatherAxTree(client); // cross-check pull (corroboration; count available for logs)
    raw.push(...(await safe(checkHeadingOutline(page))));
    raw.push(...(await safe(checkSkipLinks(page))));
    raw.push(...(await safe(checkTabOrder(page))));
    raw.push(...(await safe(checkVisualOrder(page))));

    // Virtual screen-reader transcript (evidence + cross-check), isolated from the checks.
    let spoken: string[] | null = null;
    try {
      const srPage = await context.newPage();
      await srPage.goto(url, { waitUntil: nav });
      spoken = await gatherSpokenLog(srPage);
      await srPage.close();
    } catch {
      spoken = null;
    }

    // Pass 2 — fresh load: live-region interaction (clicks buttons).
    await page.goto(url, { waitUntil: nav });
    await injectHelpers(page);
    raw.push(...(await safe(checkLiveRegions(page))));

    // Pass 3 — fresh load: dialog trap (opens dialogs, leaves them open), then
    // control operability/name on the resulting DOM.
    await page.goto(url, { waitUntil: nav });
    await injectHelpers(page);
    raw.push(...(await safe(checkDialogTraps(page))));
    raw.push(...(await safe(checkControls(page, client))));

    return toFindings(raw, spoken);
  } finally {
    await context.close();
    if (!opts.browser) await browser.close();
    cleanup?.();
  }
}

async function safe(p: Promise<RawB[]>): Promise<RawB[]> {
  try {
    return await p;
  } catch (err) {
    console.warn("[layerB] check failed:", (err as Error).message);
    return [];
  }
}

declare global {
  interface Window {
    __b: {
      cssPath(el: Element | null): string;
      isVisible(el: Element | null): boolean;
      name(el: Element): string;
      isMeaningfulName(s: string): boolean;
    };
  }
}
