# Traces for every agent we used

A11yForge involves several agents; this is the one place to see the complete trace picture.

## 1. Runtime agent — the advanced remediation agent

Per-page decision traces: **detect** (A/B/C tool output) → **route** → **fix attempt(s)** →
**regression guard** → **verify** → **accept/escalate** → **outcome**. Readable Markdown + machine
JSONL per page:

- [`icon-only-control`](icon-only-control.md) — true-fix, true-fix
- [`alt-generic`](alt-generic.md) — true-fix, needs-review, true-fix, true-fix
- [`keyboard-trap-modal`](keyboard-trap-modal.md) — true-fix, true-fix, true-fix

**JSONL schema:** a `task` event (detected issues), one `fix` event per finding
(`target`, `strategy`, `iterations[]` with attempt/action/regressionGuard/verify/decision,
`outcome`, `memoryHit`), and a `result` event (`reviewQueue`, `memoryHits`, outcome tally).

**Deep dives — real model I/O, quoted from the committed cassettes:**
- **Reflexion** — [reflexion-icon-only-control.md](reflexion-icon-only-control.md): a Layer-B fix
  REJECTED on attempt 1, ACCEPTED on attempt 2 after the verifier's diagnostic is fed back.
- **Baseline vs advanced** — [contrast-alt-generic.md](contrast-alt-generic.md): the baseline ships
  a confident hallucinated alt; the advanced agent escalates instead of guessing.

## 2. Runtime LLMs — the raw model traces (`cassettes/`)

Every fixer/judge call is recorded to a content-hashed cassette under
[`../../cassettes/`](../../cassettes) (151 files): the exact request
`{model, temperature, seed, messages}` and the model's `response`. **These ARE the raw model
I/O** — the whole evaluation replays from them offline (`A11YFORGE_MODE=replay`, no API key).
Fixer = `anthropic/claude-sonnet-5`; judge = `openai/gpt-4o-mini` (different families).

## 3. Coding agents — how the repo was built

- [../WORK_TRAJECTORY.md](../WORK_TRAJECTORY.md) — the two-agent (orchestrator + builder) build trace,
  step by step, each backed by a commit.
- [../CODING_AGENT.md](../CODING_AGENT.md) — coding-agent + tool disclosure, and the honest
  experiments we tried and removed.
