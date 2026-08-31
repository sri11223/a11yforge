import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Rewrites the timing facts in out/VOICEOVER.md from the built artifacts.
 *   node video/sync-vo-times.mjs
 *
 * WHY THIS EXISTS: the script's section headers ("### 2:06.6 — 06-escalation (17.9s)"), the cut
 * duration, the word count and the spoken-fraction are all derived numbers. Every time a shot was
 * lengthened they silently went stale, and a reader would have been cueing lines against timecodes
 * from a cut that no longer exists. Deriving them means they cannot drift again.
 *
 * The spoken TEXT is never touched — only the numbers around it.
 * Run after `node video/encode.mjs cut judge`; run `video/vo-placeholder.mjs` after this.
 */

const REPO = resolve(import.meta.dirname, "..");
const MD = join(REPO, "out", "VOICEOVER.md");
const manifest = JSON.parse(readFileSync(join(REPO, "out", "video", "manifest.json"), "utf8"));
const cut = manifest.cuts?.judge;
if (!cut) throw new Error("no judge cut in the manifest — build it first");

const at = Object.fromEntries(cut.timeline.map((t) => [t.id, t]));
const mmss = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, "0")}`;

let md = readFileSync(MD, "utf8");

// ── section headers ─────────────────────────────────────────────────────────
let n = 0;
md = md.replace(/^### .*?— (\d\d[a-z]?-[a-z-]+).*$/gm, (line, id) => {
  const t = at[id];
  if (!t) { console.error(`no timeline entry for ${id} — leaving its header alone`); return line; }
  n++;
  return `### ${mmss(t.at)} — ${id} (${t.seconds.toFixed(1)}s)`;
});
if (n !== cut.timeline.length) throw new Error(`rewrote ${n} headers, expected ${cut.timeline.length}`);

// ── the "keyed to" line ─────────────────────────────────────────────────────
const keyed = `Keyed to **\`out/video/${cut.file}\`** (the judge cut, ${cut.duration}). Timings come from`;
if (!/^Keyed to .*$/m.test(md)) throw new Error("cannot find the 'Keyed to' line");
md = md.replace(/^Keyed to .*$/m, keyed);

// ── the pace line, from the fit check when it exists ────────────────────────
const fitPath = join(REPO, "out", "video", "vo-fit.json");
if (existsSync(fitPath)) {
  const fit = JSON.parse(readFileSync(fitPath, "utf8"));
  const words = fit.totalWords ?? fit.segments.reduce((a, s) => a + (s.words || 0), 0);
  const pct = Math.round(((words / (fit.humanWpm || 140)) * 60 / cut.seconds) * 100);
  const pace = `Pace: **~${fit.humanWpm || 140} wpm**, ${words} words total — roughly ${pct}% of the runtime.`;
  if (!/^Pace: .*$/m.test(md)) throw new Error("cannot find the 'Pace:' line");
  md = md.replace(/^Pace: .*$/m, pace);
  console.log(`pace line → ${words} words, ${pct}% of ${cut.duration}`);
} else {
  console.error("no vo-fit.json yet — pace line left as-is (run video/vo-placeholder.mjs, then re-run this)");
}

writeFileSync(MD, md);
console.log(`synced ${n} headers to ${cut.file} (${cut.duration})`);
