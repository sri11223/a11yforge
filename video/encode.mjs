import { execFileSync } from "node:child_process";
import { mkdirSync, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Encodes out/video/raw/*.webm → out/video/seg/*.mp4 to the delivery spec, then joins named CUTS
 * with uniform crossfades and writes a manifest.
 *   node video/encode.mjs                 # encode every raw segment
 *   node video/encode.mjs cut judge       # build one cut
 *   node video/encode.mjs cuts            # build every cut + manifest
 *
 * Spec: 1920x1080, H.264 yuv420p, 30fps, CRF 18, +faststart. Text-heavy frames must not pick up
 * compression noise, so quality is kept high rather than small.
 *
 * The cuts are re-edits of the SAME verified segments — never a re-shoot. Every cut therefore
 * inherits the same honesty guarantees, and a segment fixed once is fixed in every cut.
 */

const REPO = resolve(import.meta.dirname, "..");
const RAW = join(REPO, "out", "video", "raw");
const SEG = join(REPO, "out", "video", "seg");
const OUT = join(REPO, "out", "video");
const XFADE = 0.35;

/** Named cuts: distinct ANGLES on the same evidence, for different judges. */
const CUTS = {
  judge: {
    file: "a11yforge-demo.mp4",
    primary: true,
    blurb: "PRIMARY. Cold-opens on the failure, states the result before the method, then builds: why a scanner cannot see it → the three layers → the hard part + the architecture → the gate firing → the refusal → what a user hears → the proof with our own limitations annotated → how we engineered it → why you can believe it → close.",
    order: ["02-hook", "01-stakes", "01b-answer", "03-reorder", "00-funnel", "05-architecture", "04-terminal",
            "06-escalation", "07-narration", "08-numbers", "08b-engineering", "09-repro", "10-close"],
  },
  "demo-first": {
    file: "a11yforge-demo-demo-first.mp4",
    blurb: "The gate firing moved to second position, so a viewer sees a real failure and the tool catching it inside 45 seconds before any framing at all.",
    order: ["02-hook", "04-terminal", "01-stakes", "01b-answer", "03-reorder", "00-funnel", "05-architecture",
            "06-escalation", "07-narration", "08-numbers", "08b-engineering", "09-repro", "10-close"],
  },
  evidence: {
    file: "a11yforge-demo-evidence.mp4",
    blurb: "Data-led for a technical or academic judge: the result up front, the gate, the full report tour including the claim hierarchy and the interval correction, the engineering discipline, determinism hashes.",
    order: ["01-stakes", "01b-answer", "00-funnel", "04-terminal", "08-numbers", "08b-engineering",
            "09-repro", "05-architecture", "10-close"],
  },
  "human-story": {
    file: "a11yforge-demo-human-story.mp4",
    blurb: "Led by what a blind user actually experiences; the narration diff and the refusal are the centrepiece and the numbers are support.",
    order: ["02-hook", "01-stakes", "01b-answer", "03-reorder", "07-narration", "06-escalation", "08-numbers", "10-close"],
  },
  teaser: {
    file: "a11yforge-teaser.mp4",
    blurb: "The cold open, the result up front, the three-layer funnel, close. Everything a judge needs to decide whether to watch the full cut.",
    order: ["02-hook", "01-stakes", "01b-answer", "00-funnel", "10-close"],
  },
};

const ff = (args) => execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", ...args], { stdio: "pipe" });
const probe = (f) =>
  JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_format", "-show_streams", "-of", "json", f], { encoding: "utf8" }));
const duration = (f) => parseFloat(probe(f).format.duration);
const dims = (f) => { const v = probe(f).streams.find((s) => s.codec_type === "video"); return `${v.width}x${v.height}`; };
const mmss = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, "0")}`;

mkdirSync(SEG, { recursive: true });

// Only real segments: a crashed record leaves an orphan page@<hash>.webm behind, and feeding a
// zero-byte file to ffmpeg fails the whole batch.
// The optional letter after the two digits matters: segments inserted between existing ones are
// named 01b-answer / 08b-engineering, and a pattern demanding "-" straight after the digits skips
// them SILENTLY — the encode looks clean and the cut then fails for missing segments.
const raws = readdirSync(RAW).filter((f) => /^\d\d[a-z]?-[a-z-]+\.webm$/.test(f) && statSync(join(RAW, f)).size > 0).sort();
if (!raws.length) { console.error("no raw segments"); process.exit(2); }

const mode = process.argv[2];
const seconds = {};
// "manifest" only re-describes finished cuts, so it must not re-encode the segments either.
if (mode !== "cut" && mode !== "cuts" && mode !== "manifest") {
  for (const r of raws) {
    const id = r.replace(/\.webm$/, "");
    const out = join(SEG, `${id}.mp4`);
    ff(["-y", "-i", join(RAW, r),
      "-vf", "scale=1920:1080:flags=lanczos,fps=30,format=yuv420p",
      "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-movflags", "+faststart", "-an", out]);
    seconds[id] = +duration(out).toFixed(2);
    console.log(`${id}  ${seconds[id]}s  ${dims(out)}  ${(statSync(out).size / 1048576).toFixed(2)}MB`);
  }
}
for (const r of raws) {
  const id = r.replace(/\.webm$/, "");
  if (!seconds[id] && existsSync(join(SEG, `${id}.mp4`))) seconds[id] = +duration(join(SEG, `${id}.mp4`)).toFixed(2);
}

/** Join one cut with uniform crossfades. Returns its manifest entry. */
function buildCut(name) {
  const cut = CUTS[name];
  if (!cut) throw new Error(`unknown cut "${name}". available: ${Object.keys(CUTS).join(", ")}`);
  const missing = cut.order.filter((id) => !existsSync(join(SEG, `${id}.mp4`)));
  if (missing.length) throw new Error(`cut "${name}" needs segments not yet encoded: ${missing.join(", ")}`);
  const files = cut.order.map((id) => join(SEG, `${id}.mp4`));
  const inputs = files.flatMap((f) => ["-i", f]);
  let filter = "", prev = "0:v", acc = seconds[cut.order[0]];
  const timeline = [{ id: cut.order[0], at: 0, seconds: acc }];
  for (let i = 1; i < files.length; i++) {
    const off = (acc - XFADE).toFixed(3);
    const label = `x${i}`;
    filter += `[${prev}][${i}:v]xfade=transition=fade:duration=${XFADE}:offset=${off}[${label}];`;
    prev = label;
    timeline.push({ id: cut.order[i], at: +(acc - XFADE).toFixed(2), seconds: seconds[cut.order[i]] });
    acc = acc + seconds[cut.order[i]] - XFADE;
  }
  filter = filter.replace(/;$/, "");
  const final = join(OUT, cut.file);
  ff(["-y", ...inputs, "-filter_complex", filter, "-map", `[${prev}]`,
    "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p",
    "-movflags", "+faststart", "-an", final]);
  const total = duration(final);
  if (total > 300) console.error(`WARNING: cut "${name}" is ${mmss(total)} — over the 5:00 cap`);
  console.log(`${name.padEnd(12)} ${mmss(total)}  ${(statSync(final).size / 1048576).toFixed(2)}MB  → ${cut.file}`);
  return { name, file: cut.file, primary: !!cut.primary, blurb: cut.blurb,
    seconds: +total.toFixed(2), duration: mmss(total), timeline };
}

/**
 * Describe an ALREADY-BUILT cut without re-encoding it: same manifest entry buildCut returns, but
 * the timeline is recomputed from the segment durations and the totals are probed off the finished
 * file. Exists because a killed write can leave manifest.json truncated while every mp4 on disk is
 * perfectly good — re-encoding half an hour of video to regenerate a 7KB index is the wrong trade.
 */
function describeCut(name) {
  const cut = CUTS[name];
  const final = join(OUT, cut.file);
  if (!cut || !existsSync(final)) return null;
  let acc = seconds[cut.order[0]];
  const timeline = [{ id: cut.order[0], at: 0, seconds: acc }];
  for (let i = 1; i < cut.order.length; i++) {
    timeline.push({ id: cut.order[i], at: +(acc - XFADE).toFixed(2), seconds: seconds[cut.order[i]] });
    acc = acc + seconds[cut.order[i]] - XFADE;
  }
  const total = duration(final);
  return { name, file: cut.file, primary: !!cut.primary, blurb: cut.blurb,
    seconds: +total.toFixed(2), duration: mmss(total), timeline };
}

if (mode === "cut" || mode === "cuts" || mode === "manifest") {
  const names = mode === "cut" ? [process.argv[3] || "judge"] : Object.keys(CUTS);
  const built = mode === "manifest"
    ? Object.keys(CUTS).map(describeCut).filter(Boolean)
    : names.map(buildCut);
  if (mode === "manifest") console.log(`described ${built.length} existing cut(s) without re-encoding`);
  const mf = join(OUT, "manifest.json");
  // A truncated manifest from an interrupted write must not abort the rebuild that would fix it.
  let prev = {};
  try { if (existsSync(mf)) prev = JSON.parse(readFileSync(mf, "utf8")); }
  catch { console.error("existing manifest.json is unreadable — rebuilding it from scratch"); }
  const cuts = Object.fromEntries(Object.entries(prev.cuts || {}).concat(built.map((b) => [b.name, b])));
  writeFileSync(mf, JSON.stringify({
    spec: "1920x1080 h264 yuv420p 30fps crf18 +faststart, silent",
    crossfade: XFADE,
    submit: "a11yforge-demo.mp4 (the judge cut).",
    warning: "Any *-placeholder-vo.mp4 carries a synthetic Windows-SAPI scratch narration for timing review ONLY. Do not submit it — a synthetic voice would undercut a submission whose whole posture is authenticity.",
    segments: Object.entries(seconds).sort().map(([id, s]) => ({ id, seconds: s })),
    cuts,
  }, null, 2) + "\n");
  console.log("manifest → out/video/manifest.json");
}
