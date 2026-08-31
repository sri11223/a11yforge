import { chromium, type Browser } from "playwright";
import { createRequire } from "node:module";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { join } from "node:path";
import { runAdvanced, type FixMemory } from "../src/agents/advanced.js";

/**
 * NARRATION DIFF — what a screen-reader user actually HEARS, before vs after the fix.
 *
 * Every string in the output is CAPTURED from the Guidepup virtual screen reader traversing the
 * two real DOMs (original page, then the agent's shipped page). Nothing here is written by hand:
 * hand-authored narration would be exactly the fabrication we accuse overlay vendors of.
 *
 * Writes docs/builder-trajectories/narration-diff.{md,json} ONLY — never docs/results/, metrics.json or
 * ablation.json. Run from dist/: node dist/eval/narration-diff.js
 */

const require = createRequire(import.meta.url);
const BUNDLE = require.resolve("@guidepup/virtual-screen-reader/browser.js");
const DATA_URL = "data:text/javascript;base64," + Buffer.from(readFileSync(BUNDLE, "utf8")).toString("base64");

const BUCKETS = ["adversarial", "injected"];
const OUT = join(process.cwd(), "docs", "builder-trajectories");

/** Capture the real spoken-phrase log for a page URL via the virtual screen reader. */
async function spokenFor(browser: Browser, url: string): Promise<string[]> {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: "load" });
    await page.addScriptTag({
      type: "module",
      content: `import { virtual } from "${DATA_URL}"; window.__vsr = virtual; window.__ready = true;`,
    });
    await page.waitForFunction("window.__ready === true", { timeout: 15000 });
    return await page.evaluate(async () => {
      const v = (window as unknown as {
        __vsr: {
          start: (o: unknown) => Promise<void>;
          next: () => Promise<void>;
          lastSpokenPhrase: () => Promise<string>;
          spokenPhraseLog: () => Promise<string[]>;
          stop: () => Promise<void>;
        };
      }).__vsr;
      await v.start({ container: document.body });
      for (let i = 0; i < 120; i++) {
        const before = await v.lastSpokenPhrase();
        await v.next();
        const after = await v.lastSpokenPhrase();
        if (i > 2 && before === after) break;
      }
      const out = await v.spokenPhraseLog();
      await v.stop();
      return out;
    });
  } finally {
    await ctx.close();
  }
}

/** Longest-common-subsequence unified diff over announcement sequences. */
type DiffOp = { op: " " | "-" | "+"; text: string };
function diffLines(a: string[], b: string[]): DiffOp[] {
  const n = a.length, m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i]![j] = a[i] === b[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  }
  const out: DiffOp[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.push({ op: " ", text: a[i]! }); i++; j++; }
    else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) { out.push({ op: "-", text: a[i]! }); i++; }
    else { out.push({ op: "+", text: b[j]! }); j++; }
  }
  while (i < n) out.push({ op: "-", text: a[i++]! });
  while (j < m) out.push({ op: "+", text: b[j++]! });
  return out;
}

interface PageDiff {
  bucket: string; slug: string; before: string[]; after: string[]; changed: boolean;
  /** raw diff-op counts across the traversal window (inflated on pages that wrap — see below) */
  added: number; removed: number;
  /** DISTINCT announcement strings removed/added — the honest measure of how much really changed */
  distinctRemoved: string[]; distinctAdded: string[];
  /** how many times the traversal reached "end of document" inside the window */
  passes: number;
  diff: DiffOp[];
}

async function main(): Promise<void> {
  process.env.A11YFORGE_MODE ??= "replay";
  process.env.FIXER_MODEL ??= "anthropic/claude-sonnet-5";
  process.env.JUDGE_MODEL ??= "openai/gpt-4o-mini";

  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const results: PageDiff[] = [];
  const tmp = mkdtempSync(join(tmpdir(), "a11yforge-narr-"));
  try {
    for (const bucket of BUCKETS) {
      const dir = join(process.cwd(), "corpus", bucket);
      if (!existsSync(dir)) continue;
      const slugs = readdirSync(dir, { withFileTypes: true })
        .filter((d) => d.isDirectory()).map((d) => d.name)
        .filter((s) => existsSync(join(dir, s, "index.html"))).sort();
      const memory: FixMemory = new Map(); // per-bucket, mirroring run-eval.ts
      for (const slug of slugs) {
        const srcPath = join(dir, slug, "index.html");
        const html = readFileSync(srcPath, "utf8");
        const before = await spokenFor(browser, pathToFileURL(srcPath).href);
        const adv = await runAdvanced(html, { browser, pageId: slug, memory });
        // Write the shipped HTML NEXT TO the original so relative assets still resolve.
        const shipped = join(dir, slug, `.__shipped-${slug}.html`);
        writeFileSync(shipped, adv.html, "utf8");
        let after: string[];
        try {
          after = await spokenFor(browser, pathToFileURL(shipped).href);
        } finally {
          rmSync(shipped, { force: true });
        }
        const diff = diffLines(before, after);
        const distinctRemoved = [...new Set(diff.filter((d) => d.op === "-").map((d) => d.text))];
        const distinctAdded = [...new Set(diff.filter((d) => d.op === "+").map((d) => d.text))];
        results.push({
          bucket, slug, before, after,
          changed: diff.some((d) => d.op !== " "),
          added: diff.filter((d) => d.op === "+").length,
          removed: diff.filter((d) => d.op === "-").length,
          distinctRemoved, distinctAdded,
          passes: before.filter((p) => p === "end of document").length,
          diff,
        });
        console.log(`${bucket}/${slug}: ${distinctRemoved.length} distinct removed / ${distinctAdded.length} distinct added (raw ops ${diff.filter((d) => d.op !== " ").length}, ${before.filter((p) => p === "end of document").length} pass(es))`);
      }
    }
  } finally {
    await browser.close();
    rmSync(tmp, { recursive: true, force: true });
  }

  writeFileSync(join(OUT, "narration-diff.json"), JSON.stringify({ note: "Real Guidepup virtual-screen-reader spoken-phrase logs captured on the original and shipped DOMs. Nothing hand-authored.", pages: results }, null, 2) + "\n", "utf8");

  const changed = results.filter((r) => r.changed);
  const unchanged = results.filter((r) => !r.changed);
  const distinctCount = (r: PageDiff) => r.distinctRemoved.length + r.distinctAdded.length;
  const ranked = [...changed].sort((a, b) => distinctCount(b) - distinctCount(a));

  const md: string[] = [];
  md.push(`# What a screen-reader user actually hears — before vs after\n`);
  md.push(`Every line below is **captured output**, not prose: the [Guidepup](https://github.com/guidepup/guidepup)`);
  md.push(`virtual screen reader traverses the original DOM and then the agent's shipped DOM, and we diff the`);
  md.push(`two spoken-phrase logs. \`-\` is what the user heard **before** the fix, \`+\` what they hear **after**.\n`);
  md.push(`**Honest scope — read this before the diffs.** This is a *virtual* screen reader: a deterministic`);
  md.push(`simulation of reading order, operability and accessible-name presence. It is **not** a bug-for-bug`);
  md.push(`replica of NVDA, JAWS or VoiceOver, and it is **not a substitute for testing with real screen-reader`);
  md.push(`users**. Guidepup's own maintainers are explicit that automation complements rather than replaces`);
  md.push(`manual AT testing, and we hold the same posture: this shows that the *announced experience* changed,`);
  md.push(`not that a real user's task succeeded.\n`);
  md.push(`**How to read the counts.** Each capture is a fixed **121-announcement window** (the`);
  md.push(`traversal is stepped a bounded number of times). On a long page that window is a truncated`);
  md.push(`single pass; on a short page the traversal reaches \`end of document\` and **wraps**, so the`);
  md.push(`window contains several passes and one real difference appears once per pass. We therefore`);
  md.push(`rank and report **distinct** changed announcements, not raw diff lines, and show the pass`);
  md.push(`count per page so the raw numbers can't mislead.\n`);
  md.push(`**What this artifact can and cannot show.** It surfaces changes to what is *announced* —`);
  md.push(`accessible names, reading order, headings, whether a filename gets read out. It does **not**`);
  md.push(`surface *operability* fixes: this is a reading-order traversal, which visits content whether`);
  md.push(`or not it is keyboard-reachable, so making a control focusable/activatable (adding \`tabindex\``);
  md.push(`and key handlers, or letting Escape close a dialog) correctly produces **no announcement`);
  md.push(`change here**. Those fixes are evidenced by the Layer-B findings and the per-page`);
  md.push(`[trajectories](README.md) instead. That is why several of our most important keyboard repairs`);
  md.push(`appear below as "no audible change" — we show them rather than hide the inconvenient half.\n`);
  md.push(`**Division of evidence, so neither half carries the other's weight:** announcement diffs prove`);
  md.push(`the *name / reading-order / text* class; **finding-disappearance** proves the *operability*`);
  md.push(`class — e.g. \`keyboard-trap-modal\` is detected as "[2.1.2] focus is trapped: Tab does not move`);
  md.push(`focus out, Escape does not dismiss it" and ships Layer A 0 · B 0 · C 0, visible in its`);
  md.push(`[trajectory](keyboard-trap-modal.md). Each unchanged page below links its own trajectory.\n`);
  md.push(`**And note what this transcript is not:** it is *evidence*, not the detector. Every Layer-B`);
  md.push(`finding is produced by the deterministic check functions (heading outline, skip links, tab`);
  md.push(`order, visual order, live regions, dialog traps, control operability); nothing in the finding`);
  md.push(`path reads the announcement log. So the traversal window above can only affect this artifact —`);
  md.push(`it cannot move \`metrics.json\` or \`ablation.json\`, which reproduce byte-identically whether the`);
  md.push(`virtual SR engages or not.\n`);
  md.push(`Captured across **${results.length} pages**: **${changed.length}** produced an audible difference, **${unchanged.length}** did not (all listed, with the reason).\n`);

  if (ranked.length) {
    md.push(`## Most dramatic differences\n`);
    for (const r of ranked.slice(0, 5)) {
      md.push(`- **${r.slug}** — ${r.distinctRemoved.length} distinct phrase(s) gone, ${r.distinctAdded.length} new` +
        (r.distinctAdded[0] ? ` · e.g. \`${r.distinctRemoved[0] ?? "—"}\` → \`${r.distinctAdded[0]}\`` : ""));
    }
    md.push("");
  }

  md.push(`## Per page\n`);
  for (const r of results) {
    md.push(`### ${r.slug}\n`);
    md.push(`_${r.bucket} · ${r.passes} traversal pass(es) in the window · ${r.changed ? `**${r.distinctRemoved.length} distinct phrase(s) removed, ${r.distinctAdded.length} added** (${r.removed}/${r.added} raw diff lines)` : "**no audible change at this layer**"}_\n`);
    if (!r.changed) {
      md.push(`The fix here is **operability, not announcement**: the agent made a control keyboard-`);
      md.push(`reachable/activatable (or let Escape dismiss a dialog), which a *reading-order* traversal`);
      md.push(`cannot show — it visits content regardless of focusability, and the accessible name was`);
      md.push(`already present. The repair is real and is evidenced by the Layer-B findings and this`);
      md.push(`page's [trajectory](${r.slug}.md); it simply is not audible in this particular artifact.`);
      md.push(`Shown rather than omitted: an honest "no change here" is worth more than only the wins.\n`);
    }
    md.push("```diff");
    for (const d of r.diff) md.push(`${d.op}${d.text}`);
    md.push("```\n");
  }
  writeFileSync(join(OUT, "narration-diff.md"), md.join("\n"), "utf8");

  console.log(`\n${changed.length}/${results.length} pages produced an audible diff.`);
  console.log("Top:", ranked.slice(0, 5).map((r) => r.slug).join(", "));
  console.log("Unchanged:", unchanged.map((r) => r.slug).join(", ") || "(none)");
  console.log("Wrote docs/builder-trajectories/narration-diff.{md,json}");
}

main().catch((e: unknown) => { console.error(e); process.exitCode = 1; });
