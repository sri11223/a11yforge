import { execFileSync } from "node:child_process";
import { mkdirSync, existsSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Builds a SCRATCH narration track with Windows SAPI and muxes it onto the judge cut.
 *   node video/vo-placeholder.mjs
 *
 * WHY THIS EXISTS: so pacing can be judged before a human read is recorded. It is NOT a deliverable.
 * The silent master (a11yforge-demo.mp4) stays untouched and is what gets submitted — a synthetic
 * voice would undercut a submission whose whole posture is authenticity. The manifest says so too.
 *
 * The lines are parsed out of out/VOICEOVER.md rather than duplicated here, so the script a human
 * reads and the script the placeholder speaks cannot drift apart.
 */

const REPO = resolve(import.meta.dirname, "..");
const OUT = join(REPO, "out", "video");
const VO = join(OUT, "vo");
const MD = join(REPO, "out", "VOICEOVER.md");
/** The pace VOICEOVER.md is written to, and what a human read should be judged against. */
const HUMAN_WPM = 140;

const ff = (args) => execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", ...args], { stdio: "pipe" });
const dur = (f) => parseFloat(execFileSync("ffprobe",
  ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f], { encoding: "utf8" }).trim());

/** Pull one spoken block per segment out of the markdown. */
function parseScript(md) {
  const out = [];
  const re = /^### .*?— (\d\d[a-z]?-[a-z-]+).*$/gm;
  const heads = [...md.matchAll(re)];
  for (let i = 0; i < heads.length; i++) {
    const start = heads[i].index + heads[i][0].length;
    const end = i + 1 < heads.length ? heads[i + 1].index : md.indexOf("\n---\n", start);
    const body = md.slice(start, end < 0 ? undefined : end);
    const text = body.split("\n")
      .filter((l) => l.trimStart().startsWith(">"))
      .map((l) => l.trim().replace(/^>\s?/, ""))
      .join(" ")
      .replace(/\*\((?:[^)]*)\)\*/g, "")            // stage directions are not spoken
      .replace(/\[(?:SLOW|DROPPABLE)\]/g, "")        // delivery markers are not spoken
      .replace(/\*([^*]+)\*/g, "$1")                 // emphasis
      .replace(/\s{2,}/g, " ")
      .trim();
    if (text) out.push({ id: heads[i][1], text });
  }
  return out;
}

/** Render one line to a WAV with the built-in Windows speech synthesiser. */
function speak(text, wav) {
  const txt = wav.replace(/\.wav$/, ".txt");
  writeFileSync(txt, text, "utf8");
  const ps = [
    "Add-Type -AssemblyName System.Speech",
    "$s = New-Object System.Speech.Synthesis.SpeechSynthesizer",
    "$s.Rate = -1",
    `$s.SetOutputToWaveFile(${JSON.stringify(wav)})`,
    `$s.Speak([IO.File]::ReadAllText(${JSON.stringify(txt)}))`,
    "$s.Dispose()",
  ].join("; ");
  execFileSync("powershell", ["-NoProfile", "-NonInteractive", "-Command", ps], { stdio: "pipe" });
  if (!existsSync(wav) || statSync(wav).size < 1024) throw new Error(`SAPI produced no audio for ${wav}`);
}

// ─────────────────────────────────────────────────────────────────────────────
const manifest = JSON.parse(readFileSync(join(OUT, "manifest.json"), "utf8"));
const cut = manifest.cuts?.judge;
if (!cut) throw new Error("build the judge cut first: node video/encode.mjs cut judge");
const master = join(OUT, cut.file);
if (!existsSync(master)) throw new Error(`missing ${cut.file}`);

mkdirSync(VO, { recursive: true });
const script = parseScript(readFileSync(MD, "utf8"));
const byId = Object.fromEntries(script.map((s) => [s.id, s.text]));

const parts = [], fit = [];
for (const seg of cut.timeline) {
  const text = byId[seg.id];
  if (!text) { console.error(`no script block for ${seg.id} — leaving it silent`); continue; }
  const wav = join(VO, `${seg.id}.wav`);
  speak(text, wav);
  const spoken = dur(wav);
  const words = text.split(/\s+/).length;
  const slack = +(seg.seconds - spoken).toFixed(2);
  // SAPI reads several sections at 105-120wpm, well under the ~140 a human hits, so judging the fit
  // on the synthetic rate alone condemns shots that a real read would sit inside comfortably.
  // Report both: SAPI is what you can hear in the placeholder, HUMAN is what the user will record to.
  const human = +((words / HUMAN_WPM) * 60).toFixed(2);
  parts.push({ ...seg, wav, spoken: +spoken.toFixed(2), words, slack });
  fit.push({ id: seg.id, shot: seg.seconds, words,
    spoken: +spoken.toFixed(2), slack, wpm: Math.round((words / spoken) * 60),
    human, slackHuman: +(seg.seconds - human).toFixed(2) });
}

console.log("\nFIT CHECK — shot length vs spoken length, at both rates");
console.log(`segment            shot   words  |  SAPI  slack   wpm  |  ${HUMAN_WPM}wpm  slack`);
for (const f of fit) {
  const flag = f.slack < 0 ? "  ⚠ OVERRUNS (SAPI)" : f.slack < 1 ? "  ⚠ tight (SAPI)" : "";
  const hflag = f.slackHuman < 0 ? "  ⛔ OVERRUNS (HUMAN)" : "";
  console.log(`${f.id.padEnd(18)} ${String(f.shot).padStart(5)}  ${String(f.words).padStart(5)}  | ` +
    `${String(f.spoken).padStart(5)} ${String(f.slack).padStart(6)}  ${String(f.wpm).padStart(4)}  | ` +
    `${String(f.human).padStart(6)} ${String(f.slackHuman).padStart(6)}${hflag || flag}`);
}
const bad = fit.filter((f) => f.slack < 0);
const tight = fit.filter((f) => f.slack >= 0 && f.slack < 1);
const badHuman = fit.filter((f) => f.slackHuman < 0);

// Lay each line at its segment's start time and mix.
const inputs = parts.flatMap((p) => ["-i", p.wav]);
const chains = parts.map((p, i) => `[${i + 1}:a]adelay=${Math.round(p.at * 1000)}|${Math.round(p.at * 1000)}[a${i}]`);
const mix = `${parts.map((_, i) => `[a${i}]`).join("")}amix=inputs=${parts.length}:normalize=0[vo]`;
const voiced = join(OUT, "a11yforge-demo-placeholder-vo.mp4");
ff(["-y", "-i", master, ...inputs,
  "-filter_complex", `${chains.join(";")};${mix}`,
  "-map", "0:v", "-map", "[vo]", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k",
  // No -shortest: the mix ends with the last spoken line, which is BEFORE the video does, so
  // -shortest silently truncated the closing card. Let the video run out and the tail be silent.
  "-movflags", "+faststart", voiced]);

console.log(`\nplaceholder → ${voiced}  (${(statSync(voiced).size / 1048576).toFixed(2)}MB, ${dur(voiced).toFixed(2)}s)`);
console.log(`silent master untouched → ${master}`);
if (badHuman.length) {
  console.log(`\n⛔ ${badHuman.length} segment(s) OVERRUN at ${HUMAN_WPM}wpm — these genuinely need a longer shot or a shorter line: ` +
    badHuman.map((b) => `${b.id} by ${(-b.slackHuman).toFixed(2)}s`).join(", "));
}
if (bad.length) {
  console.log(`\n⚠ ${bad.length} segment(s) overrun at the SAPI rate only: ${bad.map((b) => `${b.id} by ${(-b.slack).toFixed(2)}s`).join(", ")}` +
    `\n  (artifact of the synthetic voice being slow — check the ${HUMAN_WPM}wpm column before changing anything)`);
}
if (tight.length) console.log(`⚠ ${tight.length} segment(s) under 1s of SAPI slack: ${tight.map((b) => b.id).join(", ")}`);
if (!bad.length && !tight.length) console.log("\nevery line fits its shot with >1s of slack, even at the slower SAPI rate");

const totalWords = fit.reduce((a, f) => a + f.words, 0);
writeFileSync(join(OUT, "vo-fit.json"), JSON.stringify({
  note: `Timing check at two rates. SAPI is what the placeholder track actually sounds like (it reads slow, ` +
        `often 105-120wpm). HUMAN is the ${HUMAN_WPM}wpm pace VOICEOVER.md is written to and is the one to ` +
        `act on: slackHuman < 0 means the shot is genuinely too short or the line too long.`,
  humanWpm: HUMAN_WPM,
  totalWords,
  cutSeconds: cut.seconds,
  spokenFractionAtHumanWpm: +((totalWords / HUMAN_WPM) * 60 / cut.seconds).toFixed(3),
  segments: fit,
}, null, 2) + "\n");
