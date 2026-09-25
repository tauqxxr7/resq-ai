import type { IncidentResult } from "./schema.ts";

export function incidentBrief(result: IncidentResult): string {
  const a = result.analysis;
  return [
    "# ResQ incident brief",
    "",
    `State: ${result.state}`,
    `Backend: ${result.backend.kind} / ${result.backend.model}`,
    `AWS inference: ${result.backend.kind === "demo" ? "Not used (deterministic demo)." : a ? "Response received and validated for this request." : "No validated response."}`,
    `Redaction replacements: ${JSON.stringify(result.redactionCounts)}`,
    "",
    ...(a
      ? [
          `Severity: ${a.severity} (observed log level, not business impact)`,
          "",
          "## Root-cause hypothesis",
          a.rootCause.statement,
          `Citations: ${a.rootCause.evidenceIds.join(", ") || "none"}`,
          "",
          `Confidence: ${a.confidence.level}. ${a.confidence.qualification}`,
          "",
          "## Observed facts (verbatim redacted lines)",
          ...a.observedFacts.map(
            (f) => `- [${f.evidenceIds.join(", ")}] ${f.statement}`,
          ),
          "",
          "## Alternatives — unverified",
          ...a.alternativeHypotheses.map(
            (h) =>
              `- ${h.hypothesis} [${h.evidenceIds.join(", ") || "no direct evidence"}] Next check: ${h.nextCheck}`,
          ),
          "",
          "## Recommended next checks",
          ...a.recommendedNextChecks.map((x) => `- ${x}`),
          "",
          "## Suggested mitigations — human approval required",
          ...a.suggestedMitigations.map((x) => `- ${x}`),
          "",
          "## Limitations",
          ...a.limitations.map((x) => `- ${x}`),
        ]
      : [
          "No validated analysis.",
          result.error?.message ?? "More evidence is needed.",
        ]),
    "",
    "## Warnings",
    ...result.warnings.map((x) => `- ${x}`),
    "",
    "## Timeline / original line mapping (redacted)",
    ...result.evidence.map(
      (e) =>
        `[${e.id}] line ${e.lineNumber} | ${e.timestamp ?? "timestamp unavailable"} | ${e.text}`,
    ),
    "",
    "## Execution trace",
    ...result.trace.map((t) => `${t.at} ${t.state}`),
    "",
  ].join("\n");
}
