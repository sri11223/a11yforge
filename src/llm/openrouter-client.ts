import OpenAI from "openai";
import type { z } from "zod";
import {
  hashRequest,
  readCassette,
  resolveMode,
  writeCassette,
  type CassetteKeyInput,
} from "./cassette.js";

/**
 * OpenRouter client (OpenAI-compatible). Deterministic by construction:
 * temperature=0 and a fixed seed. The fixer and judge use DIFFERENT model
 * families (FIXER_MODEL vs JUDGE_MODEL) to reduce correlated bias — see
 * docs/BRAINSTORM.md §3. All calls route through the cassette layer so the
 * reproducible eval runs offline in replay mode.
 */

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const FIXED_SEED = 42;
const TEMPERATURE = 0;

export type Role = "fixer" | "judge";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CompleteOptions<T> {
  role: Role;
  messages: ChatMessage[];
  /** Optional zod schema; when provided the JSON response is validated, with bounded reflexion
   *  retries on a parse failure (see complete()). */
  schema?: z.ZodType<T>;
  /** Request a JSON object response (response_format). Does not affect the cassette key. */
  jsonMode?: boolean;
}

function modelFor(role: Role): string {
  const model = role === "fixer" ? process.env.FIXER_MODEL : process.env.JUDGE_MODEL;
  if (!model) {
    throw new Error(
      `Missing ${role === "fixer" ? "FIXER_MODEL" : "JUDGE_MODEL"} env var. See .env.example.`,
    );
  }
  return model;
}

let cachedClient: OpenAI | null = null;
function client(): OpenAI {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY is required for record/live modes. Use A11YFORGE_MODE=replay for offline eval.",
    );
  }
  cachedClient = new OpenAI({ apiKey, baseURL: OPENROUTER_BASE_URL });
  return cachedClient;
}

/** Bounded reflexion retries on a schema-parse failure (total = 1 + this), matching the
 *  verify-loop's max-3 attempt discipline. */
const MAX_SCHEMA_RETRIES = 2;

/**
 * Run a deterministic chat completion. Returns the raw assistant string; if a schema is supplied
 * the JSON reply is validated and returned as T. On a JSON/schema parse failure the parse error is
 * fed back into the prompt and the call is retried up to MAX_SCHEMA_RETRIES times (bounded
 * reflexion), then it throws cleanly. temperature=0 + fixed seed are pinned on every attempt.
 *
 * No-op on replay: a recorded cassette's reply parses on the FIRST attempt, so no retry fires and
 * no extra cassette is consulted — the offline eval stays byte-identical. (The retry appends new
 * messages, which is a new cassette key; those are only recorded in record/auto mode on a genuine
 * live parse failure.)
 */
export async function complete<T = string>(opts: CompleteOptions<T>): Promise<T | string> {
  const model = modelFor(opts.role);
  const mode = resolveMode();

  // One call through the cassette layer for a given message list.
  // "auto" replays an existing cassette and records a live call only when missing.
  const callOnce = async (messages: ChatMessage[]): Promise<string> => {
    const keyInput: CassetteKeyInput = { model, temperature: TEMPERATURE, seed: FIXED_SEED, messages };
    const hash = hashRequest(keyInput);
    const cached = mode === "replay" || mode === "auto" ? readCassette(hash) : null;
    if (mode === "replay" && cached === null) {
      throw new Error(`No cassette for request ${hash} (model=${model}). Re-record with A11YFORGE_MODE=record.`);
    }
    if (cached !== null) return cached;
    const res = await client().chat.completions.create({
      model,
      temperature: TEMPERATURE,
      seed: FIXED_SEED,
      messages,
      ...(opts.jsonMode ? { response_format: { type: "json_object" } } : {}),
    });
    const out = res.choices[0]?.message?.content ?? "";
    if (mode === "record" || mode === "auto") writeCassette(hash, keyInput, out);
    return out;
  };

  if (!opts.schema) return await callOnce(opts.messages);

  let messages = opts.messages;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_SCHEMA_RETRIES; attempt++) {
    const raw = await callOnce(messages);
    try {
      return opts.schema.parse(JSON.parse(raw));
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_SCHEMA_RETRIES) {
        // Reflexion: feed the parse error back and ask for schema-valid JSON only.
        messages = [
          ...messages,
          { role: "assistant", content: raw },
          { role: "user", content: `Your previous reply could not be parsed into the required JSON schema (${(err as Error).message}). Reply with ONLY valid JSON matching the schema — no prose, no markdown fences.` },
        ];
      }
    }
  }
  throw new Error(`schema validation failed after ${MAX_SCHEMA_RETRIES + 1} attempt(s): ${(lastErr as Error).message}`);
}
