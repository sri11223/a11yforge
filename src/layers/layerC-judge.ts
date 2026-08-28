import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import type { Finding, Verdict } from "../types.js";
import { VerdictSchema } from "../types.js";
import { complete, type ChatMessage } from "../llm/openrouter-client.js";

/**
 * Layer C — semantic, the meaningfulness layer. Judges ONLY whether alt text /
 * accessible names are semantically meaningful (never mechanical=A or behavioral=B).
 *
 * Two tiers (see docs/BRAINSTORM.md §3):
 *  1. DETERMINISTIC BACKSTOPS (pure functions over the HTML via cheerio, no LLM):
 *     generic-word alt, filename-as-alt, informative-image emptied to alt="",
 *     decorative description that should be empty, alt duplicating adjacent text,
 *     and aria-label contradicting the visible label. These keep gap% and
 *     false-fix alive even if the judge is weak, and are fully testable offline.
 *  2. LLM JUDGE on top for nuance regex can't do ("a person" vs "a barista holding
 *     a latte"): zod-constrained Verdict, temperature 0, a DIFFERENT model family
 *     than the fixer. κ-gated: >=0.6 hard gate, 0.4-0.6 advisory, <0.4 backstops-only.
 */

// ---- deterministic backstops (pure, offline) ------------------------------

const GENERIC_WORDS = new Set([
  "image", "photo", "picture", "pic", "img", "graphic", "icon", "logo",
  "thumbnail", "banner", "avatar", "placeholder", "untitled", "photo of an image",
]);
const FILENAME_RE =
  /\.(jpe?g|png|gif|svg|webp|avif|bmp)$/i;
const FILENAME_PREFIX_RE = /^(img|dsc|photo|pic|screenshot|image|scan)[ _-]?\d+/i;
const DECORATIVE_RE =
  /\b(decorative|decoration|ornament|ornamental|flourish|divider|separator|swirl|swoosh|texture|gradient\s+bar|corner\s+decoration|dots\s+pattern|wave\s+shape\s+divider|sparkle|shadow\s+gradient|spacer)\b/i;
const INFORMATIVE_SRC_RE = /chart|graph|plot|diagram|figure|infographic|map|emission|revenue|data/i;

export type BackstopCategory = "generic" | "wrong" | "decorative-misuse";

interface RawC {
  selector: string;
  wcag: string;
  message: string;
  source: "backstop" | "llm-judge";
  category: string;
  rule?: string;
}

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function imgSelector($: cheerio.CheerioAPI, el: AnyNode): string {
  const src = $(el).attr("src");
  if (src) return `img[src="${src}"]`;
  return "img";
}

function controlSelector($: cheerio.CheerioAPI, el: AnyNode): string {
  const id = $(el).attr("id");
  if (id) return `#${id}`;
  const tag = (el as { tagName?: string }).tagName ?? "*";
  return tag;
}

/**
 * Run the deterministic backstops over raw HTML. Pure and offline — no browser,
 * no LLM. This is the backbone of the finding (gap% / false-fix) survives a weak judge.
 */
export function deterministicBackstops(html: string): Finding[] {
  const $ = cheerio.load(html);
  const raw: RawC[] = [];

  $("img[alt]").each((_i, el) => {
    const alt = $(el).attr("alt") ?? "";
    const trimmed = alt.trim();
    const selector = imgSelector($, el);
    const src = $(el).attr("src") ?? "";
    const inFigure = $(el).closest("figure").length > 0;

    // 1. filename-as-alt
    if (trimmed && (FILENAME_RE.test(trimmed) || FILENAME_PREFIX_RE.test(trimmed))) {
      raw.push({
        selector, wcag: "1.1.1", source: "backstop", category: "wrong", rule: "filename-as-alt",
        message: `Alt text is a file name ("${trimmed}"), which conveys nothing to a screen-reader user.`,
      });
      return;
    }
    // 2. generic vacuous word
    if (trimmed && GENERIC_WORDS.has(norm(trimmed))) {
      raw.push({
        selector, wcag: "1.1.1", source: "backstop", category: "generic", rule: "generic-word",
        message: `Alt text is a generic placeholder ("${trimmed}") that does not describe the image.`,
      });
      return;
    }
    // 3. decorative description that should be empty
    if (trimmed && DECORATIVE_RE.test(trimmed)) {
      raw.push({
        selector, wcag: "1.1.1", source: "backstop", category: "decorative-misuse", rule: "decorative-alt",
        message: `Alt text describes a decorative element ("${trimmed}"); a decorative image should use empty alt="" to avoid screen-reader noise.`,
      });
      return;
    }
    // 4. informative image emptied to alt="" (heuristic: substantial / in a figure / content src)
    if (trimmed === "" && (inFigure || INFORMATIVE_SRC_RE.test(src))) {
      raw.push({
        selector, wcag: "1.1.1", source: "backstop", category: "decorative-misuse", rule: "informative-emptied",
        message: `A substantial image (in a <figure> or with a content-bearing source) has empty alt="", so a screen-reader user gets no information — likely an informative image wrongly marked decorative.`,
      });
      return;
    }
    // 5. alt duplicates adjacent visible text (redundant)
    const cap = $(el).closest("figure").find("figcaption").first().text().trim();
    const linkText = $(el).closest("a").text().trim();
    if (trimmed && ((cap && norm(cap) === norm(trimmed)) || (linkText && norm(linkText) === norm(trimmed)))) {
      raw.push({
        selector, wcag: "1.1.1", source: "backstop", category: "generic", rule: "redundant-alt",
        message: `Alt text duplicates adjacent visible text verbatim, so a screen-reader user hears it twice.`,
      });
    }
  });

  // 6. aria-label contradicting the visible label
  $("input[aria-label],select[aria-label],textarea[aria-label],button[aria-label],a[aria-label],[role=button][aria-label],[role=link][aria-label]").each(
    (_i, el) => {
      const ariaLabel = ($(el).attr("aria-label") ?? "").trim();
      if (!ariaLabel) return;
      const tag = (el as { tagName?: string }).tagName?.toLowerCase();
      let visible = "";
      if (tag === "input" || tag === "select" || tag === "textarea") {
        const id = $(el).attr("id");
        if (id) visible = $(`label[for="${id}"]`).text().trim();
        if (!visible) visible = $(el).closest("label").text().trim();
      } else {
        visible = $(el).text().trim();
      }
      const meaningfulVisible = /[a-z0-9]/i.test(visible);
      if (!meaningfulVisible) return;
      const a = norm(ariaLabel);
      const v = norm(visible);
      if (!a.includes(v) && !v.includes(a)) {
        raw.push({
          selector: controlSelector($, el),
          wcag: "2.5.3",
          source: "backstop",
          category: "wrong",
          rule: "aria-label-contradicts",
          message: `Accessible name ("${ariaLabel}") contradicts the visible label ("${visible}"), so a screen-reader user is told the wrong thing.`,
        });
      }
    },
  );

  return toFindings(raw);
}

// ---- LLM judge (nuance) ---------------------------------------------------

const JUDGE_SYSTEM =
  "You are an accessibility expert. Judge ONLY the semantic meaningfulness and accuracy of the " +
  "given alt text or accessible name for a screen-reader user. Do NOT consider mechanical validity, " +
  "keyboard operability, color, or layout. Categories: good = accurate and useful; generic = present " +
  "but vacuous or too vague to convey the content; wrong = inaccurate, mismatched, misleading, or a " +
  "file name; decorative-misuse = describes a decorative element that should have empty alt. Respond " +
  "with raw JSON only.";

export interface JudgeInput {
  text: string;
  context: string;
  kind?: "alt" | "label";
}

export function buildJudgeMessages(input: JudgeInput): ChatMessage[] {
  const kind = input.kind ?? "alt";
  const what = kind === "alt" ? "the image depicts and where it is used" : "the control is and where it is used";
  return [
    { role: "system", content: JUDGE_SYSTEM },
    {
      role: "user",
      content:
        `Context (what ${what}): ${input.context}\n` +
        `${kind === "alt" ? "Alt text" : "Accessible name"}: "${input.text}"\n` +
        `Return ONLY JSON with keys: meaningful (boolean), category (good|generic|wrong|decorative-misuse), reason (string), confidence (number 0-1).`,
    },
  ];
}

function stripFences(s: string): string {
  const m = /```(?:json)?\s*([\s\S]*?)```/i.exec(s);
  return (m ? m[1]! : s).trim();
}

/** Ask the calibrated LLM judge for a semantic Verdict (cassette-backed, deterministic). */
export async function judge(input: JudgeInput): Promise<Verdict> {
  const raw = (await complete({ role: "judge", messages: buildJudgeMessages(input), jsonMode: true })) as string;
  return VerdictSchema.parse(JSON.parse(stripFences(raw)));
}

// ---- gating ---------------------------------------------------------------

export type GateMode = "hard" | "advisory" | "backstops-only";

export function gateModeForKappa(kappa: number): GateMode {
  if (kappa >= 0.6) return "hard";
  if (kappa >= 0.4) return "advisory";
  return "backstops-only";
}

// ---- orchestration --------------------------------------------------------

function toFindings(raw: RawC[]): Finding[] {
  const groups = new Map<string, RawC>();
  for (const r of raw) {
    const key = `${r.selector}|${r.wcag}`;
    if (!groups.has(key)) groups.set(key, r);
  }
  const findings: Finding[] = [];
  for (const [, r] of groups) {
    findings.push({
      id: `C:${r.wcag}:${r.selector}`,
      layer: "C",
      type: "semantic",
      source: r.source,
      selector: r.selector,
      wcag: r.wcag,
      message: r.message,
      detail: { category: r.category, ...(r.rule ? { rule: r.rule } : {}) },
    });
  }
  return findings.sort(
    (a, b) =>
      (a.selector ?? "").localeCompare(b.selector ?? "") ||
      (a.wcag ?? "").localeCompare(b.wcag ?? "") ||
      a.id.localeCompare(b.id),
  );
}

export interface LayerCOptions {
  /** Run the LLM judge on nuanced candidates (requires cassettes/key). Default false. */
  useJudge?: boolean;
  /** Gate mode; defaults to "backstops-only" unless a calibrated kappa says otherwise. */
  gateMode?: GateMode;
}

/**
 * Run Layer C over raw HTML. Backstops always run (offline). The LLM judge runs
 * only when useJudge is set and the gate is not backstops-only; judge findings on
 * an unrecorded prompt are skipped (no cassette) so the layer stays robust offline.
 */
export async function runLayerC(html: string, opts: LayerCOptions = {}): Promise<Finding[]> {
  const backstops = deterministicBackstops(html);
  const gate = opts.gateMode ?? "backstops-only";
  if (!opts.useJudge || gate === "backstops-only") return backstops;

  const flaggedSelectors = new Set(backstops.map((f) => f.selector));
  const $ = cheerio.load(html);
  const extra: RawC[] = [];

  const candidates: { selector: string; alt: string; context: string }[] = [];
  $("img[alt]").each((_i, el) => {
    const alt = ($(el).attr("alt") ?? "").trim();
    const selector = imgSelector($, el);
    if (!alt || flaggedSelectors.has(selector)) return;
    const fig = $(el).closest("figure").find("figcaption").first().text().trim();
    const context = fig || $(el).parent().text().trim().slice(0, 160) || "image on a web page";
    candidates.push({ selector, alt, context });
  });

  for (const c of candidates) {
    try {
      const verdict = await judge({ text: c.alt, context: c.context, kind: "alt" });
      if (!verdict.meaningful) {
        extra.push({
          selector: c.selector,
          wcag: "1.1.1",
          source: "llm-judge",
          category: verdict.category,
          message: `Judge (${gate === "advisory" ? "advisory" : "gate"}): alt "${c.alt}" is not meaningful — ${verdict.reason}`,
          rule: "llm-judge",
        });
      }
    } catch {
      // No cassette for this prompt (offline) — skip; backstops still stand.
    }
  }

  const all = [...backstops, ...toFindings(extra)];
  const seen = new Set<string>();
  const merged: Finding[] = [];
  for (const f of all) {
    const key = `${f.selector}|${f.wcag}`;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(f);
    }
  }
  return merged.sort(
    (a, b) =>
      (a.selector ?? "").localeCompare(b.selector ?? "") ||
      (a.wcag ?? "").localeCompare(b.wcag ?? "") ||
      a.id.localeCompare(b.id),
  );
}
