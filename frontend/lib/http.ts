import { z } from "zod";
import { analyzeIncident } from "./orchestrator.ts";
import { MAX_INPUT } from "./evidence.ts";
import type { AnalysisProvider } from "./providers/types.ts";

export const responseHeaders = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};
const requestSchema = z
  .object({ incident: z.string().min(1).max(MAX_INPUT).refine((value) => value.trim().length > 0) })
  .strict();
const MAX_BODY_BYTES = 256_000;

export async function handleAnalysis(
  request: Request,
  provider: () => AnalysisProvider,
) {
  if (
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/json")
  ) {
    return Response.json(
      { error: "Use application/json." },
      { status: 415, headers: responseHeaders },
    );
  }
  let value: unknown;
  try {
    const reader = request.body?.getReader();
    if (!reader) throw new Error("Empty body");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value: chunk } = await reader.read();
      if (done) break;
      size += chunk.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        return Response.json(
          { error: "Request body exceeds 256 KB." },
          { status: 413, headers: responseHeaders },
        );
      }
      chunks.push(chunk);
    }
    const body = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }
    value = JSON.parse(new TextDecoder().decode(body));
  } catch {
    return Response.json(
      { error: "Invalid JSON request." },
      { status: 400, headers: responseHeaders },
    );
  }
  const parsed = requestSchema.safeParse(value);
  if (!parsed.success)
    return Response.json(
      { error: "Provide an incident string of 1–64,000 characters only." },
      { status: 400, headers: responseHeaders },
    );
  let selected: AnalysisProvider;
  try {
    selected = provider();
  } catch {
    return Response.json(
      {
        error:
          "Backend configuration incomplete. Check RESQ_PROVIDER, AWS_REGION and BEDROCK_MODEL_ID.",
      },
      { status: 503, headers: responseHeaders },
    );
  }
  const result = await analyzeIncident(parsed.data.incident, selected);
  const status =
    result.state !== "FAILED"
      ? 200
      : result.error?.code === "PROVIDER_TIMEOUT"
        ? 504
        : result.error?.code === "INVALID_INPUT"
          ? 400
          : 502;
  return Response.json(result, { status, headers: responseHeaders });
}
