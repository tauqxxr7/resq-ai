import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createBedrockProvider } from "../lib/providers/bedrock.ts";
import { providerStatus } from "../lib/providers/index.ts";
import { analyzeIncident } from "../lib/orchestrator.ts";
import { buildTimeline, redact } from "../lib/evidence.ts";
import { demoAnalysis } from "../lib/providers/demo.ts";

const raw = readFileSync(
  new URL("../fixtures/well-evidenced.txt", import.meta.url),
  "utf8",
);
const events = buildTimeline(redact(raw).text);

test("Bedrock adapter constructs Converse request and validates response via fake transport (no AWS)", async () => {
  let calls = 0;
  const provider = createBedrockProvider(
    "us-east-1",
    "test-model",
    async (command, options) => {
      calls++;
      assert.equal(command.input.modelId, "test-model");
      assert.ok(command.input.system?.[0].text?.includes("untrusted"));
      assert.equal(options.abortSignal.aborted, false);
      assert.deepEqual(
        JSON.parse(command.input.messages![0].content![0].text!).evidence,
        events,
      );
      return {
        $metadata: {},
        stopReason: "end_turn",
        output: {
          message: {
            role: "assistant",
            content: [{ text: JSON.stringify(demoAnalysis(events)) }],
          },
        },
      };
    },
  );
  const result = await analyzeIncident(raw, provider);
  assert.equal(calls, 1);
  assert.equal(result.state, "READY_FOR_REVIEW");
  assert.deepEqual(result.backend, { kind: "bedrock", model: "test-model" });
});

test("Bedrock adapter rejects malformed JSON, fenced output and truncation", async () => {
  for (const [text, stopReason] of [
    ["not json", "end_turn"],
    ["```json\n{}\n```", "end_turn"],
    ["{}", "max_tokens"],
  ] as const) {
    const provider = createBedrockProvider(
      "us-east-1",
      "test-model",
      async () => ({
        $metadata: {},
        stopReason,
        output: { message: { role: "assistant", content: [{ text }] } },
      }),
    );
    const result = await analyzeIncident(raw, provider);
    assert.equal(result.state, "FAILED");
    assert.equal(result.analysis, null);
  }
});

test("status distinguishes configured from verified and never exposes credentials", () => {
  assert.match(providerStatus({}).status, /Demo available/);
  assert.equal(providerStatus({ RESQ_PROVIDER: "bedrock" }).configured, false);
  const status = providerStatus({
    RESQ_PROVIDER: "bedrock",
    AWS_REGION: "us-east-1",
    BEDROCK_MODEL_ID: "test-model",
    AWS_SECRET_ACCESS_KEY: "must-not-leak",
  });
  assert.equal(status.configured, true);
  assert.equal(status.connectivityVerified, false);
  assert.ok(!JSON.stringify(status).includes("must-not-leak"));
  assert.equal(providerStatus({ RESQ_PROVIDER: "typo" }).configured, false);
});
