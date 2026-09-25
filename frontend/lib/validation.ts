import {
  analysisSchema,
  ROOT_STATEMENTS,
  type Analysis,
  type Evidence,
} from "./schema.ts";
import { observedSeverity, poolSupport, redact } from "./evidence.ts";

export class AnalysisError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export function verifyAnalysis(
  candidate: unknown,
  evidence: Evidence[],
): Analysis {
  const parsed = analysisSchema.safeParse(candidate);
  if (!parsed.success)
    throw new AnalysisError(
      "MALFORMED_OUTPUT",
      "Provider output did not match the analysis schema. No analysis was accepted.",
    );
  const value = parsed.data;
  const map = new Map(evidence.map((e) => [e.id, e]));
  const refs = [
    ...value.observedFacts,
    value.rootCause,
    ...value.alternativeHypotheses,
  ];
  for (const item of refs) {
    if (
      new Set(item.evidenceIds).size !== item.evidenceIds.length ||
      item.evidenceIds.some((id) => !map.has(id))
    ) {
      throw new AnalysisError(
        "INVALID_CITATION",
        "Provider cited unknown or duplicate evidence IDs. No analysis was accepted.",
      );
    }
  }
  for (const fact of value.observedFacts) {
    if (
      fact.evidenceIds.length !== 1 ||
      fact.statement !== map.get(fact.evidenceIds[0])?.text
    ) {
      throw new AnalysisError(
        "UNSUPPORTED_FACT",
        "Observed facts must quote one supplied evidence line exactly.",
      );
    }
  }
  const root = value.rootCause;
  if (
    root.statement !== ROOT_STATEMENTS[root.code] ||
    (root.code === "pool_exhaustion" &&
      poolSupport(evidence.filter((e) => root.evidenceIds.includes(e.id)))
        .length === 0) ||
    (root.code === "unconfirmed" && root.evidenceIds.length !== 0)
  ) {
    throw new AnalysisError(
      "UNSUPPORTED_CAUSE",
      "Root-cause statement is not supported by the cited evidence and deterministic rule.",
    );
  }
  const expectedLevel = root.code === "pool_exhaustion" ? "moderate" : "low";
  if (
    value.confidence.level !== expectedLevel ||
    value.severity !== observedSeverity(evidence)
  ) {
    throw new AnalysisError(
      "UNSUPPORTED_ASSESSMENT",
      "Confidence or severity exceeded the evidence policy.",
    );
  }
  // Defense in depth for model-generated prose; never return provider secrets.
  const safeText = (text: string) => redact(text).text;
  value.alternativeHypotheses = value.alternativeHypotheses.map((a) => ({
    ...a,
    hypothesis: safeText(a.hypothesis),
    nextCheck: safeText(a.nextCheck),
  }));
  value.recommendedNextChecks = value.recommendedNextChecks.map(safeText);
  value.suggestedMitigations = value.suggestedMitigations.map(safeText);
  // Qualification is policy-owned rather than allowing a model to imply calibration.
  value.confidence.qualification =
    "Qualitative evidence support, not a calibrated probability. Logs are untrusted observations; a human must confirm the cause.";
  value.limitations = [
    "Only the supplied bundle was inspected; no live metrics, traces, or deployment state were queried.",
    "The validator supports one failure-mechanism rule, not general semantic verification. A matching rule does not prove the underlying trigger.",
    "Alternative hypotheses, next checks and mitigations are unverified suggestions. No remediation is executed.",
    "Pattern-based redaction can miss personal data or novel secret formats. Review before sharing.",
  ];
  return value;
}
