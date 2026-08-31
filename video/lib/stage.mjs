/**
 * Shared stage for the A11yForge demo video.
 *
 * One visual identity for every segment: a framed browser window, lower-third captions, a
 * synthetic eased cursor, and a presenter's annotation layer (hand-drawn circles, arrows,
 * underline swipes, spotlight, zoom-to-region, step badges). The target page is embedded in an
 * iframe so the chrome can be drawn around it WITHOUT modifying the page — corpus pages are
 * read-only, and interaction inside the frame is real (real focus rings, real JS, real scrolling).
 *
 * HONESTY RULE: every string rendered here must be real captured output or a real file path.
 * Cursor, captions, annotations, zoom and transitions are presentation of real events. Nothing
 * on screen may assert a number or a string we did not actually produce. Annotations point AT the
 * artifact; they never restate it.
 */

export const W = 1920;
export const H = 1080;

/** One restrained palette + one font stack for the whole video. */
export const THEME = {
  bg: "#0b1220",
  bgGlow: "#12203a",
  accent: "#4da3ff",
  warn: "#ffca6b",
  bad: "#ff8a80",
  good: "#79e2a8",
  ink: "#eaf1fb",
  dim: "rgba(6,10,18,.62)",
  plate: "rgba(8,13,22,.90)",
  font: `"Segoe UI", -apple-system, Roboto, Arial, sans-serif`,
  mono: `"Cascadia Mono", "Cascadia Code", Consolas, "Courier New", monospace`,
  // Single-quoted variants for use INSIDE double-quoted style="..." attributes. Interpolating the
  // double-quoted stacks there terminates the attribute, and the whole declaration is dropped —
  // which silently renders every `font:` shorthand at the inherited 16px.
  fontA: `'Segoe UI', -apple-system, Roboto, Arial, sans-serif`,
  monoA: `'Cascadia Mono', 'Cascadia Code', Consolas, 'Courier New', monospace`,
};

/** Height of the window title bar. A real maximised window has one; it is not decoration. */
export const BAR_H = 40;

/**
 * The stage document. `chromeLabel` is shown in the title bar and MUST be the real path, URL or
 * working directory being viewed. `inner` is raw HTML placed inside the window (used for
 * terminal/text shots); for page shots pass `src` instead and an iframe is used.
 *
 * TWO PRESENTATIONS, and the distinction is deliberate:
 *
 *   fullFrame:true  — the window fills all 1920x1080 with a real title bar and nothing around it.
 *                     This is for RENDERINGS OF REAL ARTIFACTS (the terminal, report.html, a
 *                     trajectory file, DETERMINISM.md). A real screen recording is either a
 *                     maximised window or a window over a desktop; a card floating on a branded
 *                     field is the single biggest tell that a frame was designed rather than
 *                     captured, so artifact shots don't get one.
 *   fullFrame:false — the branded backdrop, for OUR OWN GRAPHICS (title card, end card, the
 *                     three-layer funnel, the architecture diagram). Those genuinely are diagrams,
 *                     and dressing them as recordings would be the opposite mistake.
 *
 * The chrome is Windows, not macOS: this was recorded on Windows, and macOS traffic lights on a
 * Windows capture are a small lie of the same kind.
 */
export function stageHtml({ chromeLabel = "", src = "", inner = "", frame = true, dark = false,
                            innerW = 1600, innerH = 680, fullFrame = false }) {
  if (fullFrame) { innerW = W; innerH = H - (frame ? BAR_H : 0); }
  const body = src
    ? `<iframe id="stageFrame" src="${src}" width="${innerW}" height="${innerH}" frameborder="0"></iframe>`
    : `<div id="stageInner" style="width:${innerW}px;height:${innerH}px;overflow:hidden">${inner}</div>`;
  const winTop = fullFrame ? 0 : Math.round((H - innerH) / 2 + 6);
  const winLeft = fullFrame ? 0 : (W - innerW) / 2;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  *{box-sizing:border-box}
  html,body{margin:0;padding:0;width:${W}px;height:${H}px;overflow:hidden;
    background:${fullFrame ? "#0c1017" : `radial-gradient(1200px 700px at 50% 18%, ${THEME.bgGlow}, ${THEME.bg} 70%)`};
    font-family:${THEME.font};color:${THEME.ink};cursor:none}
  #zoom{position:absolute;inset:0;will-change:transform}
  #win{position:absolute;left:${winLeft}px;top:${winTop}px;width:${innerW}px;
    border-radius:${fullFrame || !frame ? 0 : 14}px;overflow:hidden;background:${dark ? "transparent" : "#fff"};
    box-shadow:${fullFrame || dark ? "none" : "0 36px 90px rgba(0,0,0,.60), 0 3px 0 rgba(255,255,255,.05) inset"}}
  /* Windows-style title bar: icon + title left, minimise/maximise/close right. */
  #bar{display:${frame ? "flex" : "none"};align-items:center;height:${BAR_H}px;padding:0 0 0 15px;
    background:#1f2329;border-bottom:1px solid #2b3037}
  #ico{width:14px;height:14px;border-radius:3px;background:${THEME.accent};margin-right:12px;flex:0 0 auto}
  #path{font:13px ${THEME.font};color:#c9d3e1;white-space:nowrap;overflow:hidden;
    text-overflow:ellipsis;flex:1 1 auto}
  #wbtn{display:flex;flex:0 0 auto}
  #wbtn i{width:46px;height:${BAR_H}px;display:flex;align-items:center;justify-content:center;
    font:400 12px ${THEME.font};font-style:normal;color:#c2ccd8}
  iframe,#stageInner{display:block;background:${dark ? "transparent" : "#fff"}}
  /* lower-third caption */
  #cap{position:absolute;left:96px;bottom:64px;max-width:${W - 300}px;padding:20px 28px;
    background:${THEME.plate};border-left:5px solid ${THEME.accent};border-radius:6px;
    font-size:31px;line-height:1.34;font-weight:600;letter-spacing:-.01em;
    opacity:0;transition:opacity .25s ease;backdrop-filter:blur(3px);z-index:70;
    box-shadow:0 18px 50px rgba(0,0,0,.5)}
  #cap .sub{display:block;margin-top:9px;font-size:21px;font-weight:400;color:#a9bdd8}
  /* dim + spotlight */
  #dim{position:absolute;inset:0;background:${THEME.dim};opacity:0;transition:opacity .4s ease;pointer-events:none;z-index:40}
  #spot{position:absolute;border:2.5px solid ${THEME.accent};border-radius:8px;opacity:0;
    transition:opacity .3s ease, left .5s ease, top .5s ease, width .5s ease, height .5s ease;
    box-shadow:0 0 0 9999px ${THEME.dim}, 0 0 26px rgba(77,163,255,.55);pointer-events:none;z-index:41}
  /* presenter annotation layer — drawn in screen space, above the (possibly zoomed) window */
  #ann{position:absolute;inset:0;pointer-events:none;z-index:55;overflow:visible}
  #chips{position:absolute;inset:0;pointer-events:none;z-index:56}
  .chip{position:absolute;width:46px;height:46px;border-radius:50%;background:${THEME.accent};
    color:#06101f;font:800 25px/46px ${THEME.mono};text-align:center;opacity:0;
    transform:scale(.55);transition:opacity .22s ease, transform .28s cubic-bezier(.2,1.5,.4,1);
    box-shadow:0 6px 20px rgba(0,0,0,.55)}
  /* synthetic cursor */
  #cur{position:absolute;left:-80px;top:-80px;width:26px;height:34px;pointer-events:none;z-index:60;
    filter:drop-shadow(0 3px 5px rgba(0,0,0,.55))}
  #ripple{position:absolute;width:12px;height:12px;border-radius:50%;border:2.5px solid ${THEME.accent};
    opacity:0;pointer-events:none;z-index:59}
  /* counter badge (Tab demo) — kept clear of the window edge, never straddling it */
  #badge{position:absolute;right:110px;top:66px;padding:16px 24px;background:${THEME.plate};
    border-radius:10px;font:600 27px/1.15 ${THEME.font};opacity:0;transition:opacity .25s ease;
    border:1px solid #2b3a52;z-index:57;box-shadow:0 14px 40px rgba(0,0,0,.5)}
  #badge b{color:${THEME.accent};font:700 40px ${THEME.mono}}
  </style></head><body data-fullframe="${fullFrame ? 1 : 0}">
  <div id="zoom">
    <div id="win">
      <div id="bar"><span id="ico"></span><span id="path">${chromeLabel}</span>
        <span id="wbtn"><i>&#9472;</i><i>&#9723;</i><i>&#10005;</i></span></div>
      ${body}
    </div>
  </div>
  <div id="dim"></div><div id="spot"></div>
  <svg id="ann" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"></svg>
  <div id="chips"></div>
  <div id="cap"></div><div id="badge"></div>
  <svg id="cur" viewBox="0 0 26 34"><path d="M2 1 L2 26 L8.5 20 L12.5 31.5 L17 29.5 L13 18.5 L22 18 Z"
    fill="#fff" stroke="#0b1220" stroke-width="1.6" stroke-linejoin="round"/></svg>
  <div id="ripple"></div>
  </body></html>`;
}

/** Page-side helpers, installed once per stage. */
export const HELPERS = `
window.__v = {
  cur: document.getElementById('cur'),
  ripple: document.getElementById('ripple'),
  cap: document.getElementById('cap'),
  dim: document.getElementById('dim'),
  spot: document.getElementById('spot'),
  badge: document.getElementById('badge'),
  zoom: document.getElementById('zoom'),
  ann: document.getElementById('ann'),
  chips: document.getElementById('chips'),
  pos: { x: -80, y: -80 },
  ACC: '${THEME.accent}',
  ease(t) { return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2; },

  /* ── cursor ─────────────────────────────────────────────────────────────── */
  setCursor(x, y) { this.pos = { x, y }; this.cur.style.left = x + 'px'; this.cur.style.top = y + 'px'; },
  moveCursor(x, y, ms) {
    return new Promise((res) => {
      const s = { ...this.pos }, t0 = performance.now();
      const step = (now) => {
        const p = Math.min(1, (now - t0) / ms), e = this.ease(p);
        const wob = p > 0.86 ? Math.sin((p - 0.86) * 34) * 1.1 * (1 - p) * 7 : 0;
        this.setCursor(s.x + (x - s.x) * e + wob, s.y + (y - s.y) * e);
        p < 1 ? requestAnimationFrame(step) : res();
      };
      requestAnimationFrame(step);
    });
  },
  /** Ease the pointer off-frame. A drifting pointer during a keyboard-only demo is incoherent. */
  parkCursor(ms) { return this.moveCursor(${W} + 90, ${H} + 90, ms || 700); },
  clickFx() {
    const r = this.ripple, { x, y } = this.pos;
    r.style.left = (x - 4) + 'px'; r.style.top = (y - 4) + 'px';
    r.style.transition = 'none'; r.style.width = '12px'; r.style.height = '12px'; r.style.opacity = '.95';
    requestAnimationFrame(() => {
      r.style.transition = 'all .45s ease-out';
      r.style.left = (x - 26) + 'px'; r.style.top = (y - 26) + 'px';
      r.style.width = '56px'; r.style.height = '56px'; r.style.opacity = '0';
    });
  },

  /* ── captions ───────────────────────────────────────────────────────────── */
  caption(html, sub) {
    this.cap.innerHTML = html + (sub ? '<span class="sub">' + sub + '</span>' : '');
    this.cap.style.opacity = '1';
  },
  hideCaption() { this.cap.style.opacity = '0'; },
  showBadge(html) { this.badge.innerHTML = html; this.badge.style.opacity = '1'; },
  hideBadge() { this.badge.style.opacity = '0'; },

  /* ── dim / spotlight ────────────────────────────────────────────────────── */
  dimOn() { this.dim.style.opacity = '1'; },
  dimOff() { this.dim.style.opacity = '0'; },
  spotlight(x, y, w, h) {
    const s = this.spot;
    s.style.left = x + 'px'; s.style.top = y + 'px';
    s.style.width = w + 'px'; s.style.height = h + 'px'; s.style.opacity = '1';
  },
  spotOff() { this.spot.style.opacity = '0'; },

  /* ── annotation layer ───────────────────────────────────────────────────────
     Dash-reveal drawing, with irregularity on purpose: a geometrically perfect
     ellipse reads as a computer drawing it, a slightly wobbly one with a small
     overshoot at the close reads as a human hand. */
  _svg(tag, attrs) {
    const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  },
  _reveal(el, ms, delay) {
    const len = el.getTotalLength();
    el.style.strokeDasharray = len;
    el.style.strokeDashoffset = len;
    el.style.transition = 'stroke-dashoffset ' + ms + 'ms cubic-bezier(.34,.72,.32,1) ' + (delay || 0) + 'ms';
    requestAnimationFrame(() => { el.style.strokeDashoffset = '0'; });
  },
  /** Hand-drawn ellipse around a region. Returns after the stroke has been kicked off. */
  circle(cx, cy, rx, ry, ms, color) {
    ms = ms || 480;
    const p1 = Math.random() * 6.283, p2 = Math.random() * 6.283;
    const tilt = (Math.random() - 0.5) * 0.10;
    const a0 = -0.38, a1 = Math.PI * 2 + 0.30; // overshoot past the close
    const pts = [];
    for (let i = 0; i <= 84; i++) {
      const a = a0 + (a1 - a0) * (i / 84);
      const w = 1 + 0.024 * Math.sin(a * 3 + p1) + 0.015 * Math.sin(a * 5 + p2);
      const x0 = rx * w * Math.cos(a), y0 = ry * w * Math.sin(a);
      pts.push([cx + x0 * Math.cos(tilt) - y0 * Math.sin(tilt),
                cy + x0 * Math.sin(tilt) + y0 * Math.cos(tilt)]);
    }
    const d = 'M' + pts.map((p) => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L');
    const el = this._svg('path', { d: d, fill: 'none', stroke: color || this.ACC,
      'stroke-width': 3.6, 'stroke-linecap': 'round', opacity: 0.96 });
    this.ann.appendChild(el);
    this._reveal(el, ms);
    return ms;
  },
  /** Drawn arrow, slightly bowed, arrowhead appearing once the shaft completes. */
  arrow(x1, y1, x2, y2, ms, color) {
    ms = ms || 420;
    const c = color || this.ACC;
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
    const bow = 0.085 * len * Math.min(1, len / 320) * (Math.random() < 0.5 ? -1 : 1);
    const cxp = mx + (-dy / len) * bow, cyp = my + (dx / len) * bow;
    const shaft = this._svg('path', { d: 'M' + x1 + ' ' + y1 + ' Q' + cxp + ' ' + cyp + ' ' + x2 + ' ' + y2,
      fill: 'none', stroke: c, 'stroke-width': 4, 'stroke-linecap': 'round', opacity: 0.96 });
    this.ann.appendChild(shaft);
    this._reveal(shaft, ms);
    // arrowhead angle follows the curve's final tangent
    const ang = Math.atan2(y2 - cyp, x2 - cxp), s = 22;
    const head = this._svg('path', {
      d: 'M' + (x2 - s * Math.cos(ang - 0.42)) + ' ' + (y2 - s * Math.sin(ang - 0.42)) +
         ' L' + x2 + ' ' + y2 +
         ' L' + (x2 - s * Math.cos(ang + 0.42)) + ' ' + (y2 - s * Math.sin(ang + 0.42)),
      fill: 'none', stroke: c, 'stroke-width': 4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    head.style.opacity = '0';
    head.style.transition = 'opacity 140ms ease ' + (ms - 40) + 'ms';
    this.ann.appendChild(head);
    requestAnimationFrame(() => { head.style.opacity = '0.96'; });
    return ms + 140;
  },
  /** Quick left-to-right underline swipe beneath a line of text. */
  underline(x, y, w, ms, color) {
    ms = ms || 340;
    const pts = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      pts.push([x + w * t, y + Math.sin(t * 5.5 + 1) * 3.4 + Math.sin(t * 13) * 1.3]);
    }
    const el = this._svg('path', { d: 'M' + pts.map((p) => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L'),
      fill: 'none', stroke: color || this.ACC, 'stroke-width': 4.2, 'stroke-linecap': 'round', opacity: 0.94 });
    this.ann.appendChild(el);
    this._reveal(el, ms);
    return ms;
  },
  /** Numbered chip, for anything with an order. */
  chip(n, x, y) {
    const d = document.createElement('div');
    d.className = 'chip'; d.textContent = n;
    d.style.left = (x - 23) + 'px'; d.style.top = (y - 23) + 'px';
    this.chips.appendChild(d);
    requestAnimationFrame(() => { d.style.opacity = '1'; d.style.transform = 'scale(1)'; });
  },
  clearAnn(fade) {
    const els = [...this.ann.children, ...this.chips.children];
    els.forEach((e) => { e.style.transition = 'opacity 260ms ease'; e.style.opacity = '0'; });
    setTimeout(() => { this.ann.innerHTML = ''; this.chips.innerHTML = ''; }, fade === false ? 0 : 300);
  },

  /* ── window fitting ─────────────────────────────────────────────────────── */
  /** Shrink a text-panel window to the height its content actually occupies, and re-centre it.
      A two-row card floating in a full-height window reads as an oversized window rather than a
      recording, and it holds an empty frame for as long as the shot runs. Iframe (page) shots are
      left alone — there the page's own height IS the content. Returns the fitted inner height. */
  fitWindow(pad) {
    // Full-frame shots WANT the whole frame — shrinking one would reintroduce the floating card.
    if (document.body.dataset.fullframe === '1') return 0;
    const inner = document.getElementById('stageInner');
    const kid = inner && inner.firstElementChild;
    if (!kid) return 0;
    const prev = kid.style.height;
    kid.style.height = 'auto';
    const h = Math.ceil(kid.getBoundingClientRect().height) + (pad || 0);
    if (!h || h >= inner.offsetHeight) { kid.style.height = prev; return inner.offsetHeight; }
    inner.style.height = h + 'px';
    kid.style.height = h + 'px';
    const bar = document.getElementById('bar');
    const barH = bar ? bar.offsetHeight : 0;
    document.getElementById('win').style.top = Math.round((${H} - (h + barH)) / 2 + 6) + 'px';
    return h;
  },

  /* ── zoom ───────────────────────────────────────────────────────────────── */
  zoomTo(scale, ms) {
    this.zoom.style.transformOrigin = '50% 46%';
    this.zoom.style.transition = 'transform ' + ms + 'ms linear';
    this.zoom.style.transform = 'scale(' + scale + ')';
  },
  /** Ease so the given screen rect fills ~fill of the frame. A judge cannot read a full-page
      table at 1080p; zooming to the region is what a presenter does. */
  zoomRegion(x, y, w, h, ms, fill) {
    ms = ms || 700; fill = fill || 0.72;
    const sc = Math.max(1, Math.min(Math.min((${W} * fill) / w, (${H} * fill) / h), 2.8));
    // Translating the window without meaningfully scaling it just slides content off-frame and
    // reads as a mistake. If the region can't earn a real zoom, don't move at all.
    if (sc < 1.12) { this.zoomReset(ms); return 1; }
    const cx = x + w / 2, cy = y + h / 2;
    this.zoom.style.transformOrigin = '0 0';
    this.zoom.style.transition = 'transform ' + ms + 'ms cubic-bezier(.32,.72,.24,1)';
    this.zoom.style.transform = 'translate(' + (${W} / 2 - sc * cx) + 'px,' + (${H} / 2 - sc * cy) + 'px) scale(' + sc + ')';
    return sc;
  },
  zoomReset(ms) {
    this.zoom.style.transition = 'transform ' + (ms || 620) + 'ms cubic-bezier(.32,.72,.24,1)';
    this.zoom.style.transform = 'translate(0px,0px) scale(1)';
  },
};
`;

/** Human-ish pause. Never the same twice. */
export const beat = (ms, jitter = 120) =>
  new Promise((r) => setTimeout(r, ms + Math.round((Math.random() - 0.5) * 2 * jitter)));

/**
 * Terminal panel, styled as a maximised Windows terminal because that is where the command was
 * actually run. `text` MUST be real captured stdout — this renders output, it never authors it.
 */
export function terminalPanel(text, { w = W, h = H - BAR_H, size = 23 } = {}) {
  return `<div style="width:${w}px;height:${h}px;background:#0c0c0c;padding:0;font-family:${THEME.monoA}">
    <pre id="term" style="margin:0;padding:26px 34px;color:#cccccc;font-size:${size}px;line-height:1.48;
      white-space:pre-wrap;word-break:break-word;height:${h}px;overflow:hidden"></pre></div>`;
}

/** Unified-diff panel for narration lines. Each entry is {op:'-'|'+'|' ', text}. */
export function diffPanel(rows, { w = W, h = H - BAR_H, heading = "" } = {}) {
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const color = { "-": "#ff8a80", "+": "#79e2a8", " ": "#9db2ce" };
  const bg = { "-": "rgba(255,95,87,.10)", "+": "rgba(40,200,120,.10)", " ": "transparent" };
  const body = rows.map((r, i) =>
    `<div class="dl" data-i="${i}" style="padding:9px 18px;color:${color[r.op]};background:${bg[r.op]};
      border-radius:5px;opacity:0;transition:opacity .3s ease">${esc(r.op)} ${esc(r.text)}</div>`).join("");
  return `<div style="width:${w}px;height:${h}px;background:#0c1017;padding:30px 34px;
    font-family:${THEME.monoA};font-size:22px;line-height:1.5;color:#d7e3f4">
    ${heading ? `<div style="font-family:${THEME.fontA};font-size:24px;color:#8fa3c0;margin-bottom:20px">${heading}</div>` : ""}
    <div id="difflines">${body}</div></div>`;
}
