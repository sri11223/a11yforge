# Demo video pipeline

Records, encodes and cuts the A11yForge demo. Everything is real capture — Playwright drives a real
Chromium, target pages load from disk unmodified, and there is no generative video anywhere.

```bash
node video/record.mjs 02-hook        # record one segment  → out/video/raw/02-hook.webm
node video/encode.mjs                # encode all raw      → out/video/seg/*.mp4
node video/encode.mjs cut judge      # join the primary cut → out/video/a11yforge-demo.mp4
node video/encode.mjs cuts           # build all five cuts + manifest
node video/sync-vo-times.mjs         # re-derive the script's timecodes from the manifest
node video/vo-placeholder.mjs        # scratch narration + a timing fit-check
```

## Layout

| file | role |
| --- | --- |
| `lib/stage.mjs` | the shared visual identity: framed window, captions, cursor, and the presenter annotation layer (hand-drawn circle, arrow, underline swipe, spotlight, zoom-to-region, numbered chips) |
| `record.mjs` | segments 01–02, plus `openStage`/`finish` and the geometry helpers every segment uses |
| `segments-b.mjs` | 03 reading order, 04 live terminal, 07 narration diff |
| `segments-c.mjs` | 00 funnel, 05 architecture, 06 escalation, 08 the guided tour of `report.html`, 09 determinism, 10 CI gate + close |
| `encode.mjs` | delivery encode + the five named cuts |
| `sync-vo-times.mjs` | re-derives every timing number in `VOICEOVER.md` from the built manifest |
| `vo-placeholder.mjs` | Windows-SAPI scratch track, and the shot-vs-spoken fit check |

## Rules these scripts enforce

**Nothing on screen is invented.** Text shots read committed artifacts at record time — `realFile()`
throws rather than let a segment degrade to prose if its source is missing. The terminal segment runs
`npm run audit` live while the frame records, so what you see is provably that run's output,
including its exit code. Numbers in the diagram segments are read from `ablation.json`.

**The corpus is never modified.** Target pages are loaded into an iframe and the window chrome is
drawn *around* them. One changed byte in `corpus/` would alter the findings and void the determinism
proof. The single exception is the high-contrast focus ring injected in `02-hook` so the real focus
position is visible on camera — it changes how focus is *drawn*, not where it is, and the caption on
screen says it was added.

**Annotations point; they never restate.** A circle is drawn around a number the committed file
already renders. Where a caption names a word, the annotation is anchored to that word by text match
rather than by index, so an edit to the report can't leave the circle contradicting the caption.

**Geometry is measured, not guessed.** `focusOn()` scrolls a target into view *before* measuring
(`boundingBox()` does not scroll — measuring without it draws annotations onto blank background), and
`glyphBox()` measures rendered text via a `Range` so an ellipse hugs the digits instead of the
block's whitespace. Both survive an active stage zoom.

**Mechanism is not an observed result.** The closing shot renders what the GitHub Action reports when
the gate fails, and says on screen that it is our own rendering of `.github/workflows/a11y.yml` driven
by real local output. It deliberately does not imitate GitHub's check UI: the workflow has never
executed (every run on `main` is billing-blocked with jobs that never start), so a card that looked
like a screenshot would assert a run we have never observed.

**Windows are sized to their content.** `fitWindow()` shrinks a text-panel window to the height the
card actually occupies and re-centres it — a two-row card left in a full-height window holds several
hundred pixels of empty frame for the whole shot.

**Timings are derived, not typed.** `sync-vo-times.mjs` regenerates the script's timecodes, cut
duration, word count and spoken-fraction from `manifest.json` and `vo-fit.json`. They went stale twice
when shots were lengthened, which would have had a reader cueing lines against a cut that no longer
existed.

**If a shot cannot be filmed honestly, the shot changes — never the artifact.**

## Cuts

Five cuts are re-edits of the same verified segments, so a segment fixed once is fixed everywhere and
every cut inherits the same guarantees. `judge` is the primary. See `out/video/manifest.json` for
durations, per-cut timelines, and which file to submit.

## Note on the scratch narration

`vo-placeholder.mjs` renders a synthetic voice purely so pacing can be judged before a human read
exists, and writes its own fit check (`out/video/vo-fit.json`) flagging any segment where the line
does not fit the shot. The silent master is the deliverable; the voiced file is named
`*-placeholder-vo.mp4` and the manifest says not to submit it.

The fit check reports **two** rates. SAPI reads several sections at 105–120 wpm, well under the ~140
a human hits, so judging fit on the synthetic rate alone condemns shots a real read sits inside
comfortably. `slackHuman` is the column to act on; `slack` is only what you can hear in the
placeholder. Where a shot did need more room it was lengthened on a **hold**, never by speeding up
the read — the pace is doing work, particularly on the three `[SLOW]` limitation statements.
