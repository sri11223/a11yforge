# Coding-agent trajectory — the two-agent build loop

_[← all traces](../README.md) · narrative counterpart: [`WORK_TRAJECTORY.md`](../../WORK_TRAJECTORY.md) · tool disclosure: [`CODING_AGENT.md`](../../CODING_AGENT.md)_

This is the machine-extracted record of the agents that **built this repo**, as opposed to the
runtime agent that fixes pages (whose traces are the other files in [`../`](../)). Two Claude Code
sessions ran the build as a loop: an **orchestrator** holding the plan and verifying each result, and
a **builder** doing the work in the repo. `WORK_TRAJECTORY.md` tells that story in prose; this is the
underlying data, so the prose can be checked rather than taken on trust.

## What is in here, and what is deliberately not

Extracted by [`eval/export-coding-trajectory.mjs`](../../../eval/export-coding-trajectory.mjs) on an
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
  "turns": 3402,
  "orchestratorInstructions": 169,
  "builderTurns": 3233,
  "toolCalls": 1969,
  "toolCallsByTool": {
    "Bash": 1074,
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
  "gitCommits": 73,
  "firstTurn": "2026-08-28T18:33:56.300Z",
  "lastTurn": "2026-08-31T17:22:48.845Z"
}
```

## Files

- [`23af0c63.jsonl`](23af0c63.jsonl) — 3398 turns extracted from 12305 source records
- [`3d7683a8.jsonl`](3d7683a8.jsonl) — 2 turns extracted from 12 source records
- [`405680cd.jsonl`](405680cd.jsonl) — 2 turns extracted from 11 source records

One JSON object per line: `{ts, role, text?, toolCalls?}`. `role: "user"` is the orchestrator,
`role: "assistant"` is the builder.

## The loop, in its own words


