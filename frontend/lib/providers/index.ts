import "server-only";
import { demoProvider } from "./demo.ts";
import { createBedrockProvider } from "./bedrock.ts";
import { AnalysisError } from "../validation.ts";

export function providerStatus(
  env: Record<string, string | undefined> = process.env,
) {
  const mode = env.RESQ_PROVIDER || "demo";
  const configured =
    mode === "demo" ||
    (mode === "bedrock" && Boolean(env.AWS_REGION && env.BEDROCK_MODEL_ID));
  return {
    kind: mode === "bedrock" ? ("bedrock" as const) : ("demo" as const),
    model:
      mode === "bedrock"
        ? env.BEDROCK_MODEL_ID || "not-configured"
        : "deterministic-rules-v1",
    configured,
    status:
      mode === "demo"
        ? "Demo available · no AWS calls"
        : configured
          ? "Bedrock configured · connectivity unverified"
          : "Backend configuration incomplete",
    connectivityVerified: false,
  };
}
export function configuredProvider() {
  const status = providerStatus();
  if (!status.configured)
    throw new AnalysisError(
      "CONFIGURATION_ERROR",
      "Set RESQ_PROVIDER to demo, or configure bedrock with AWS_REGION and BEDROCK_MODEL_ID.",
    );
  return status.kind === "demo"
    ? demoProvider
    : createBedrockProvider(
        process.env.AWS_REGION!,
        process.env.BEDROCK_MODEL_ID!,
      );
}
