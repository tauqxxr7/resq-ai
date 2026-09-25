import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildTimeline, poolSupport, redact } from "../lib/evidence.ts";
import { analyzeIncident, transition } from "../lib/orchestrator.ts";
import { demoAnalysis, demoProvider } from "../lib/providers/demo.ts";
import { verifyAnalysis } from "../lib/validation.ts";
import { ROOT_STATEMENTS } from "../lib/schema.ts";
import { incidentBrief } from "../lib/brief.ts";
import { handleAnalysis } from "../lib/http.ts";

const fixture = (name: string) =>
  readFileSync(new URL(`../fixtures/${name}.txt`, import.meta.url), "utf8");
const well = fixture("well-evidenced");
const ambiguous = fixture("ambiguous");
const evidence = buildTimeline(redact(well).text);

test("redacts known secrets, email, IP, identifiers, URL credentials and multiline keys without changing line count", () => {
  const raw = [
    'Authorization: Bearer synthetic-bearer password="synthetic password" api_key=test-api-value',
    "email=judge@example.com ip=192.0.2.44 user_id=person42 phone=+1-202-555-0142",
    "key=AKIAIOSFODNN7EXAMPLE session=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJmb28ifQ.fakeSignature",
    "url=postgres://fakeuser:fakepass@db.test id=123-45-6789",
    "-----BEGIN PRIVATE KEY-----\nFAKEKEYMATERIAL\n-----END PRIVATE KEY-----",
    '{"client_secret":"synthetic-json-secret", "name":"Demo Person"}',
  ].join("\n");
  const clean = redact(raw);
  for (const secret of [
    "synthetic-bearer",
    "synthetic password",
    "test-api-value",
    "judge@example.com",
    "192.0.2.44",
    "person42",
    "+1-202-555-0142",
    "AKIAIOSFODNN7EXAMPLE",
    "fakeSignature",
    "fakepass",
    "123-45-6789",
    "FAKEKEYMATERIAL",
    "synthetic-json-secret",
    "Demo Person",
  ])
    assert.ok(!clean.text.includes(secret), secret);
  assert.equal(clean.text.split("\n").length, raw.split("\n").length);
  assert.deepEqual(redact(clean.text), { text: clean.text, counts: {} });
});

test("redaction preserves incident timestamps and diagnosis fields", () => {
  assert.equal(redact(well).text, well);
});

test("timeline sorts timestamps but preserves original IDs, duplicates and undated lines", () => {
  const raw =
    "2026-09-19T02:12:03Z ERROR service=a\n\n2026-09-19T02:10:00Z WARN service=a\nundated\n2026-09-19T02:10:00Z WARN service=a";
  const timeline = buildTimeline(raw);
  assert.deepEqual(
    timeline.map((e) => e.id),
    ["E0003", "E0005", "E0001", "E0004"],
  );
  assert.equal(timeline.at(-1)?.timestamp, null);
  assert.deepEqual(buildTimeline(raw), timeline);
  assert.equal(
    buildTimeline("2026-02-30T12:00:00Z ERROR service=a")[0].timestamp,
    null,
  );
});

test("complete demo fixture flow reaches review with supported citations and no deploy-cause claim", async () => {
  const result = await analyzeIncident(well, demoProvider);
  assert.equal(result.state, "READY_FOR_REVIEW");
  assert.deepEqual(
    result.trace.map((t) => t.state),
    [
      "RECEIVED",
      "REDACTED",
      "TIMELINE_BUILT",
      "ANALYZED",
      "VERIFIED",
      "READY_FOR_REVIEW",
    ],
  );
  assert.deepEqual(result.analysis?.rootCause.evidenceIds, ["E0003", "E0004"]);
  assert.equal(result.analysis?.severity, "critical");
  assert.equal(result.backend.kind, "demo");
  assert.match(
    result.analysis!.rootCause.statement,
    /trigger remains unconfirmed/,
  );
  assert.match(incidentBrief(result), /No.*|Not used \(deterministic demo\)/);
});

test("ambiguous incident correctly withholds cause", async () => {
  const result = await analyzeIncident(ambiguous, demoProvider);
  assert.equal(result.state, "NEEDS_MORE_EVIDENCE");
  assert.equal(result.analysis?.rootCause.code, "unconfirmed");
  assert.deepEqual(result.analysis?.rootCause.evidenceIds, []);
  assert.equal(result.analysis?.confidence.level, "low");
});

test("no inference with fewer than two evidence lines", async () => {
  const result = await analyzeIncident("one undated observation", {
    ...demoProvider,
    analyze: async () => {
      throw new Error("must not run");
    },
  });
  assert.equal(result.state, "NEEDS_MORE_EVIDENCE");
  assert.equal(result.analysis, null);
});

test("provider receives only redacted evidence; brief never exports synthetic secrets", async () => {
  const raw = fixture("redaction-test");
  const result = await analyzeIncident(raw, {
    ...demoProvider,
    analyze: async (events) => {
      assert.ok(!JSON.stringify(events).includes("SYNTHETIC-DEMO-TOKEN"));
      assert.ok(!JSON.stringify(events).includes("judge@example.com"));
      return demoAnalysis(events);
    },
  });
  assert.ok(
    Object.values(result.redactionCounts).reduce((a, b) => a + b, 0) >= 5,
  );
  assert.ok(!incidentBrief(result).includes("SYNTHETIC-DEMO-TOKEN"));
  assert.ok(!JSON.stringify(result).includes("FAKE PASSWORD"));
});

test("rejects invented citations in facts, roots and alternatives", () => {
  for (const field of ["fact", "root", "alternative"]) {
    const analysis = demoAnalysis(evidence);
    if (field === "fact") analysis.observedFacts[0].evidenceIds = ["E9999"];
    if (field === "root") analysis.rootCause.evidenceIds = ["E9999"];
    if (field === "alternative")
      analysis.alternativeHypotheses[0].evidenceIds = ["E9999"];
    assert.throws(
      () => verifyAnalysis(analysis, evidence),
      /unknown or duplicate/,
    );
  }
});

test("rejects fabricated facts even with existing citations", () => {
  const analysis = demoAnalysis(evidence);
  analysis.observedFacts[0].statement =
    "The deployment caused a connection leak.";
  assert.throws(() => verifyAnalysis(analysis, evidence), /quote one supplied/);
});

test("rejects root statements with unsupported causal text or unrelated real citations", () => {
  const analysis = demoAnalysis(evidence);
  analysis.rootCause.statement = "Deployment 2.8.1 caused the outage.";
  assert.throws(() => verifyAnalysis(analysis, evidence), /not supported/);
  analysis.rootCause.statement = ROOT_STATEMENTS.pool_exhaustion;
  analysis.rootCause.evidenceIds = ["E0001", "E0002"];
  assert.throws(() => verifyAnalysis(analysis, evidence), /not supported/);
});

test("rule rejects cross-service, reverse-time, stale, negated prose and merely elevated occupancy", () => {
  const saturation =
    "2026-09-19T02:10:55Z WARN service=payment-api db_connections=100 max_connections=100";
  const timeout =
    "2026-09-19T02:12:03Z ERROR service=payment-api error=ConnectionPoolTimeout";
  for (const raw of [
    saturation + "\n" + timeout.replace("payment-api", "other-api"),
    saturation + "\n" + timeout.replace("02:12:03", "02:09:03"),
    saturation + "\n" + timeout.replace("02:12:03", "03:12:03"),
    saturation.replace("db_connections=100", "db_connections=94") +
      "\n" +
      timeout,
    saturation + "\n" + timeout + " did not happen",
    saturation +
      "\n" +
      timeout.replace(
        "error=ConnectionPoolTimeout",
        "error=NotConnectionPoolTimeout",
      ),
  ])
    assert.deepEqual(poolSupport(buildTimeline(raw)), []);
});

test("schema rejects missing fields, invalid enums, extra fields and stringified JSON", () => {
  for (const value of [
    {},
    { ...demoAnalysis(evidence), severity: "catastrophic" },
    { ...demoAnalysis(evidence), extra: "unverified" },
    JSON.stringify(demoAnalysis(evidence)),
  ]) {
    assert.throws(() => verifyAnalysis(value, evidence), /schema/);
  }
});

test("confidence inflation fails validation", () => {
  const events = buildTimeline(ambiguous);
  const value = demoAnalysis(events);
  value.confidence.level = "moderate";
  assert.throws(() => verifyAnalysis(value, events), /Confidence or severity/);
});

test("bad provider output ends FAILED with no analysis", async () => {
  const result = await analyzeIncident(well, {
    ...demoProvider,
    analyze: async () => ({ nope: true }),
  });
  assert.equal(result.state, "FAILED");
  assert.equal(result.analysis, null);
  assert.equal(result.error?.code, "MALFORMED_OUTPUT");
  assert.ok(!result.trace.some((t) => t.state === "VERIFIED"));
});

test("timeout aborts inference and never falls back to a fabricated demo answer", async () => {
  let signal: AbortSignal | undefined;
  const result = await analyzeIncident(
    well,
    {
      identity: { kind: "bedrock", model: "test-only" },
      analyze: async (_events, supplied) => {
        signal = supplied;
        return new Promise(() => {});
      },
    },
    { timeoutMs: 5 },
  );
  assert.equal(result.state, "FAILED");
  assert.equal(result.error?.code, "PROVIDER_TIMEOUT");
  assert.equal(result.analysis, null);
  assert.equal(signal?.aborted, true);
  assert.equal(result.backend.kind, "bedrock");
});

test("provider exception is sanitized", async () => {
  const result = await analyzeIncident(well, {
    ...demoProvider,
    analyze: async () => {
      throw new Error("password=sensitive-server-value");
    },
  });
  assert.equal(result.error?.code, "PROVIDER_ERROR");
  assert.ok(!JSON.stringify(result).includes("sensitive-server-value"));
});

test("empty and oversized bundles fail before inference", async () => {
  for (const input of [
    "",
    "x".repeat(64_001),
    Array(202).fill("x").join("\n"),
  ]) {
    const result = await analyzeIncident(input, demoProvider);
    assert.equal(result.state, "FAILED");
    assert.equal(result.error?.code, "INVALID_INPUT");
  }
});

test("terminal states reject illegal transitions", async () => {
  const result = await analyzeIncident(well, demoProvider);
  assert.throws(() => transition(result, "ANALYZED", () => "now"), /Illegal/);
});

test("HTTP handler runs full flow, returns no-store and meaningful errors", async () => {
  const request = (body: string, contentType = "application/json") =>
    new Request("http://localhost/api/analyze", {
      method: "POST",
      headers: { "content-type": contentType },
      body,
    });
  const response = await handleAnalysis(
    request(JSON.stringify({ incident: well })),
    () => demoProvider,
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal((await response.json()).state, "READY_FOR_REVIEW");
  assert.equal(
    (await handleAnalysis(request("{"), () => demoProvider)).status,
    400,
  );
  assert.equal(
    (await handleAnalysis(request("{}", "text/plain"), () => demoProvider))
      .status,
    415,
  );
  assert.equal(
    (await handleAnalysis(request("x".repeat(256_001)), () => demoProvider))
      .status,
    413,
  );
  assert.equal(
    (
      await handleAnalysis(request(JSON.stringify({ incident: well })), () => {
        throw new Error("config");
      })
    ).status,
    503,
  );
  assert.equal(
    (
      await handleAnalysis(request(JSON.stringify({ incident: well })), () => ({
        ...demoProvider,
        analyze: async () => ({}),
      }))
    ).status,
    502,
  );
});
