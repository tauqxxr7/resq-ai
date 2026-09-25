import { buildTimeline, MAX_INPUT, MAX_LINES, redact } from "./evidence.ts";
import { AnalysisError, verifyAnalysis } from "./validation.ts";
import type { IncidentResult, State } from "./schema.ts";
import type { AnalysisProvider } from "./providers/types.ts";

const transitions: Record<State, State[]> = {
  RECEIVED: ["REDACTED", "FAILED"],
  REDACTED: ["TIMELINE_BUILT", "FAILED"],
  TIMELINE_BUILT: ["ANALYZED", "NEEDS_MORE_EVIDENCE", "FAILED"],
  ANALYZED: ["VERIFIED", "FAILED"],
  VERIFIED: ["READY_FOR_REVIEW", "NEEDS_MORE_EVIDENCE", "FAILED"],
  READY_FOR_REVIEW: [],
  NEEDS_MORE_EVIDENCE: [],
  FAILED: [],
};
export function transition(
  result: IncidentResult,
  next: State,
  now: () => string,
) {
  if (!transitions[result.state].includes(next))
    throw new Error("Illegal orchestration transition");
  result.state = next;
  result.trace.push({ state: next, at: now() });
}

export async function analyzeIncident(
  input: string,
  provider: AnalysisProvider,
  options: { timeoutMs?: number; now?: () => string } = {},
): Promise<IncidentResult> {
  const now = options.now ?? (() => new Date().toISOString());
  const result: IncidentResult = {
    state: "RECEIVED",
    trace: [{ state: "RECEIVED", at: now() }],
    backend: provider.identity,
    evidence: [],
    redactionCounts: {},
    warnings: [],
    analysis: null,
    error: null,
  };
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    if (
      !input.trim() ||
      input.length > MAX_INPUT ||
      input.split(/\r\n?|\n/).length > MAX_LINES
    ) {
      throw new AnalysisError(
        "INVALID_INPUT",
        `Provide 1–${MAX_LINES} lines, up to ${MAX_INPUT} characters.`,
      );
    }
    const clean = redact(input);
    result.redactionCounts = clean.counts;
    transition(result, "REDACTED", now);
    result.evidence = buildTimeline(clean.text);
    transition(result, "TIMELINE_BUILT", now);
    const undated = result.evidence.filter((e) => !e.timestamp).length;
    if (undated)
      result.warnings.push(
        `${undated} line(s) have no valid timestamp; preserved at the end without inferred times.`,
      );
    if (result.evidence.some((e) => e.text.length > 2000))
      throw new AnalysisError(
        "INVALID_INPUT",
        "Each evidence line must be at most 2,000 characters.",
      );
    if (result.evidence.length < 2) {
      result.warnings.push(
        "At least two evidence lines are needed. Add service metrics and time-correlated errors.",
      );
      transition(result, "NEEDS_MORE_EVIDENCE", now);
      return result;
    }
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(
          new AnalysisError(
            "PROVIDER_TIMEOUT",
            "Analysis timed out. No answer was accepted; retry or collect more evidence.",
          ),
        );
      }, options.timeoutMs ?? 20_000);
    });
    const candidate = await Promise.race([
      provider.analyze(result.evidence, controller.signal),
      timeout,
    ]);
    transition(result, "ANALYZED", now);
    result.analysis = verifyAnalysis(candidate, result.evidence);
    transition(result, "VERIFIED", now);
    transition(
      result,
      result.analysis.rootCause.code === "unconfirmed"
        ? "NEEDS_MORE_EVIDENCE"
        : "READY_FOR_REVIEW",
      now,
    );
  } catch (error) {
    result.analysis = null;
    result.error =
      error instanceof AnalysisError
        ? { code: error.code, message: error.message }
        : {
            code: "PROVIDER_ERROR",
            message:
              "The analysis provider failed. Check server configuration, model access and region. No answer was accepted.",
          };
    transition(result, "FAILED", now);
  } finally {
    if (timer) clearTimeout(timer);
    controller.abort();
  }
  return result;
}
