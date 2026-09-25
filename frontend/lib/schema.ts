import { z } from "zod";

export const evidenceId = z.string().regex(/^E\d{4}$/);
const ids = z.array(evidenceId).min(1).max(200);
const text = z.string().trim().min(1).max(2000);
export const ROOT_STATEMENTS = {
  pool_exhaustion:
    "Database connection pool exhaustion is a supported failure mechanism; the underlying trigger remains unconfirmed.",
  unconfirmed:
    "Cause unconfirmed: the supplied evidence does not establish a supported failure mechanism.",
} as const;
export const analysisSchema = z
  .object({
    severity: z.enum(["critical", "high", "medium", "unknown"]),
    observedFacts: z
      .array(z.object({ statement: text, evidenceIds: ids }).strict())
      .min(1)
      .max(200),
    rootCause: z
      .object({
        code: z.enum(["pool_exhaustion", "unconfirmed"]),
        statement: text,
        evidenceIds: z.array(evidenceId).max(200),
      })
      .strict(),
    alternativeHypotheses: z
      .array(
        z
          .object({
            hypothesis: text,
            evidenceIds: z.array(evidenceId).max(200),
            nextCheck: text,
          })
          .strict(),
      )
      .min(1)
      .max(8),
    confidence: z
      .object({ level: z.enum(["low", "moderate"]), qualification: text })
      .strict(),
    recommendedNextChecks: z.array(text).min(1).max(10),
    suggestedMitigations: z.array(text).min(1).max(10),
    limitations: z.array(text).min(1).max(10),
  })
  .strict();
export type Analysis = z.infer<typeof analysisSchema>;
export type Evidence = {
  id: string;
  lineNumber: number;
  timestamp: string | null;
  text: string;
};
export type Backend = { kind: "demo" | "bedrock"; model: string };
export type State =
  | "RECEIVED"
  | "REDACTED"
  | "TIMELINE_BUILT"
  | "ANALYZED"
  | "VERIFIED"
  | "READY_FOR_REVIEW"
  | "NEEDS_MORE_EVIDENCE"
  | "FAILED";
export type TraceEntry = { state: State; at: string };
export type IncidentResult = {
  state: State;
  trace: TraceEntry[];
  backend: Backend;
  evidence: Evidence[];
  redactionCounts: Record<string, number>;
  warnings: string[];
  analysis: Analysis | null;
  error: { code: string; message: string } | null;
};
