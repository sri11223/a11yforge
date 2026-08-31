# Coding-agent trajectory — the two-agent build loop

_Runtime-agent traces: [`docs/builder-trajectories/`](../docs/builder-trajectories/) · narrative counterpart: [`docs/WORK_TRAJECTORY.md`](../docs/WORK_TRAJECTORY.md) · tool disclosure: [`docs/CODING_AGENT.md`](../docs/CODING_AGENT.md)_

**In one sentence:** the complete conversation and tool calls of the two Claude Code (Opus 5) agents
that built this repository — an **orchestrator** that planned and verified, and a **builder** that did
the work.

This is the *coding*-agent deliverable. The agent that **runs** — the one that finds and fixes
accessibility barriers — has its own traces in
[`docs/builder-trajectories/`](../docs/builder-trajectories/). This folder is the agents that **built** it.
[`docs/WORK_TRAJECTORY.md`](../docs/WORK_TRAJECTORY.md) tells the same story in prose; these files are
the underlying data, so the prose can be checked rather than taken on trust.

## What is in here, and what is deliberately not

Extracted by [`eval/export-coding-trajectory.mjs`](../eval/export-coding-trajectory.mjs) on an
**allow-list** basis — fields are copied in by name, rather than raw text being scrubbed on the way
out:

| | |
| --- | --- |
| Orchestrator instructions | **in full.** They are the interesting half and contain no command output. |
| Builder reasoning / summaries | **in full**, same reason. |
| Tool calls | tool name + a short argument summary (path, command, pattern), capped at 400 chars. |
| **Tool results** | **omitted entirely.** |
| File-content payloads (`Write`/`Edit` bodies) | **omitted.** The path is kept; the diff body is not. |

**Why results are omitted rather than redacted.** The raw transcripts are ~56 MB of conversation
*and* command stdout. A scan of that stdout found two `sk-*` matches, 133 `OPENROUTER_API_KEY`
mentions, and a long tail of `_authToken`, `PRIVATE KEY`, `GITHUB_TOKEN`, `x-api-key` and 74
`npmrc` references — plus filesystem paths belonging to unrelated third-party projects on the same
machine, which are not ours to publish. A regex deny-list can only remove what it already knows to
look for, so it is the wrong safety boundary for an irreversible push to a public repo. The same
reasoning as our alt path: don't scrub dangerous input, never admit it.

Secrets, the local username and unrelated project names are additionally redacted in what *is*
included, and the exporter **re-scans its own output and refuses to write anything** if a single
pattern survives. It is meant to be structurally incapable of emitting a credential.

## Redaction, verified rather than asserted

The exporter re-scans its own serialized output for every pattern in its redaction list — secrets,
the local username, and unrelated project names — and **throws without writing anything** if a single
one survives. These gates all returned zero on the export that produced the files in this folder:

```
sk-[A-Za-z0-9_-]{20,}        0     -----BEGIN ... PRIVATE KEY   0
gh[pousr]_[A-Za-z0-9]{20,}   0     _authToken=<value>           0
github_pat_[A-Za-z0-9_]{20,} 0     x-api-key: <value>           0
Bearer [A-Za-z0-9._-]{20,}   0     local username               0
API_KEY=<value>              0     unrelated project names      0
```

**Why the exclusion is structural, not a scrub.** `tool_result` bodies are never copied in the first
place. That is where credentials and unrelated-project data live — the raw session records carry an
API key in the stdout of a command that echoed it, 133 `OPENROUTER_API_KEY` mentions, and a tail of
`_authToken`, `PRIVATE KEY`, `GITHUB_TOKEN` and `npmrc` references. A regex deny-list over that
text can only remove what it already knows to look for. An allow-list of copied fields cannot emit
what it never read. It is the same reasoning as this project's alt path, which routes semantic alt to
a deterministic rule or a human rather than asking a model not to hallucinate: don't sanitise
dangerous input, never admit it.

Any string still matching a secret pattern in these files is **our own security discussion** — the
instruction that named the patterns and the reply that refused to publish the raw transcripts. Those
are pattern names, not values.

## Counts (derived at export time, not asserted)

```json
{
  "sessions": 3,
  "turns": 3417,
  "orchestratorInstructions": 170,
  "builderTurns": 3247,
  "toolCalls": 1978,
  "toolCallsByTool": {
    "Bash": 1083,
    "Edit": 291,
    "Write": 170,
    "Read": 158,
    "mcp__ccd_session_mgmt__send_message": 76,
    "TaskUpdate": 69,
    "TaskCreate": 44,
    "mcp__Claude_Browser__preview_eval": 24,
    "mcp__Claude_Browser__preview_start": 14,
    "mcp__Claude_Browser__preview_stop": 13,
    "SendUserFile": 10,
    "TaskStop": 9,
    "Grep": 7,
    "WebFetch": 4,
    "TaskOutput": 2,
    "mcp__Claude_Browser__preview_screenshot": 1,
    "mcp__Claude_Browser__preview_click": 1,
    "AskUserQuestion": 1,
    "SendMessage": 1
  },
  "gitCommits": 74,
  "firstTurn": "2026-08-28T18:33:56.300Z",
  "lastTurn": "2026-08-31T17:28:56.091Z"
}
```

## How to read a record

One JSON object per line:

```json
{"ts":"2026-08-29T…Z","role":"user","text":"the orchestrator's instruction, in full"}
{"ts":"2026-08-29T…Z","role":"assistant","text":"the builder's reasoning","toolCalls":[
  {"tool":"Bash","arg":"npm test","truncated":false},
  {"tool":"Edit","arg":"src/agents/advanced.ts","truncated":false}]}
```

`role: "user"` is the **orchestrator** — it planned, sent one step at a time, and verified each
result against the real files. `role: "assistant"` is the **builder** — it did the work in the repo.
`arg` is the command, path or pattern; `truncated` marks the few that exceeded 400 characters.

## Signposted highlights

Jump straight to the loop working. Line numbers are into `23af0c63.jsonl`, the main session.

| Line | What to look for |
| --- | --- |
| **~95** | **The Layer-A `heading-skip` self-catch.** A probe found that pa11y flags heading-skip only as a *warning* and axe's rule is *best-practice* — including them would also have flagged two Layer-B-exclusive pages and broken the gap proof. The builder reported the deviation instead of taking the flattering option; the criterion was reclassified A→B. |
| **~576, ~625** | **The silently-disabled virtual screen reader.** Layer B's SR had been inert since it was written, from a wrong module-resolve path. Found late, fixed, and then *proved* the metrics were byte-identical afterwards — so the fix moved no number and the finding could be published without re-measuring. |
| **~3046** | **Removing the LLM alt path.** An early router sent semantic alt to the model, which confidently invented descriptions for images it could not see. The path was deleted rather than tuned, and alt became rule-from-grounding-or-escalate. |
| **~3222, ~3311** | **The harm number partly deconstructed.** The builder traced 3 of the 8 headline harmful changes to a *blind oracle* — a live-region check that only clicks real `<button>` elements — and published the sensitivity analysis rather than leaving it to be found. |
| **~3359** | **The builder refuses its own orchestrator.** Told to publish the raw 56 MB transcripts behind a regex deny-list, it scanned first, found the orchestrator's own numbers wrong (2 `sk-*` matches, not 1; 133 `API_KEY` mentions, not 75), found a tail of `_authToken`/`PRIVATE KEY`/`GITHUB_TOKEN` the patterns missed, and found third-party project paths that were not the user's to publish — then declined, with evidence, and proposed this allow-list instead. The orchestrator agreed it had been wrong. |

## Files

- [`23af0c63.jsonl`](23af0c63.jsonl) — 3413 turns extracted from 12352 source records
- [`3d7683a8.jsonl`](3d7683a8.jsonl) — 2 turns extracted from 12 source records
- [`405680cd.jsonl`](405680cd.jsonl) — 2 turns extracted from 11 source records

One JSON object per line: `{ts, role, text?, toolCalls?}`. `role: "user"` is the orchestrator,
`role: "assistant"` is the builder.

## The loop, in its own words


