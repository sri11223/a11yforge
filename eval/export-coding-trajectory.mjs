import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, resolve, basename } from "node:path";

/**
 * Publishes the CODING-agent build trajectory: the orchestrator/builder loop that wrote this repo.
 *   CODING_SESSION_DIR=<dir with *.jsonl> node eval/export-coding-trajectory.mjs
 *   CODING_SESSION_JSONL=<a.jsonl,b.jsonl> node eval/export-coding-trajectory.mjs
 *
 * WHY THIS SHAPE. The raw session transcripts are ~56 MB of conversation *and* command stdout, and
 * stdout is where the hazard lives: a scan of ours found 2 `sk-*` matches, 133 OPENROUTER_API_KEY
 * mentions, plus `_authToken`, `PRIVATE KEY`, `GITHUB_TOKEN`, `x-api-key` and 74 `npmrc` references,
 * and paths belonging to unrelated third-party projects on the same machine. Publishing that behind
 * a regex deny-list would be unsafe at any level of care, because the deny-list can only remove what
 * it already knows to look for.
 *
 * So this is an ALLOW-LIST, not a deny-list — the same reason our alt path is
 * rule-from-grounding-or-escalate rather than "ask the model nicely":
 *   - orchestrator instructions (user turns) .... included in full; they are conversation, not stdout
 *   - assistant reasoning / summary text ........ included in full; same reason
 *   - tool CALLS ................................ tool name + a short argument summary only
 *   - tool RESULTS .............................. OMITTED ENTIRELY. This is the hazard surface.
 *   - file-content payloads on Edit/Write ....... omitted; the path is kept, the body is not
 *
 * And it FAILS CLOSED: after building the output it re-scans the serialized bytes for every secret
 * pattern plus the local username and third-party project names. One surviving match and it throws
 * having written nothing. It is meant to be structurally incapable of emitting a key.
 */

const REPO = resolve(import.meta.dirname, "..");
// Root-level on purpose: coding-agent disclosure is a required deliverable, so it should be visible
// on opening the repo rather than three directories down.
const OUT = join(REPO, "coding-agent-trajectories");
const ARG_MAX = 400; // per tool-call argument summary

// ── inputs ───────────────────────────────────────────────────────────────────
const files = (() => {
  if (process.env.CODING_SESSION_JSONL) {
    return process.env.CODING_SESSION_JSONL.split(",").map((f) => f.trim()).filter(Boolean);
  }
  const dir = process.env.CODING_SESSION_DIR;
  if (!dir) {
    throw new Error("set CODING_SESSION_DIR (directory of *.jsonl) or CODING_SESSION_JSONL (comma-separated paths)");
  }
  return readdirSync(dir).filter((f) => f.endsWith(".jsonl")).sort().map((f) => join(dir, f));
})();
if (!files.length) throw new Error("no session .jsonl files found");

// ── redaction ────────────────────────────────────────────────────────────────
/**
 * Patterns are used BOTH to redact and, afterwards, to verify. Anything added here is automatically
 * part of the fail-closed check, so the two can never drift apart.
 */
const SECRETS = [
  [/sk-[A-Za-z0-9_-]{20,}/g, "sk-REDACTED"],
  [/gh[pousr]_[A-Za-z0-9]{20,}/g, "REDACTED"],
  [/github_pat_[A-Za-z0-9_]{20,}/g, "REDACTED"],
  [/Bearer\s+[A-Za-z0-9._-]{20,}/g, "Bearer REDACTED"],
  [/-----BEGIN[^-]*PRIVATE KEY-----/g, "REDACTED-PRIVATE-KEY"],
  [/_authToken\s*=\s*\S+/g, "_authToken=REDACTED"],
  [/\b(?:OPENROUTER_API_KEY|ANTHROPIC_API_KEY|GITHUB_TOKEN|GH_TOKEN|AWS_SECRET_ACCESS_KEY|AWS_ACCESS_KEY_ID)\s*[:=]\s*\S+/g,
   (m) => m.split(/[:=]/)[0] + "=REDACTED"],
  [/x-api-key['":\s]+\S+/gi, "x-api-key: REDACTED"],
  // Any long opaque blob sitting next to an API_KEY mention.
  [/API_KEY[^\n]{0,20}?\b[A-Za-z0-9_\-]{32,}\b/g, "API_KEY REDACTED"],
];
/** Local identity and unrelated third-party projects that share this machine. Not ours to publish. */
const PRIVATE = [
  [/C:[\\/]Users[\\/]Srikrishna/gi, "~"],
  [/\/c\/Users\/Srikrishna/gi, "~"],
  [/Srikrishna/gi, "~user"],
  [/SRIKRI~1/gi, "~user"],
  // `pluto-task[s]?` required the suffix, so a bare `pluto` slipped through a whole pass. Match the
  // bare name. CALIBRATION.md is another project's file (not in this repo or its history) — matched
  // WITH the .md suffix so this repo's legitimate kappa-"calibration" prose is untouched.
  // NOTE: this export is self-referential — the audit conversation about it becomes part of the next
  // export's input. Each name mentioned while reviewing has to be added here or it reappears. It
  // converges, but the list must include names that only ever came up during review.
  [/afterexperts|silver-tasks|react-typescript-ui|ecomerce-node|seller-auth-credential-repair|pluto/gi,
   "<unrelated-project>"],
  [/fitplan|odessy|handshakeai|dynamo/gi, "<unrelated-project>"],
  [/CALIBRATION\.md/g, "<unrelated-project-file>"],
];
const redact = (v) => {
  if (typeof v !== "string") return v;
  let s = v;
  for (const [re, to] of SECRETS) s = s.replace(re, to);
  for (const [re, to] of PRIVATE) s = s.replace(re, to);
  return s;
};

// ── extraction ───────────────────────────────────────────────────────────────
/** One short, safe summary of a tool call: what was done to what, never the payload. */
function summariseToolUse(name, input) {
  const i = input && typeof input === "object" ? input : {};
  const pick = (...keys) => {
    for (const k of keys) if (typeof i[k] === "string" && i[k].length) return i[k];
    return "";
  };
  let arg = "";
  switch (name) {
    case "Bash": arg = pick("command"); break;
    case "Read": arg = pick("file_path"); break;
    case "Write": arg = pick("file_path"); break;        // content deliberately dropped
    case "Edit": arg = pick("file_path"); break;         // old/new strings deliberately dropped
    case "NotebookEdit": arg = pick("notebook_path"); break;
    case "Glob": arg = pick("pattern", "path"); break;
    case "Grep": arg = `${pick("pattern")}${i.path ? " in " + i.path : ""}`; break;
    case "WebFetch": arg = pick("url"); break;
    case "WebSearch": arg = pick("query"); break;
    case "Task":
    case "Agent": arg = pick("description", "subagent_type"); break;
    case "TodoWrite": arg = `${(i.todos ?? []).length} items`; break;
    default: arg = pick("file_path", "command", "path", "pattern", "description", "url", "query");
  }
  const truncated = arg.length > ARG_MAX;
  return { arg: redact(truncated ? arg.slice(0, ARG_MAX) + " …" : arg), truncated };
}

const asArray = (c) => (Array.isArray(c) ? c : typeof c === "string" ? [{ type: "text", text: c }] : []);

const sessions = [];
for (const f of files) {
  if (!existsSync(f)) { console.error(`skipping missing ${f}`); continue; }
  const lines = readFileSync(f, "utf8").split("\n").filter((l) => l.trim());
  const turns = [];
  for (const line of lines) {
    let rec;
    try { rec = JSON.parse(line); } catch { continue; }
    const msg = rec.message ?? rec;
    const role = msg.role ?? rec.type;
    if (role !== "user" && role !== "assistant") continue;
    const text = [];
    const calls = [];
    for (const part of asArray(msg.content)) {
      if (part.type === "text" && typeof part.text === "string") text.push(redact(part.text));
      else if (part.type === "tool_use") calls.push({ tool: part.name, ...summariseToolUse(part.name, part.input) });
      // part.type === "tool_result" -> deliberately ignored. The hazard surface.
    }
    if (!text.length && !calls.length) continue;
    turns.push({
      ts: rec.timestamp ?? null,
      role,
      ...(text.length ? { text: text.join("\n\n") } : {}),
      ...(calls.length ? { toolCalls: calls } : {}),
    });
  }
  sessions.push({ file: basename(f), sourceLines: lines.length, turns });
}

// ── counts, derived not asserted ─────────────────────────────────────────────
const all = sessions.flatMap((s) => s.turns);
const byTool = {};
let commits = 0;
for (const t of all) for (const c of t.toolCalls ?? []) {
  byTool[c.tool] = (byTool[c.tool] ?? 0) + 1;
  if (c.tool === "Bash" && /\bgit\s+(-c\s+\S+\s+)?commit\b/.test(c.arg)) commits++;
}
const stamps = all.map((t) => t.ts).filter(Boolean).sort();
const counts = {
  sessions: sessions.length,
  turns: all.length,
  orchestratorInstructions: all.filter((t) => t.role === "user").length,
  builderTurns: all.filter((t) => t.role === "assistant").length,
  toolCalls: Object.values(byTool).reduce((a, b) => a + b, 0),
  toolCallsByTool: Object.fromEntries(Object.entries(byTool).sort((a, b) => b[1] - a[1])),
  gitCommits: commits,
  firstTurn: stamps[0] ?? null,
  lastTurn: stamps[stamps.length - 1] ?? null,
};

// ── FAIL CLOSED ──────────────────────────────────────────────────────────────
const payload = sessions.map((s) => ({
  name: s.file.replace(/\.jsonl$/, "").slice(0, 8) + ".jsonl",
  body: s.turns.map((t) => JSON.stringify(t)).join("\n") + "\n",
}));
const serialized = payload.map((p) => p.body).join("\n") + JSON.stringify(counts);
const survivors = [];
for (const [re] of [...SECRETS, ...PRIVATE]) {
  const m = serialized.match(new RegExp(re.source, re.flags.replace("g", "") + "g"));
  // The replacement tokens themselves are expected; only unreplaced matches count.
  const real = (m ?? []).filter((x) => !/REDACTED|~user|<unrelated-project>|^~$/.test(x));
  if (real.length) survivors.push(`${re} ×${real.length}`);
}
if (survivors.length) {
  throw new Error(
    "REFUSING TO WRITE — secret/identity patterns survived redaction:\n  " + survivors.join("\n  ") +
    "\nNothing was written. Fix the redaction before retrying.",
  );
}

// ── write ────────────────────────────────────────────────────────────────────
mkdirSync(OUT, { recursive: true });
for (const p of payload) writeFileSync(join(OUT, p.name), p.body, "utf8");

const excerpt = (t) => {
  const head = (t.text ?? "").split("\n").filter(Boolean).slice(0, 3).join(" ").slice(0, 260);
  const tools = (t.toolCalls ?? []).slice(0, 4).map((c) => `${c.tool}: ${c.arg.slice(0, 90)}`);
  return { head, tools };
};
const showcase = [];
for (let i = 0; i < all.length - 1 && showcase.length < 4; i++) {
  if (all[i].role === "user" && (all[i].text ?? "").length > 200 && (all[i + 1].toolCalls ?? []).length >= 2) {
    showcase.push({ instruction: excerpt(all[i]), response: excerpt(all[i + 1]) });
    i += 8;
  }
}

writeFileSync(join(OUT, "README.md"), `# Coding-agent trajectory — the two-agent build loop

_Runtime-agent traces: [\`docs/builder-trajectories/\`](../docs/builder-trajectories/) · narrative counterpart: [\`docs/WORK_TRAJECTORY.md\`](../docs/WORK_TRAJECTORY.md) · tool disclosure: [\`docs/CODING_AGENT.md\`](../docs/CODING_AGENT.md)_

**In one sentence:** the complete conversation and tool calls of the two Claude Code (Opus 5) agents
that built this repository — an **orchestrator** that planned and verified, and a **builder** that did
the work.

This is the *coding*-agent deliverable. The agent that **runs** — the one that finds and fixes
accessibility barriers — has its own traces in
[\`docs/builder-trajectories/\`](../docs/builder-trajectories/). This folder is the agents that **built** it.
[\`docs/WORK_TRAJECTORY.md\`](../docs/WORK_TRAJECTORY.md) tells the same story in prose; these files are
the underlying data, so the prose can be checked rather than taken on trust.

## What is in here, and what is deliberately not

Extracted by [\`eval/export-coding-trajectory.mjs\`](../eval/export-coding-trajectory.mjs) on an
**allow-list** basis — fields are copied in by name, rather than raw text being scrubbed on the way
out:

| | |
| --- | --- |
| Orchestrator instructions | **in full.** They are the interesting half and contain no command output. |
| Builder reasoning / summaries | **in full**, same reason. |
| Tool calls | tool name + a short argument summary (path, command, pattern), capped at ${ARG_MAX} chars. |
| **Tool results** | **omitted entirely.** |
| File-content payloads (\`Write\`/\`Edit\` bodies) | **omitted.** The path is kept; the diff body is not. |

**Why results are omitted rather than redacted.** The raw transcripts are ~56 MB of conversation
*and* command stdout. A scan of that stdout found two \`sk-*\` matches, 133 \`OPENROUTER_API_KEY\`
mentions, and a long tail of \`_authToken\`, \`PRIVATE KEY\`, \`GITHUB_TOKEN\`, \`x-api-key\` and 74
\`npmrc\` references — plus filesystem paths belonging to unrelated third-party projects on the same
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

\`\`\`
sk-[A-Za-z0-9_-]{20,}        0     -----BEGIN ... PRIVATE KEY   0
gh[pousr]_[A-Za-z0-9]{20,}   0     _authToken=<value>           0
github_pat_[A-Za-z0-9_]{20,} 0     x-api-key: <value>           0
Bearer [A-Za-z0-9._-]{20,}   0     local username               0
API_KEY=<value>              0     unrelated project names      0
\`\`\`

**Why the exclusion is structural, not a scrub.** \`tool_result\` bodies are never copied in the first
place. That is where credentials and unrelated-project data live — the raw session records carry an
API key in the stdout of a command that echoed it, 133 \`OPENROUTER_API_KEY\` mentions, and a tail of
\`_authToken\`, \`PRIVATE KEY\`, \`GITHUB_TOKEN\` and \`npmrc\` references. A regex deny-list over that
text can only remove what it already knows to look for. An allow-list of copied fields cannot emit
what it never read. It is the same reasoning as this project's alt path, which routes semantic alt to
a deterministic rule or a human rather than asking a model not to hallucinate: don't sanitise
dangerous input, never admit it.

Any string still matching a secret pattern in these files is **our own security discussion** — the
instruction that named the patterns and the reply that refused to publish the raw transcripts. Those
are pattern names, not values.

## Counts (derived at export time, not asserted)

\`\`\`json
${JSON.stringify(counts, null, 2)}
\`\`\`

## How to read a record

One JSON object per line:

\`\`\`json
{"ts":"2026-08-29T…Z","role":"user","text":"the orchestrator's instruction, in full"}
{"ts":"2026-08-29T…Z","role":"assistant","text":"the builder's reasoning","toolCalls":[
  {"tool":"Bash","arg":"npm test","truncated":false},
  {"tool":"Edit","arg":"src/agents/advanced.ts","truncated":false}]}
\`\`\`

\`role: "user"\` is the **orchestrator** — it planned, sent one step at a time, and verified each
result against the real files. \`role: "assistant"\` is the **builder** — it did the work in the repo.
\`arg\` is the command, path or pattern; \`truncated\` marks the few that exceeded ${ARG_MAX} characters.

## Signposted highlights

Jump straight to the loop working. Line numbers are into \`23af0c63.jsonl\`, the main session.

| Line | What to look for |
| --- | --- |
| **~95** | **The Layer-A \`heading-skip\` self-catch.** A probe found that pa11y flags heading-skip only as a *warning* and axe's rule is *best-practice* — including them would also have flagged two Layer-B-exclusive pages and broken the gap proof. The builder reported the deviation instead of taking the flattering option; the criterion was reclassified A→B. |
| **~576, ~625** | **The silently-disabled virtual screen reader.** Layer B's SR had been inert since it was written, from a wrong module-resolve path. Found late, fixed, and then *proved* the metrics were byte-identical afterwards — so the fix moved no number and the finding could be published without re-measuring. |
| **~3046** | **Removing the LLM alt path.** An early router sent semantic alt to the model, which confidently invented descriptions for images it could not see. The path was deleted rather than tuned, and alt became rule-from-grounding-or-escalate. |
| **~3222, ~3311** | **The harm number partly deconstructed.** The builder traced 3 of the 8 headline harmful changes to a *blind oracle* — a live-region check that only clicks real \`<button>\` elements — and published the sensitivity analysis rather than leaving it to be found. |
| **~3359** | **The builder refuses its own orchestrator.** Told to publish the raw 56 MB transcripts behind a regex deny-list, it scanned first, found the orchestrator's own numbers wrong (2 \`sk-*\` matches, not 1; 133 \`API_KEY\` mentions, not 75), found a tail of \`_authToken\`/\`PRIVATE KEY\`/\`GITHUB_TOKEN\` the patterns missed, and found third-party project paths that were not the user's to publish — then declined, with evidence, and proposed this allow-list instead. The orchestrator agreed it had been wrong. |

## Files

${payload.map((p) => {
  const s = sessions.find((x) => x.file.startsWith(p.name.replace(".jsonl", "")));
  return `- [\`${p.name}\`](${p.name}) — ${s.turns.length} turns extracted from ${s.sourceLines} source records`;
}).join("\n")}

One JSON object per line: \`{ts, role, text?, toolCalls?}\`. \`role: "user"\` is the orchestrator,
\`role: "assistant"\` is the builder.

## The loop, in its own words

${showcase.map((x, n) => `**${n + 1}. Orchestrator:** ${x.instruction.head}

**Builder:** ${x.response.head || "_(acted directly)_"}
${x.response.tools.length ? "\n" + x.response.tools.map((t) => `- \`${t}\``).join("\n") : ""}`).join("\n\n---\n\n")}
`, "utf8");

console.log(`wrote ${OUT}`);
console.log(`  ${counts.sessions} session(s) · ${counts.turns} turns · ${counts.toolCalls} tool calls · ${counts.gitCommits} commits`);
console.log(`  tool-result bodies omitted; ${survivors.length} secret patterns survived redaction (must be 0)`);
