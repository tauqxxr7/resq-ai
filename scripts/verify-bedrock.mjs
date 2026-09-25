import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";

// This deliberately refuses demo mode. Run only against your own Bedrock-enabled server.
const base = process.env.RESQ_BASE_URL || "http://127.0.0.1:3000";
const status = await fetch(`${base}/api/status`).then((r) => r.json());
assert.equal(status.kind, "bedrock", "Server is not in Bedrock mode. npm run demo always forces demo.");
assert.equal(status.configured, true, "Bedrock configuration is incomplete.");
const report = { testedAt: new Date().toISOString(), base, status, runs: [] };
for (const name of ["well-evidenced", "ambiguous"]) {
  const incident = await readFile(new URL(`../frontend/fixtures/${name}.txt`, import.meta.url), "utf8");
  const response = await fetch(`${base}/api/analyze`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ incident }), signal: AbortSignal.timeout(30_000),
  });
  const result = await response.json();
  report.runs.push({ fixture: name, httpStatus: response.status, result });
}
await mkdir(new URL("../docs/local-validation/", import.meta.url), { recursive: true });
await writeFile(new URL("../docs/local-validation/bedrock.json", import.meta.url), JSON.stringify(report, null, 2));
for (const run of report.runs) {
  assert.equal(run.httpStatus, 200, `${run.fixture}: HTTP ${run.httpStatus}; inspect docs/local-validation/bedrock.json`);
  assert.equal(run.result.backend.kind, "bedrock");
  assert.equal(run.result.state, run.fixture === "ambiguous" ? "NEEDS_MORE_EVIDENCE" : "READY_FOR_REVIEW");
}
console.log("Both Bedrock fixture flows passed. Review docs/local-validation/bedrock.json and AWS-side invocation records before claiming cloud validation.");
