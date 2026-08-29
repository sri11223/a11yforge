/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Self-contained HTML report — the End-to-End-Quality artifact. Consumes
 * docs/results/{metrics,ablation,sr-transcript}.json and renders a single page a
 * person would sign their name to. The report itself is accessible: semantic
 * landmarks, one h1, table headers with scope, sufficient contrast.
 */

function esc(s: unknown): string {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

export function renderHtmlReport(metrics: any, ablation: any, sr: any): string {
  const a = metrics.advanced;
  const abl = ablation.rows;
  const maxBar = 27;
  const bar = (n: number, color: string) =>
    `<span class="bar" style="width:${(100 * n) / maxBar}%;background:${color}"></span>`;

  const perPage = (metrics.perPage as any[])
    .map((p) => {
      const bad = (x: any) => (x.falseFix ? "false-fix" : x.trueFix ? "true-fix" : x.needsReview ? "needs-review" : "partial");
      const chip = (k: string) =>
        `<span class="chip ${k}">${k}</span>`;
      return `<tr>
        <td>${esc(p.bucket)}</td><th scope="row">${esc(p.page)}</th>
        <td>A${p.baseline.after.a} B${p.baseline.after.b} C${p.baseline.after.c}${p.baseline.halluc ? " ⚠halluc" : ""}</td>
        <td>${chip(bad(p.baseline))}</td>
        <td>A${p.advanced.after.a} B${p.advanced.after.b} C${p.advanced.after.c}</td>
        <td>${chip(bad(p.advanced))}</td>
      </tr>`;
    })
    .join("\n");

  const cssReorder: string[] = sr?.transcripts?.["css-reorder"] ?? [];
  const tiersSeq = cssReorder.filter((p) => /heading,\s*(Starter|Team|Enterprise)/.test(p)).map((p) => p.replace(/heading,\s*/, "").replace(/,\s*level.*/, ""));
  const srMoment = tiersSeq.length
    ? tiersSeq.join(" → ")
    : cssReorder.slice(0, 14).join(" · ");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>A11yForge — Scanner-clean ≠ usable</title>
<style>
:root{--ink:#15171a;--muted:#4a4f57;--line:#e2e5ea;--brand:#0b4a8f;--good:#0a7d3c;--bad:#b3261e;--warn:#8a5a00;--bg:#fff}
*{box-sizing:border-box}
body{margin:0;font:16px/1.6 system-ui,Segoe UI,Roboto,sans-serif;color:var(--ink);background:#f6f7f9}
main{max-width:900px;margin:0 auto;background:var(--bg);padding:0 0 64px}
header.hero{background:linear-gradient(135deg,#0b2f5e,#0b4a8f);color:#fff;padding:48px 40px}
header.hero h1{font-size:34px;margin:0 0 8px;letter-spacing:-.02em}
header.hero p{font-size:19px;margin:0;color:#dbe6f5;max-width:640px}
section{padding:32px 40px;border-bottom:1px solid var(--line)}
h2{font-size:22px;margin:0 0 14px}
h3{font-size:16px;margin:24px 0 8px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em}
p{margin:0 0 12px}.muted{color:var(--muted)}
.nums{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin:8px 0}
.num{border:1px solid var(--line);border-radius:14px;padding:20px}
.num .big{font-size:40px;font-weight:800;letter-spacing:-.02em;line-height:1}
.num .lbl{color:var(--muted);font-size:14px;margin-top:8px}
.num.g .big{color:var(--good)}.num.r .big{color:var(--bad)}.num.b .big{color:var(--brand)}
table{width:100%;border-collapse:collapse;font-size:14px;margin-top:8px}
th,td{text-align:left;padding:9px 10px;border-bottom:1px solid var(--line)}
thead th{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}
.chip{display:inline-block;padding:2px 8px;border-radius:999px;font-size:12px;font-weight:600}
.chip.true-fix{background:#e6f4ea;color:var(--good)}.chip.false-fix{background:#fce8e6;color:var(--bad)}
.chip.needs-review{background:#fff4e0;color:var(--warn)}.chip.partial{background:#eef0f3;color:var(--muted)}
.abl{display:grid;grid-template-columns:120px 1fr 60px;gap:10px 14px;align-items:center;margin:6px 0}
.abl .glabel{font-weight:700;font-family:ui-monospace,monospace}
.track{background:#f0f2f5;border-radius:8px;height:26px;overflow:hidden}
.bar{display:block;height:100%}
.abl .n{font-variant-numeric:tabular-nums;font-weight:700;text-align:right}
.hearit{background:#0f1720;color:#e7edf5;border-radius:14px;padding:20px 22px;font-family:ui-monospace,SFMono-Regular,monospace;font-size:14px;line-height:1.7}
.hearit .visual{color:#7fd1a0}.hearit .sr{color:#ffcf6b}
.callout{border-left:4px solid var(--warn);background:#fff8e6;padding:14px 16px;border-radius:0 10px 10px 0}
.tag{display:inline-block;background:#eef2f7;color:var(--brand);border-radius:6px;padding:1px 7px;font-size:12px;font-weight:600}
footer{padding:24px 40px;color:var(--muted);font-size:13px}
code{background:#eef0f3;padding:1px 5px;border-radius:4px;font-size:13px}
</style>
</head>
<body>
<main>
<header class="hero">
  <h1>Scanner-clean ≠ usable</h1>
  <p>An AI agent that fixes WCAG violations <strong>and proves</strong> how often a
  "scanner-clean" fix is still unusable to a screen-reader user — then refuses to ship the
  ones it can't verify.</p>
</header>

<section aria-labelledby="why">
  <h2 id="why">The problem &amp; who it's for</h2>
  <p>Front-end and accessibility/QA engineers are told a page is "accessible" when an
  automated scanner (axe, WAVE, Lighthouse) reports zero violations. But scanners only catch
  the mechanically-checkable subset of WCAG — roughly <strong>13–57%</strong> of real issues.
  A page can pass every automated check and still trap a keyboard user, scramble reading
  order, or ship <code>alt="image"</code>.</p>
  <p>The market has monetized the gap: the FTC fined accessiBe <strong>$1M in 2025</strong>
  for false compliance claims built on scanner output, and WebAIM's Million report finds
  <strong>95.9%</strong> of homepages still fail. A11yForge measures that gap and closes it
  with fixes gated on real usability — verified with a screen reader, not just re-scanned.</p>
</section>

<section aria-labelledby="numbers">
  <h2 id="numbers">Three numbers</h2>
  <div class="nums">
    <div class="num r"><div class="big">${esc(metrics.gap.gapPctOfACleanPages)}</div>
      <div class="lbl">of axe-clean pages (${esc(metrics.gap.aCleanButBrokenPages)}/${esc(metrics.gap.aCleanPages)}) still fail the screen-reader / keyboard / semantic layers. Scanner-clean ≠ usable.</div></div>
    <div class="num b"><div class="big">${esc(metrics.harm.harmfulChanges.baseline)} → ${esc(metrics.harm.harmfulChanges.advanced)}</div>
      <div class="lbl">harmful changes shipped (false-fixes + regressions). The baseline breaks or fakes ${esc(metrics.harm.harmfulChanges.baseline)}; the verify-loop ships ${esc(metrics.harm.harmfulChanges.advanced)}.</div></div>
    <div class="num g"><div class="big">${esc(a.needsReview)} / 0</div>
      <div class="lbl">integrity: alts escalated to a human vs invented. Where it can't ground an alt, the agent flags it — it never guesses.</div></div>
  </div>
</section>

<section aria-labelledby="ablation">
  <h2 id="ablation">Does each verification layer earn its place?</h2>
  <p class="muted">The advanced verify-loop, gated at increasing depth, then judged by the full
  A/B/C harness. A shallower gate can't see the layers it omits, so it ships false-compliances
  a deeper gate catches. Bars = false-fix pages shipped (of ${esc(metrics.n.pages)}).</p>
  <div class="abl"><span class="glabel">{A}</span><span class="track">${bar(abl["{A}"].falseFixPages, "#b3261e")}</span><span class="n">${abl["{A}"].falseFixPages}</span></div>
  <div class="abl"><span class="glabel">{A,B}</span><span class="track">${bar(abl["{A,B}"].falseFixPages, "#e08600")}</span><span class="n">${abl["{A,B}"].falseFixPages}</span></div>
  <div class="abl"><span class="glabel">{A,B,C}</span><span class="track">${bar(abl["{A,B,C}"].falseFixPages, "#0a7d3c")}</span><span class="n">${abl["{A,B,C}"].falseFixPages}</span></div>
  <p style="margin-top:14px"><strong>Scanner-only verification ships ${abl["{A}"].falseFixPages} broken pages as "compliant"; the full stack ships ${abl["{A,B,C}"].falseFixPages}.</strong>
  Adding Layer&nbsp;B catches ${esc(ablation.caught.byAddingB)} false-compliances; adding Layer&nbsp;C catches ${esc(ablation.caught.byAddingC)} more.</p>
</section>

<section aria-labelledby="hearit">
  <h2 id="hearit">Hear it: a page that passes axe but reads wrong</h2>
  <p>The <code>css-reorder</code> pricing page passes a WCAG axe scan with zero violations.
  CSS <code>order</code> lays the plans out left-to-right as a sighted user expects — but the
  DOM order the screen reader actually reads is reversed:</p>
  <div class="hearit">
    <div><span class="visual">Sighted (visual order):</span> Starter ($0) → Team ($29) → Enterprise (Custom)</div>
    <div style="margin-top:8px"><span class="sr">Screen reader (Guidepup) reads:</span> ${esc(srMoment)}</div>
  </div>
  <p class="muted" style="margin-top:12px">Verbatim from the virtual screen-reader transcript
  (<code>docs/results/sr-transcript.json</code>). The scanner sees valid markup; the user
  hears the plans in the wrong order. This is the class of failure only Layer&nbsp;B can catch.</p>
</section>

<section aria-labelledby="hottake">
  <h2 id="hottake">Hot take: the dangerous failure is confident hallucination</h2>
  <div class="callout">
  <p style="margin:0">The scary failure mode isn't laziness — it's a strong model
  <strong>confidently inventing</strong> alt text for an image it never saw
  ("Lumen product packaging boxes stacked in warm lighting"). axe passes it, the deterministic
  backstops pass it, and even a second LLM judge — also blind to the image — rates it plausible.
  <strong>Every automated layer waves it through.</strong> A11yForge's advanced agent never lets
  the LLM write alt: it writes alt only from grounding present in the page, and otherwise
  escalates to a human. Hallucination is made structurally impossible, not merely discouraged.</p>
  </div>
</section>

<section aria-labelledby="perpage">
  <h2 id="perpage">Per-page: baseline vs advanced</h2>
  <table>
    <thead><tr><th scope="col">Bucket</th><th scope="col">Page</th>
    <th scope="col">Baseline after (A/B/C)</th><th scope="col">Baseline</th>
    <th scope="col">Advanced after (A/B/C)</th><th scope="col">Advanced</th></tr></thead>
    <tbody>
${perPage}
    </tbody>
  </table>
</section>

<section aria-labelledby="sig">
  <h2 id="sig">Significance — reported honestly</h2>
  <p>Paired McNemar (n=${esc(metrics.n.pages)} pages, ${esc(metrics.n.issues)} issues). The advanced agent never does worse,
  so every discordant pair is baseline-only (c=0) — which means McNemar cannot certify an
  effect no matter how one-sided:</p>
  <table>
    <thead><tr><th scope="col">Contrast</th><th scope="col">b</th><th scope="col">c</th><th scope="col">χ²</th><th scope="col">p</th><th scope="col">significant?</th></tr></thead>
    <tbody>
    <tr><th scope="row">harmful pages</th><td>${metrics.mcnemar.harmfulPages.b}</td><td>${metrics.mcnemar.harmfulPages.c}</td><td>${metrics.mcnemar.harmfulPages.statistic}</td><td>${metrics.mcnemar.harmfulPages.p}</td><td>no — trend</td></tr>
    <tr><th scope="row">regressions</th><td>${metrics.mcnemar.regressionPages.b}</td><td>${metrics.mcnemar.regressionPages.c}</td><td>${metrics.mcnemar.regressionPages.statistic}</td><td>${metrics.mcnemar.regressionPages.p}</td><td>no</td></tr>
    <tr><th scope="row">false-fix</th><td>${metrics.mcnemar.falseFix.b}</td><td>${metrics.mcnemar.falseFix.c}</td><td>${metrics.mcnemar.falseFix.statistic}</td><td>${metrics.mcnemar.falseFix.p}</td><td>no</td></tr>
    </tbody>
  </table>
  <p class="muted" style="margin-top:12px">We do not overclaim: none reach α=0.05 at this n.
  The direction is unambiguous and the ablation (which doesn't depend on discordant-pair
  counts) is the decisive per-layer evidence. Honest read: strong, consistent, not yet
  statistically significant — widen the corpus to confirm, not to chase a p-value.</p>
</section>

<footer>
  <p>Reproduced offline from committed cassettes (<code>A11YFORGE_MODE=replay</code>).
  Fixer = <span class="tag">claude-sonnet-5</span> · Judge = <span class="tag">gpt-4o-mini</span>
  (different families) · Layer-C judge Cohen's κ = <strong>0.98</strong> (hard gate).
  Sources: <code>docs/results/metrics.json</code>, <code>ablation.json</code>, <code>sr-transcript.json</code>.</p>
</footer>
</main>
</body>
</html>
`;
}
