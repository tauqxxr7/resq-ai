# Verification record

Local verification completed 2026-09-25 on Windows with Node 24.14.0 and npm 11.19.1. Initial implementation/browser checks began 2026-09-24. No AWS credentials, shared AWS configuration or AWS CLI were available at inventory time. **No live AWS calls were made.**

## Commands and outcomes

| Command | Outcome |
|---|---|
| `npm test` | PASS: 22 tests, 0 failures; includes fake-transport Bedrock tests, redaction, citation/claim enforcement, invalid output, ambiguous evidence, timeout and complete HTTP-handler flow |
| `npm run lint` | PASS, no lint errors |
| `npm run typecheck` | PASS, route types generated and `tsc --noEmit` completed |
| `npm run build` | PASS, optimized Next.js 16.3.5 build with `/`, `/api/analyze`, `/api/fixtures/[name]`, `/api/status` |
| `npm run samples` | PASS: payment → READY_FOR_REVIEW; ambiguous and redaction → NEEDS_MORE_EVIDENCE |
| `npm run demo` | PASS: local server on 127.0.0.1:3000; browser calls reached the real Next.js API |
| `git diff --check` | PASS, no whitespace errors; Windows line-ending notices only |
| `npm run verify:bedrock` | NOT RUN: live credentials/model access unavailable; documented for the owner's AWS account |

The first dependency install and the default Next.js dev/typecheck child launch failed with Windows `spawn EPERM`. Dependencies were installed with lifecycle scripts disabled. The local runner uses Next's public custom-server API; Next is configured to use thread workers and the TypeScript API checker. Type checking is not disabled. Final tests use the native Node test runner without child-process isolation.

## Browser walkthrough

Story: load evidence → POST `/api/analyze` → deterministic redaction/timeline/provider/validation → rendered assessment and source citations → export.

| Boundary | Observed evidence |
|---|---|
| Initial UI/status | Dashboard loaded; status became `Demo available · no AWS calls` from `/api/status` |
| Payment fixture → analysis | Seven timeline lines, critical severity, `READY_FOR_REVIEW`, demo backend `deterministic-rules-v1` |
| Causal support | Canonical pool-exhaustion statement cites E0003 and E0004; trigger explicitly remains unconfirmed |
| Citation navigation | Clicking the root E0003 citation changed the URL to `#E0003` and focused the source-line container |
| Ambiguous evidence | `NEEDS_MORE_EVIDENCE`, cause unconfirmed, low qualitative confidence |
| Redaction fixture | Six server replacements; fake token/email/IP/password/key/phone absent from resulting evidence |
| Markdown export | Export text area contained the complete brief, original line mapping and execution trace |
| JSON export | Export text parsed as JSON with READY_FOR_REVIEW, demo identity and seven evidence lines |
| Browser logs | No warning/error entries returned during successful walkthroughs |
| Screenshot | [`screenshots/demo.png`](screenshots/demo.png) is an actual browser capture of the local deterministic demo, not a generated mockup |

The embedded browser did not deliver a download event when tested; successful native file-download completion is **not claimed**. Both selectable export previews were verified; CLI-generated Markdown/JSON artifacts are also available. Upload UI exists but native file-chooser interaction was not separately exercised. Failure/timeout handling was exercised by automated tests, not a live Bedrock failure.

## Reviewable change inventory

- `frontend/app/page.tsx`, `globals.css`, `layout.tsx`: review UI, local fixture/upload/paste inputs, live status, citations, states, exports, metadata and offline system fonts.
- `frontend/app/api/**`: analysis, status and allowlisted fixture endpoints.
- `frontend/lib/**`: runtime schema, deterministic redaction/parser, support policy, explicit state machine, provider interface, demo/Bedrock providers, HTTP limits and brief renderer.
- `frontend/fixtures/**`, `tests/**`, `scripts/**`: synthetic scenarios, 22 tests, sample generation and portable local demo server.
- `frontend/.env.example`, `.gitignore`, `next.config.ts`, `tsconfig.json`, manifests and lockfile: server configuration and verified runtime/dependency setup.
- Root `package.json`, `scripts/**`: one-command demo and explicit live Bedrock smoke-test helper.
- `.github/workflows/verify.yml`: Linux CI configuration; no hosted CI result claimed in this local record.
- Root/frontend/historical-starter READMEs and `docs/**`: inventory, architecture, honest feature status, reproducible outputs, screenshot and three-minute presentation script. Existing starter source/assets preserved.

## Remaining deployment blockers

1. Configure an AWS account/region/model with IAM invocation permission and valid server credentials; run the documented two-fixture Bedrock smoke test and retain real invocation evidence.
2. Choose and configure a Node-capable Next.js host with `frontend` as its application root. Static hosting cannot run the API. No infrastructure or deployed endpoint is provided by this change.
3. Keep Bedrock mode private until authentication, rate/cost controls and appropriate infrastructure logging are supplied. No production hardening or multi-user isolation is claimed.
4. Validate the actual judge browser's native download behavior and the intended hosting environment. Hosted CI and cross-platform fresh installs were not exercised locally.

No benchmark scores, cloud runs, judge feedback, external-project capabilities or screenshots were invented.
