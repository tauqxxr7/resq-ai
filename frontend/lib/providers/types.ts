import type { Backend, Evidence } from "../schema.ts";
export interface AnalysisProvider {
  identity: Backend;
  analyze(evidence: Evidence[], signal: AbortSignal): Promise<unknown>;
}
