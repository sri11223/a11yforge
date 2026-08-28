import { z } from "zod";

/**
 * Shared domain types for A11yForge, expressed as zod schemas so that both
 * runtime validation and static types come from a single source of truth.
 *
 * These match the ground-truth manifest schema locked in docs/BRAINSTORM.md.
 */

/** Which verification layer produced or is expected to catch a finding. */
export const LayerSchema = z.enum(["A", "B", "C"]);
export type Layer = z.infer<typeof LayerSchema>;

/** Nature of a violation. Drives routing (mechanical→rule, semantic→LLM). */
export const ViolationTypeSchema = z.enum(["mechanical", "behavioral", "semantic"]);
export type ViolationType = z.infer<typeof ViolationTypeSchema>;

/** WCAG-ish impact severity, normalized across axe/pa11y. */
export const ImpactSchema = z.enum(["minor", "moderate", "serious", "critical"]);
export type Impact = z.infer<typeof ImpactSchema>;

/**
 * A single finding emitted by any layer (A/B/C). Layer A findings come from
 * axe/pa11y; Layer B from the SR traversal / AX-tree; Layer C from the judge
 * (semantic only).
 */
export const FindingSchema = z.object({
  id: z.string(),
  layer: LayerSchema,
  type: ViolationTypeSchema,
  /** Tool/engine that produced it, e.g. "axe-core", "pa11y", "virtual-sr", "cdp-ax", "judge". */
  source: z.string(),
  /** CSS selector or best-effort locator for the offending node. */
  selector: z.string().optional(),
  /** WCAG success-criterion reference, e.g. "1.1.1". */
  wcag: z.string().optional(),
  impact: ImpactSchema.optional(),
  message: z.string(),
  /** Free-form structured detail (rule id, expected vs actual, etc.). */
  detail: z.record(z.string(), z.unknown()).optional(),
});
export type Finding = z.infer<typeof FindingSchema>;

/** Outcome of attempting to remediate one violation. */
export const FixStatusSchema = z.enum([
  "fixed", // verified A-clean + B-clean + C-meaningful + no regression
  "unresolved", // attempts exhausted, still failing
  "needs-review", // ambiguous semantic case → human checkpoint
  "regressed", // fix rejected by the regression guard
]);
export type FixStatus = z.infer<typeof FixStatusSchema>;

export const FixResultSchema = z.object({
  violationId: z.string(),
  status: FixStatusSchema,
  /** How the fix was produced. */
  appliedBy: z.enum(["rule", "llm", "none"]),
  attempts: z.number().int().nonnegative(),
  /** Selector the fix targeted. */
  selector: z.string().optional(),
  beforeHtml: z.string().optional(),
  afterHtml: z.string().optional(),
  /** Structured verifier feedback captured across reflexion attempts. */
  diagnostics: z.array(z.string()).default([]),
});
export type FixResult = z.infer<typeof FixResultSchema>;

/**
 * Layer C judge verdict — semantic meaningfulness ONLY. Never mechanical or
 * behavioral (those are Layers A and B). zod-validated so schema violations
 * from the model are rejected and retried.
 */
export const VerdictSchema = z.object({
  meaningful: z.boolean(),
  category: z.enum(["good", "generic", "wrong", "decorative-misuse"]),
  reason: z.string(),
  confidence: z.number().min(0).max(1).optional(),
});
export type Verdict = z.infer<typeof VerdictSchema>;

/** One expected violation in a corpus page's ground-truth manifest. */
export const ManifestViolationSchema = z.object({
  id: z.string(),
  wcag: z.string(),
  type: ViolationTypeSchema,
  selector: z.string(),
  /** For images/regions: true=informative, false=decorative, null=n/a. */
  informative: z.boolean().nullable(),
  expectedCatchingLayer: LayerSchema,
  expectedFix: z.string(),
  notes: z.string().optional(),
});
export type ManifestViolation = z.infer<typeof ManifestViolationSchema>;

/** Provenance of a corpus page. */
export const CorpusSourceSchema = z.enum(["injected", "adversarial", "real"]);
export type CorpusSource = z.infer<typeof CorpusSourceSchema>;

/** Ground-truth manifest for one corpus page. */
export const ManifestSchema = z.object({
  id: z.string(),
  source: CorpusSourceSchema,
  expectedUsable: z.string(),
  violations: z.array(ManifestViolationSchema),
});
export type Manifest = z.infer<typeof ManifestSchema>;
