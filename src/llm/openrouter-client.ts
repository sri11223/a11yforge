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
  /** Optional zod schema; when provided the JSON response is validated (and retried on mismatch upstream). */
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

/**
 * Run one deterministic chat completion. Returns the raw assistant string; if a
 * schema is supplied the parsed+validated object is returned instead.
 *
 * TODO(step-later): wire schema-violation reflexion retry once agents land.
 */
export async function complete<T = string>(opts: CompleteOptions<T>): Promise<T | string> {
  const model = modelFor(opts.role);
  const keyInput: CassetteKeyInput = {
    model,
    temperature: TEMPERATURE,
    seed: FIXED_SEED,
    messages: opts.messages,
  };
  const hash = hashRequest(keyInput);
  const mode = resolveMode();

  let raw: string;
  // "auto" replays an existing cassette and records a live call only when missing —
  // idempotent and avoids re-spending on already-recorded requests.
  const cached = mode === "replay" || mode === "auto" ? readCassette(hash) : null;
  if (mode === "replay" && cached === null) {
    throw new Error(
      `No cassette for request ${hash} (model=${model}). Re-record with A11YFORGE_MODE=record.`,
    );
  }
  if (cached !== null) {
    raw = cached;
  } else {
    const res = await client().chat.completions.create({
      model,
      temperature: TEMPERATURE,
      seed: FIXED_SEED,
      messages: opts.messages,
      ...(opts.jsonMode ? { response_format: { type: "json_object" } } : {}),
    });
    raw = res.choices[0]?.message?.content ?? "";
    if (mode === "record" || mode === "auto") writeCassette(hash, keyInput, raw);
  }

  if (!opts.schema) return raw;
  return opts.schema.parse(JSON.parse(raw));
}
