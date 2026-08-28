import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Generate the injected/ corpus bucket: clean, realistic templates each with ONE
 * fairly-fixable accessibility violation injected. These are NOT rigged to trip the
 * baseline — each violation has a straightforward correct fix — and they are the
 * primary source for clean true-fix / regression measurement. Every page is otherwise
 * WCAG-axe-clean (lang, title, sufficient contrast).
 */

const CSS =
  ":root{--ink:#161616;--muted:#454545;--brand:#0b4a8f;--line:#dcdce0}*{box-sizing:border-box}" +
  "body{margin:0;font:16px/1.55 system-ui,Segoe UI,Roboto,sans-serif;color:var(--ink);background:#fff}" +
  "a{color:var(--brand)}.site{display:flex;justify-content:space-between;padding:14px 22px;border-bottom:1px solid var(--line)}" +
  ".brand{font-weight:700;text-decoration:none;color:var(--ink)}nav a{margin-left:18px;text-decoration:none}" +
  "main{max-width:820px;margin:0 auto;padding:32px 22px}h1{font-size:28px;margin:0 0 12px}" +
  "label{display:block;font-weight:600;margin:12px 0 6px}input,select,textarea{width:100%;padding:10px;border:1px solid #b3b3ba;border-radius:8px;font-size:16px}" +
  "button{background:var(--brand);color:#fff;border:0;border-radius:8px;padding:11px 16px;font-size:16px;cursor:pointer}" +
  ".btn:focus-visible,a:focus-visible,button:focus-visible{outline:3px solid #ffbf47;outline-offset:2px}" +
  "figure{margin:20px 0}figure img{width:100%;max-width:420px;aspect-ratio:4/3;object-fit:cover;border-radius:10px;background:#eee}" +
  "figcaption{color:var(--muted);font-size:14px;margin-top:6px}";

function page(title: string, brand: string, body: string, extraHead = "", script = ""): string {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title><style>${CSS}</style>${extraHead}</head>
<body>
<header class="site"><a class="brand" href="/">${brand}</a><nav aria-label="Primary"><a href="/a">Home</a><a href="/b">More</a></nav></header>
<main>
${body}
</main>${script}
</body></html>
`;
}

interface Spec {
  slug: string;
  html: string;
  expectedUsable: string;
  violation: { id: string; wcag: string; type: "mechanical" | "behavioral" | "semantic"; selector: string; informative: boolean | null; layer: "A" | "B" | "C"; fix: string; notes: string };
}

const specs: Spec[] = [
  {
    slug: "inj-form-label",
    html: page("Newsletter — Signup", "Beacon", `<h1>Join the newsletter</h1>\n<form><input type="email" placeholder="Email address" autocomplete="email"><button type="button">Subscribe</button></form>`),
    expectedUsable: "The email field has a persistent programmatic label.",
    violation: { id: "missing-label", wcag: "4.1.2", type: "mechanical", selector: "form input", informative: null, layer: "A", fix: "Associate a <label> or add an accessible name.", notes: "Placeholder-only input; pa11y flags a missing name (Layer A)." },
  },
  {
    slug: "inj-skip-link",
    html: page("Docs — Guide", "Beacon", `<h1>Getting started</h1>\n<p>Read the guide below to set up your first project in minutes.</p>`, `<style>.skip{position:absolute;left:-9999px}.skip:focus{left:0}</style>`, ``).replace('<main>', '<a class="skip" href="#main-content">Skip to main content</a>\n<main id="content">'),
    expectedUsable: "The skip link moves focus to the main content.",
    violation: { id: "dead-skip-link", wcag: "2.4.1", type: "behavioral", selector: "a.skip", informative: null, layer: "B", fix: 'Point href at an existing id (#content) or set <main id="main-content">.', notes: "Skip link target does not exist (Layer B)." },
  },
  {
    slug: "inj-heading-skip",
    html: page("Handbook", "Beacon", `<h1>Team handbook</h1>\n<p>Welcome aboard.</p>\n<h3>Your first week</h3>\n<p>Meet the team and set up your tools.</p>`),
    expectedUsable: "Heading levels are sequential (h1 then h2).",
    violation: { id: "heading-skip", wcag: "1.3.1", type: "behavioral", selector: "main h3", informative: null, layer: "B", fix: "Change the h3 to h2 so no level is skipped.", notes: "h1 followed by h3 (Layer B heading outline)." },
  },
  {
    slug: "inj-positive-tabindex",
    html: page("Support — Contact", "Beacon", `<h1>Contact support</h1>\n<form><label for="n">Name</label><input id="n" tabindex="2"><label for="e">Email</label><input id="e" type="email" tabindex="1"><button type="submit" tabindex="3">Send</button></form>`),
    expectedUsable: "Tab order follows the visual/reading order of the form.",
    violation: { id: "positive-tabindex", wcag: "2.4.3", type: "behavioral", selector: "form", informative: null, layer: "B", fix: "Remove the positive tabindex attributes; rely on DOM order.", notes: "tabindex 2/1/3 scrambles focus order (Layer B)." },
  },
  {
    slug: "inj-live-region",
    html: page("Account — Settings", "Beacon", `<h1>Profile</h1>\n<form><label for="dn">Display name</label><input id="dn"><button id="save" type="button">Save</button></form>\n<div class="status" id="status" style="margin-top:12px;color:#0a5c2e;font-weight:600"></div>`, "", `<script>document.getElementById('save').addEventListener('click',()=>{document.getElementById('status').textContent='Saved!';});</script>`),
    expectedUsable: "The 'Saved!' confirmation is announced to screen readers.",
    violation: { id: "silent-status", wcag: "4.1.3", type: "behavioral", selector: "#status", informative: null, layer: "B", fix: 'Add role="status" / aria-live="polite" to the status container.', notes: "Dynamic confirmation in a non-live region (Layer B)." },
  },
  {
    slug: "inj-div-button",
    html: page("FAQ", "Beacon", `<h1>FAQ</h1>\n<div class="q" role="button" tabindex="0" aria-expanded="false" aria-controls="a1" onclick="document.getElementById('a1').hidden=!document.getElementById('a1').hidden">How do I upgrade?</div>\n<div id="a1" hidden>Open Billing and choose a plan.</div>`),
    expectedUsable: "The FAQ toggle works with Enter/Space, not just mouse.",
    violation: { id: "no-keyboard-activation", wcag: "2.1.1", type: "behavioral", selector: ".q", informative: null, layer: "B", fix: "Use a <button>, or add keydown handling for Enter/Space.", notes: "role=button focusable but click-only (Layer B)." },
  },
  {
    slug: "inj-icon-focus",
    html: page("Player", "Beacon", `<h1>Now playing</h1>\n<div class="row"><span>Track one</span> <div class="ib" role="button" aria-label="Play track one" onclick="this.textContent='||'">&#9654;</div></div>`),
    expectedUsable: "The play control is reachable and operable by keyboard.",
    violation: { id: "not-focusable", wcag: "2.1.1", type: "behavioral", selector: ".ib", informative: null, layer: "B", fix: "Use a <button> or add tabindex=0 plus Enter/Space handling.", notes: "role=button with a name but no tabindex (Layer B)." },
  },
  {
    slug: "inj-css-reorder",
    html: page("Steps", "Beacon", `<h1>Three steps</h1>\n<div style="display:flex;gap:16px"><div style="order:3">Step one: sign up</div><div style="order:1">Step two: connect</div><div style="order:2">Step three: launch</div></div>`),
    expectedUsable: "Visual step order matches the DOM/reading order.",
    violation: { id: "visual-order", wcag: "1.3.2", type: "behavioral", selector: "main div", informative: null, layer: "B", fix: "Order steps in the DOM; remove the CSS order overrides.", notes: "CSS order reverses the reading sequence (Layer B)." },
  },
  {
    slug: "inj-alt-generic-caption",
    html: page("Blog — Field notes", "Beacon", `<h1>Field notes</h1>\n<figure><img src="assets/dawn.jpg" alt="image"><figcaption>Sunrise over the ridge at base camp</figcaption></figure>\n<p>We broke camp before first light.</p>`),
    expectedUsable: "The image's alt is meaningful (or empty because the caption covers it).",
    violation: { id: "generic-alt-grounded", wcag: "1.1.1", type: "semantic", selector: 'img[src="assets/dawn.jpg"]', informative: true, layer: "C", fix: 'Use alt="" since the descriptive figcaption is the text alternative.', notes: "Generic alt but a descriptive caption grounds the fix (Layer C)." },
  },
  {
    slug: "inj-alt-filename-heading",
    html: page("Team", "Beacon", `<h1>Our team</h1>\n<div class="card"><img src="assets/IMG_5521.jpg" alt="IMG_5521.jpg"><h3>Jordan Lee</h3><p>Engineering</p></div>`),
    expectedUsable: "The headshot's alt is meaningful (or empty because the adjacent name covers it).",
    violation: { id: "filename-alt-grounded", wcag: "1.1.1", type: "semantic", selector: 'img[src="assets/IMG_5521.jpg"]', informative: true, layer: "C", fix: 'Use alt="" (the adjacent <h3> name is the alternative) or alt="Jordan Lee".', notes: "Filename alt with an adjacent name heading (Layer C)." },
  },
  {
    slug: "inj-decorative-alt",
    html: page("Essay", "Beacon", `<h1>On stillness</h1>\n<p>There is a quiet that arrives only when you stop filling it.</p>\n<img src="assets/swirl.svg" alt="decorative ornamental divider swirl" style="width:120px;display:block;margin:20px auto">\n<p>The garden does not hurry, and yet everything is done.</p>`),
    expectedUsable: "The decorative divider is hidden from screen readers.",
    violation: { id: "decorative-verbose-alt", wcag: "1.1.1", type: "semantic", selector: 'img[src="assets/swirl.svg"]', informative: false, layer: "C", fix: 'Set alt="" so the decorative divider is skipped.', notes: "Decorative image with verbose alt (Layer C)." },
  },
  {
    slug: "inj-aria-label-mismatch",
    html: page("Checkout", "Beacon", `<h1>Payment</h1>\n<form><label for="cc">Card number</label><input id="cc" aria-label="Expiry date" inputmode="numeric"><button type="submit">Pay</button></form>`),
    expectedUsable: "The field's accessible name matches its visible label.",
    violation: { id: "aria-label-mismatch", wcag: "2.5.3", type: "semantic", selector: "#cc", informative: null, layer: "C", fix: "Remove the contradicting aria-label so it falls back to the visible label.", notes: "aria-label contradicts the visible <label> (Layer C)." },
  },
];

const ROOT = join(process.cwd(), "corpus", "injected");
for (const s of specs) {
  const dir = join(ROOT, s.slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), s.html, "utf8");
  const manifest = {
    id: s.slug,
    source: "injected",
    expectedUsable: s.expectedUsable,
    violations: [
      {
        id: s.violation.id,
        wcag: s.violation.wcag,
        type: s.violation.type,
        selector: s.violation.selector,
        informative: s.violation.informative,
        expectedCatchingLayer: s.violation.layer,
        expectedFix: s.violation.fix,
        notes: s.violation.notes,
      },
    ],
  };
  writeFileSync(join(dir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");
}
console.log(`wrote ${specs.length} injected pages to corpus/injected/`);
