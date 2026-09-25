import { observedSeverity, poolSupport } from "../evidence.ts";
import { ROOT_STATEMENTS, type Analysis, type Evidence } from "../schema.ts";
import type { AnalysisProvider } from "./types.ts";

export function demoAnalysis(evidence: Evidence[]): Analysis {
  const support = poolSupport(evidence);
  const code = support.length ? "pool_exhaustion" : "unconfirmed";
  return {
    severity: observedSeverity(evidence),
    observedFacts: evidence
      .slice(0, 12)
      .map((e) => ({ statement: e.text, evidenceIds: [e.id] })),
    rootCause: { code, statement: ROOT_STATEMENTS[code], evidenceIds: support },
    alternativeHypotheses: [
      {
        hypothesis:
          "A connection leak or long-running transactions could contribute; neither is established by this bundle.",
        evidenceIds: support,
        nextCheck:
          "Inspect connection ownership, transaction age and pool wait metrics for the affected service.",
      },
      {
        hypothesis:
          "A traffic spike or slow dependency could explain the symptoms; this is unconfirmed.",
        evidenceIds: [],
        nextCheck:
          "Compare request volume, dependency latency and traces with the pre-incident baseline.",
      },
    ],
    confidence: {
      level: support.length ? "moderate" : "low",
      qualification:
        "Qualitative rule support only; not a calibrated probability.",
    },
    recommendedNextChecks: [
      "Correlate pool occupancy and timeout traces for the same service and time window.",
      "Compare deployment changes against metrics; temporal proximity alone does not prove causality.",
    ],
    suggestedMitigations: [
      support.length
        ? "With incident-owner approval, consider limiting concurrency while checking database capacity. Do not blindly raise connection limits."
        : "Escalate to the incident owner and collect service metrics before selecting a mitigation.",
      "Evaluate rollback only after checking a relevant change and its rollback safety.",
    ],
    limitations: ["Deterministic demo rules; no model inference or AWS calls."],
  };
}
export const demoProvider: AnalysisProvider = {
  identity: { kind: "demo", model: "deterministic-rules-v1" },
  async analyze(evidence) {
    return demoAnalysis(evidence);
  },
};
