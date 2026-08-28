import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Record/replay cassettes for LLM calls — the backbone of reproducibility.
 *
 * Every LLM request is hashed (model + messages + temperature + seed) and its
 * response persisted to cassettes/<hash>.json. In replay mode (the default) the
 * eval reads recorded responses and never touches the network, so results are
 * byte-for-byte deterministic and need no API key. In record mode live calls are
 * saved for later replay. See docs/BRAINSTORM.md §7.
 */

export type CassetteMode = "replay" | "record" | "live";

export interface CassetteKeyInput {
  model: string;
  temperature: number;
  seed: number;
  messages: unknown;
}

const CASSETTE_DIR = join(process.cwd(), "cassettes");

/** Deterministic SHA-256 of the exact request payload. */
export function hashRequest(input: CassetteKeyInput): string {
  const canonical = JSON.stringify({
    model: input.model,
    temperature: input.temperature,
    seed: input.seed,
    messages: input.messages,
  });
  return createHash("sha256").update(canonical).digest("hex");
}

function cassettePath(hash: string): string {
  return join(CASSETTE_DIR, `${hash}.json`);
}

/** Load a recorded raw response string, or null if none exists. */
export function readCassette(hash: string): string | null {
  const path = cassettePath(hash);
  if (!existsSync(path)) return null;
  const parsed = JSON.parse(readFileSync(path, "utf8")) as { response: string };
  return parsed.response;
}

/** Persist a raw response string keyed by request hash. */
export function writeCassette(hash: string, request: CassetteKeyInput, response: string): void {
  if (!existsSync(CASSETTE_DIR)) mkdirSync(CASSETTE_DIR, { recursive: true });
  writeFileSync(
    cassettePath(hash),
    JSON.stringify({ request, response }, null, 2),
    "utf8",
  );
}

export function resolveMode(): CassetteMode {
  const raw = (process.env.A11YFORGE_MODE ?? "replay").toLowerCase();
  if (raw === "record" || raw === "live" || raw === "replay") return raw;
  return "replay";
}
