# Read-along script — one continuous take

For reading on a phone while the video plays on a laptop.
Video: **[`video/a11yforge-demo.mp4`](../video/a11yforge-demo.mp4)** — the narrated cut, **4:41.2**.
The timecodes below are the ones this narration was read against (the silent cut was 4:39.7; the end
card is held 1.5s longer in the narrated version so the closing line has room to land).

**Before you start:** start the recorder **first**, then hit play, and say nothing for the first
second. That silent gap is my sync point — I align your first word to 0:00 and everything after it
lands automatically.

**Two rules that matter more than delivery:**
1. **Don't fill the silences.** The script is 632 words over 4:40 — about 88% of the runtime. The gaps
   are where the Tab presses land and the circles get drawn. If you talk through them you'll run ahead
   and drift for the rest of the take.
2. **Read it flat.** Every number is already on screen with its caveat while you say it. You're
   confirming, not selling.

**⟨slow⟩** = slow down. All four are limitation statements — rushing them makes a finding sound like a
disclaimer. **⟨skip if long⟩** = drop it if you're behind; the visual reads without it.

If you lose your place: pause the video, find the timecode, carry on. I can stitch across a pause.

---

### 0:00 — the trap page

Every automated scanner passes this page. A keyboard user cannot get out of this dialog.

*…now stay silent about six seconds while the Tab presses run…*

Six presses of Tab, and focus never leaves. Escape does nothing. The close control is a span, not focusable. ⟨slow⟩ A scanner never presses a key.

### 0:24 — who and how widespread

This is how most of the web behaves for people who navigate by keyboard or screen reader.

### 0:32 — the answer, up front

So we built an agent that fixes issues like this, and refuses to ship a fix it cannot verify.

The single-shot baseline ships eight harmful changes. Ours ships zero.

### 0:48 — why a scanner can't see it

Here is why a scanner can't catch it. Sighted, these plans read Starter, Team, Enterprise. In the order a screen reader announces them, they land three, one, two. The markup is valid, so no rule fires.

### 1:05 — three layers

Three layers, not one. Mechanical scanners. A screen-reader and accessibility-tree layer for traps and reading order. And a calibrated judge for whether a label means anything.

### 1:19 — the hard part

⟨slow⟩ The hard part isn't generating a fix. It's proving the fix is usable, and knowing when to refuse.

So every fix runs one loop: route, attempt, gate, then re-verify all three layers. Accept, escalate, or feed the diagnostic back and try again.

### 1:38 — the gate firing

Here is that gate firing. The scanner reports clean. The audit reports three issues it cannot see, and exits non-zero. ⟨skip if long⟩ That exit code is the whole product in one line.

### 1:55 — the refusal

Four generic alt attributes. Three the agent fixed from text already on the page.

The fourth has nothing to ground a description in, so it refuses, and routes it to a human.

### 2:13 — what a user actually hears

This is what a blind user hears, before and after. Before, five fields read out their placeholder, which vanishes the moment you type, and is not a name. After, every field has a real one. Nothing was invented.

### 2:34 — the proof *(this beat is 80 seconds — take the pauses)*

This is the report in the repository. Nothing from here is retyped for the camera.

Of the pages a scanner calls clean, almost all still fail a deeper layer, and the caveat sits on the same line: this corpus was built adversarially.

Each layer earns its place. Twenty-three, nine, zero.

Harmful changes: eight, to zero. And no counter-examples anywhere in forty-five pages.

⟨slow⟩ We recomputed the confidence intervals ourselves. They overlap slightly, so the count is the stronger claim.

Every issue we forgo is accounted for, against a baseline that declines none.

⟨slow⟩ And we publish the row that goes against us. On coverage, the significant result favours the baseline — it fixes more than we do, because we escalate rather than guess. Our significance on harm rests on one extra page.

The judge is calibrated at kappa nought point nine eight, on a single-annotator anchor set: a calibration check, not a reliability study.

⟨skip if long⟩ And in the wild, two hundred and six barriers a scanner cannot see — one site contributes sixty-five, so we publish that too.

### 3:53 — how it was built

The change that mattered most wasn't the model — it was Layer B, the screen-reader layer.

⟨slow⟩ And the discipline we hold the agent to is the discipline we built it with.

### 4:10 — why you can believe it

Run the evaluation three times: identical bytes. No API key — a hundred and fifty-one committed transcripts, replayed offline, reproduced from a fresh clone.

### 4:22 — close

That non-zero exit is what the Action turns into a failed check, so a false green doesn't merge.

The FTC fined a vendor a million dollars for claiming automation achieves compliance. We built the part that checks.

---

## Pronunciation

- **pa11y** → "pally"
- **axe-core** → "axe core"
- **kappa** → the script already spells the number out: "nought point nine eight"
- **WCAG** → never spoken; it's only on screen

## If you finish early or late

Finishing **early** is correct and expected — the silences are deliberate. Finishing **late** means you
filled them; drop the two ⟨skip if long⟩ lines and you'll recover about eight seconds.

Send me the audio file and I'll align it, normalise the levels, and check every beat for drift.
