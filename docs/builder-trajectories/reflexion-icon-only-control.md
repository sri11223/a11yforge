# Reflexion trace — `icon-only-control` (real model I/O)

An end-to-end "instructions → result" trace for one runtime fix, quoting the **actual fixer prompt
and the model's returned HTML** from the committed cassettes (offline-replayable raw model I/O).
This is the reflexion loop that the summary in [`icon-only-control.md`](icon-only-control.md)
records at a glance (attempt 1 REJECT → attempt 2 ACCEPT).

Target finding (Layer B, from the detector):

> `[2.1.1]` Element behaves as a control (`role="button"`) but is not keyboard-focusable
> (no tabindex), so keyboard/screen-reader users cannot reach it. — selector
> `body > main > div:nth-of-type(1) > div:nth-of-type(3)`

Fixer model: `anthropic/claude-sonnet-5`, temperature 0, seed 42.

---

## The instruction (system prompt — identical every attempt)

> You are an expert web accessibility engineer. Fix ONLY the single issue described below and
> change as little else as possible. Preserve all visible text, controls, and images — never
> delete, hide, or empty content to satisfy a checker. Return the COMPLETE corrected HTML document
> only — no explanation, no markdown fences.

## Attempt 1 — cassette [`e30faa91…`](../../cassettes/e30faa91a83868f2d440a27d7d9b6ef56a1d1a2e39756d18ee864a64ef2794e8.json)

The model made the control focusable by adding `tabindex="0"` — but added **no keyboard
activation handler**, so Enter/Space still don't operate it. The returned control:

```html
<div class="icon-btn" role="button" tabindex="0" aria-label="Play Ceremony by The Silver Lines" onclick="play(this)">&#9654;</div>
```

**Verify (Layer B re-scan) → REJECT.** The behavioral check still flags the control: focusable is
not the same as *operable*. The diagnostic is fed back into the next attempt.

## Attempt 2 — cassette [`82b4c29e…`](../../cassettes/82b4c29e7ad277b323306df3af2ffd6ad6ac6900523acb1fa4a4b6eb555e9922.json)

The retry prompt appends the automated verifier's feedback verbatim:

> Your previous attempt was rejected by automated verification:
> **The target issue is still present after your change.**
> Address this in the corrected HTML.

The model now adds an Enter/Space `onkeydown` handler alongside the tabindex. The returned control:

```html
<div class="icon-btn" role="button" tabindex="0" aria-label="Play Ceremony by The Silver Lines"
     onclick="play(this)"
     onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();play(this);}">
```

**Verify (Layer B re-scan) → ACCEPT.** The control is now keyboard-reachable *and* operable; no
new findings. Committed.

---

**Why this matters:** a single-shot agent would have shipped attempt 1 — `tabindex="0"` looks like
a fix and passes a casual glance (and axe, which never saw a violation here to begin with). The
verify-loop re-checked against the screen-reader/keyboard layer, caught that "focusable ≠
operable", and fed the failure back so the model could correct itself. Raw prompts + responses are
in the two linked cassettes; replay them offline with `A11YFORGE_MODE=replay`.
