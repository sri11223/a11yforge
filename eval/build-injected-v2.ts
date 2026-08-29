import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * V2 corpus widening: ~18 MORE fair injected pages (clean templates, one realistic
 * fairly-fixable violation each) to give the eventual re-run the n to make the
 * harm/regression contrast statistically significant. HONEST — realistic pages, not
 * rigged to trip the baseline; each violation has a straightforward correct fix.
 *
 * Written to corpus/injected-v2/ (a SEPARATE bucket) so materializing it does not disturb
 * the corpus/injected/ that a running determinism proof evaluates. The V2 eval adds this
 * bucket. Regenerate: node dist/eval/build-injected-v2.js
 */

const CSS =
  ":root{--ink:#161616;--muted:#454545;--brand:#0b4a8f;--line:#dcdce0}*{box-sizing:border-box}" +
  "body{margin:0;font:16px/1.55 system-ui,Segoe UI,Roboto,sans-serif;color:var(--ink);background:#fff}" +
  "a{color:var(--brand)}.site{display:flex;justify-content:space-between;padding:14px 22px;border-bottom:1px solid var(--line)}" +
  ".brand{font-weight:700;text-decoration:none;color:var(--ink)}nav a{margin-left:18px;text-decoration:none}" +
  "main{max-width:820px;margin:0 auto;padding:32px 22px}h1{font-size:28px;margin:0 0 12px}" +
  "label{display:block;font-weight:600;margin:12px 0 6px}input,select,textarea{width:100%;padding:10px;border:1px solid #b3b3ba;border-radius:8px;font-size:16px}" +
  "button{background:var(--brand);color:#fff;border:0;border-radius:8px;padding:11px 16px;font-size:16px;cursor:pointer}" +
  "a:focus-visible,button:focus-visible,input:focus-visible{outline:3px solid #ffbf47;outline-offset:2px}" +
  "figure{margin:18px 0}figure img{width:100%;max-width:400px;aspect-ratio:4/3;object-fit:cover;border-radius:10px;background:#eee}figcaption{color:var(--muted);font-size:14px;margin-top:6px}";

function page(title: string, brand: string, body: string, script = ""): string {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title><style>${CSS}</style></head>
<body>
<header class="site"><a class="brand" href="/">${brand}</a><nav aria-label="Primary"><a href="/x">Home</a><a href="/y">More</a></nav></header>
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
  v: { id: string; wcag: string; type: "mechanical" | "behavioral" | "semantic"; selector: string; informative: boolean | null; layer: "A" | "B" | "C"; fix: string; notes: string };
}

const B = (id: string, wcag: string, selector: string, fix: string, notes: string) =>
  ({ id, wcag, type: "behavioral" as const, selector, informative: null, layer: "B" as const, fix, notes });
const C = (id: string, wcag: string, selector: string, informative: boolean | null, fix: string, notes: string) =>
  ({ id, wcag, type: "semantic" as const, selector, informative, layer: "C" as const, fix, notes });
const A = (id: string, wcag: string, selector: string, fix: string, notes: string) =>
  ({ id, wcag, type: "mechanical" as const, selector, informative: null, layer: "A" as const, fix, notes });

const specs: Spec[] = [
  { slug: "v2-form-label-search", html: page("Library — Search", "Athenaeum", `<h1>Search the catalog</h1>\n<form><input type="search" placeholder="Title, author, or ISBN"><button type="button">Search</button></form>`), expectedUsable: "The search field has a persistent label.", v: A("missing-label", "4.1.2", "form input", "Add an associated <label> / accessible name.", "Placeholder-only search input (Layer A).") },
  { slug: "v2-form-label-login", html: page("Portal — Sign in", "Northgate", `<h1>Sign in</h1>\n<form><input type="text" placeholder="Username"><label for="pw">Password</label><input id="pw" type="password"><button type="submit">Sign in</button></form>`), expectedUsable: "The username field has a label like the password field.", v: A("missing-label", "4.1.2", "form input", "Add a <label> for the username field.", "One labelled field, one placeholder-only (Layer A).") },
  { slug: "v2-heading-skip-report", html: page("Q3 report", "Meridian", `<h1>Q3 report</h1>\n<p>Summary of the quarter.</p>\n<h4>Revenue</h4>\n<p>Up 12% year over year.</p>`), expectedUsable: "Headings are sequential (h1 → h2).", v: B("heading-skip", "1.3.1", "main h4", "Change the h4 to h2.", "h1 then h4 (Layer B outline).") },
  { slug: "v2-heading-skip-wiki", html: page("Topic", "Encyclo", `<h1>Photosynthesis</h1>\n<p>Overview.</p>\n<h3>Light reactions</h3>\n<p>Details.</p>`), expectedUsable: "Headings are sequential.", v: B("heading-skip", "1.3.1", "main h3", "Change the h3 to h2.", "h1 then h3 (Layer B outline).") },
  { slug: "v2-skip-link-shop", html: page("Shop", "Marketplace", `<h1>Today's deals</h1>\n<p>Browse hand-picked deals updated hourly.</p>`).replace("<main>", '<a class="skip" href="#deals" style="position:absolute;left:-9999px">Skip to content</a>\n<main id="content">'), expectedUsable: "The skip link lands on the main content.", v: B("dead-skip-link", "2.4.1", "a.skip", "Point href at #content (or set main id=deals).", "Skip link target missing (Layer B).") },
  { slug: "v2-positive-tabindex-apply", html: page("Apply", "Careers", `<h1>Apply now</h1>\n<form><label for="fn">Full name</label><input id="fn" tabindex="3"><label for="em">Email</label><input id="em" type="email" tabindex="1"><label for="ph">Phone</label><input id="ph" tabindex="2"><button type="submit" tabindex="4">Submit</button></form>`), expectedUsable: "Tab order follows the visual field order.", v: B("positive-tabindex", "2.4.3", "form", "Remove the positive tabindex attributes.", "tabindex 3/1/2 scrambles order (Layer B).") },
  { slug: "v2-live-region-cart", html: page("Store", "Craftly", `<h1>Ceramic bowl</h1>\n<button id="add" type="button">Add to cart</button>\n<div id="msg" style="margin-top:12px;color:#0a5c2e;font-weight:600"></div>`, `<script>document.getElementById('add').addEventListener('click',()=>{document.getElementById('msg').textContent='Added to cart';});</script>`), expectedUsable: "The add-to-cart confirmation is announced.", v: B("silent-status", "4.1.3", "#msg", "Add role=status / aria-live=polite.", "Dynamic confirmation, non-live region (Layer B).") },
  { slug: "v2-live-region-form", html: page("Feedback", "Loop", `<h1>Send feedback</h1>\n<form><label for="msg2">Message</label><textarea id="msg2" rows="4"></textarea><button id="send" type="button">Send</button></form>\n<div id="ok" style="margin-top:10px;color:#0a5c2e"></div>`, `<script>document.getElementById('send').addEventListener('click',()=>{document.getElementById('ok').textContent='Thanks — sent!';});</script>`), expectedUsable: "The success message is announced.", v: B("silent-status", "4.1.3", "#ok", "Add a live region to the status container.", "Silent success message (Layer B).") },
  { slug: "v2-div-button-menu", html: page("Dashboard", "Pulse", `<h1>Dashboard</h1>\n<div class="m" role="button" tabindex="0" aria-expanded="false" aria-controls="mm" onclick="document.getElementById('mm').hidden=!document.getElementById('mm').hidden">Menu</div>\n<ul id="mm" hidden><li>Profile</li><li>Settings</li></ul>`), expectedUsable: "The menu toggle works with Enter/Space.", v: B("no-keyboard-activation", "2.1.1", ".m", "Use a <button> or add keydown for Enter/Space.", "role=button, click-only (Layer B).") },
  { slug: "v2-div-button-accordion", html: page("Help", "Assist", `<h1>Help</h1>\n<div class="q" role="button" tabindex="0" aria-controls="a" onclick="document.getElementById('a').hidden=!document.getElementById('a').hidden">How do I export data?</div>\n<div id="a" hidden>Open Settings → Export.</div>`), expectedUsable: "The disclosure works with the keyboard.", v: B("no-keyboard-activation", "2.1.1", ".q", "Add keydown handling or use <button>.", "role=button, click-only (Layer B).") },
  { slug: "v2-icon-focus-share", html: page("Article", "Dispatch", `<h1>A quiet revolution</h1>\n<p>By staff writers.</p>\n<div class="ib" role="button" aria-label="Share article" onclick="void 0">&#128257;</div>`), expectedUsable: "The share control is keyboard-reachable.", v: B("not-focusable", "2.1.1", ".ib", "Use <button> or add tabindex=0 + Enter/Space.", "role=button, no tabindex (Layer B).") },
  { slug: "v2-icon-focus-fav", html: page("Recipe", "Simmer", `<h1>Tomato soup</h1>\n<div class="ib" role="button" aria-label="Save recipe" onclick="void 0">&#9825;</div>\n<p>A 30-minute weeknight classic.</p>`), expectedUsable: "The save control is keyboard-reachable.", v: B("not-focusable", "2.1.1", ".ib", "Use <button> or add tabindex=0 + Enter/Space.", "role=button, no tabindex (Layer B).") },
  { slug: "v2-css-reorder-nav", html: page("Studio", "Form&Co", `<h1>Our services</h1>\n<div style="display:flex;gap:16px"><div style="order:2">Branding</div><div style="order:3">Web</div><div style="order:1">Strategy</div></div>`), expectedUsable: "Visual service order matches reading order.", v: B("visual-order", "1.3.2", "main div", "Order items in the DOM; drop the CSS order overrides.", "CSS order reorders reading sequence (Layer B).") },
  { slug: "v2-css-reorder-steps", html: page("Onboarding", "Kickoff", `<h1>Get started</h1>\n<div style="display:flex;gap:16px"><div style="order:2">Verify email</div><div style="order:1">Create account</div><div style="order:3">Invite team</div></div>`), expectedUsable: "Step order matches reading order.", v: B("visual-order", "1.3.2", "main div", "Reorder steps in the DOM.", "CSS order swaps steps 1 and 2 (Layer B).") },
  { slug: "v2-alt-generic-hero", html: page("Travel", "Wander", `<h1>Iceland in winter</h1>\n<figure><img src="assets/aurora.jpg" alt="photo"><figcaption>The aurora over Kirkjufell at midnight</figcaption></figure>`), expectedUsable: "The image alt is meaningful (or empty, since the caption covers it).", v: C("generic-alt-grounded", "1.1.1", 'img[src="assets/aurora.jpg"]', true, 'Use alt="" (the descriptive caption is the alternative).', "Generic alt, descriptive caption grounds the fix (Layer C).") },
  { slug: "v2-alt-filename-team", html: page("About", "Forge", `<h1>Leadership</h1>\n<div class="card"><img src="assets/DSC_1180.jpg" alt="DSC_1180.jpg"><h3>Priya Nair</h3><p>CEO</p></div>`), expectedUsable: "The headshot alt is meaningful (or empty; the adjacent name covers it).", v: C("filename-alt-grounded", "1.1.1", 'img[src="assets/DSC_1180.jpg"]', true, 'Use alt="" (adjacent name) or alt="Priya Nair".', "Filename alt with adjacent name heading (Layer C).") },
  { slug: "v2-decorative-alt-hr", html: page("Notes", "Margins", `<h1>On attention</h1>\n<p>We spend it before we notice we had it.</p>\n<img src="assets/rule.svg" alt="decorative horizontal rule ornament" style="width:140px;display:block;margin:18px auto">\n<p>Begin again.</p>`), expectedUsable: "The decorative rule is hidden from screen readers.", v: C("decorative-verbose-alt", "1.1.1", 'img[src="assets/rule.svg"]', false, 'Set alt="".', "Decorative image with verbose alt (Layer C).") },
  { slug: "v2-aria-label-mismatch-search", html: page("Search", "Findr", `<h1>Search</h1>\n<form><label for="q">Search query</label><input id="q" aria-label="Zip code"><button type="submit">Go</button></form>`), expectedUsable: "The field's accessible name matches its visible label.", v: C("aria-label-mismatch", "2.5.3", "#q", null, "Remove the contradicting aria-label.", "aria-label contradicts the visible label (Layer C).") },
];

const ROOT = join(process.cwd(), "corpus", "injected-v2");
for (const s of specs) {
  const dir = join(ROOT, s.slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), s.html, "utf8");
  writeFileSync(
    join(dir, "manifest.json"),
    JSON.stringify(
      {
        id: s.slug,
        source: "injected",
        expectedUsable: s.expectedUsable,
        violations: [
          { id: s.v.id, wcag: s.v.wcag, type: s.v.type, selector: s.v.selector, informative: s.v.informative, expectedCatchingLayer: s.v.layer, expectedFix: s.v.fix, notes: s.v.notes },
        ],
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );
}
console.log(`wrote ${specs.length} v2 injected pages to corpus/injected-v2/`);
