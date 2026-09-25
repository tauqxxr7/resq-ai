# Three-minute judge presentation

Before judging: install dependencies, run `npm run demo`, open http://127.0.0.1:3000, warm all three fixtures once, and return to a fresh page. Keep demo mode visible. Have `docs/samples` ready as a reproducible fallback. This script describes the local deterministic demo, not a verified AWS run.

**0:00–0:25 — Problem and boundary**

“During an outage, a plausible answer can be more dangerous than no answer. ResQ turns a small incident evidence bundle into a timeline, a cited hypothesis and concrete next checks. Every result is for human review. This screen is explicitly running our deterministic demo provider, with no AWS calls.”

**0:25–1:05 — Show evidence before conclusions**

Click **Payment outage**, then **Analyze incident**.

“Here are synthetic payment-service logs. ResQ redacts known sensitive patterns, assigns IDs tied to the original line numbers, and orders events by timestamp. The execution trace records each real stage. Our provider returns a typed schema; validation happens before review.”

Point to `READY_FOR_REVIEW`, the backend/model identity and moderate qualitative confidence.

**1:05–1:35 — Inspect the hypothesis**

“The supported failure mechanism is connection-pool exhaustion. E0003 reports 100 of 100 connections. E0004 reports a connection-pool timeout for the same service shortly afterwards.” Click **E0003**, then inspect E0004 in the timeline.

“Notice what we do not infer: the nearby deployment did not prove a connection leak. The underlying trigger remains unconfirmed. Confidence is qualified evidence support, not a calibrated percentage.”

**1:35–2:00 — Demonstrate restraint**

Click **Ambiguous incident**, then **Analyze incident**.

“A deployment and request timeout are not enough. This run correctly says cause unconfirmed and asks for more evidence. Unknown citations, malformed output and unsupported root statements are rejected. A timeout yields a failure, not a substituted answer.”

**2:00–2:25 — Privacy and handoff**

Click **Redaction test**, point out the synthetic-only warning, then analyze.

“These are deliberately fake values. The server removes six demonstrated values before inference. Regex redaction has known gaps, so reviewers must still inspect the preview. We export the redacted brief and complete trace.” Click **Export brief .md** and show the selectable export preview if a download is blocked.

**2:25–3:00 — AWS architecture and honest scope**

“The same provider interface has a server-only Amazon Bedrock Converse adapter. Credentials stay in the AWS SDK credential chain, never in the browser. Both providers pass the same schema and citation checks. We verified request construction with a fake transport; we have not exercised live AWS inference in this environment. The README provides an exact two-fixture Bedrock smoke test. Today this is a working, reproducible local vertical slice with explicit limits: one supported mechanism, no automatic remediation, and no claim of production deployment.”

If you later complete live AWS validation, replace only the last statement with your actual model, region, invocation date and saved validation evidence. Never imply the deterministic run was AI inference.
