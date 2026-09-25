# Initial inventory — 2026-09-24

Inspected all tracked source/configuration, both manifests and lockfiles, and git history at `3a8ace4`. New checkout was clean; no existing local edits.

- `frontend`: Next.js 16.3.5 / React 19.2.8 client dashboard. It loads a hardcoded payment log and posts to an unspecified `NEXT_PUBLIC_API_URL`. This is source inspection, not proof of a working remote service.
- `demo/frontend`: unmodified create-next-app starter. Preserved for history; excluded from the supported demo/build. Use `frontend` exclusively.
- No API handler, AWS SDK, Lambda source, IaC, deployment metadata, CI, tests, redaction, citation verification, or incident exports were present.
- `AWS Backend Online` was an unconditional UI label. Root README contained only the project name.
- No AWS environment-variable names, shared credentials/config files, or AWS CLI were available in this environment. No AWS calls were attempted during inventory.
- Public SVGs and favicons are starter assets, not demo evidence. No custom screenshots or recordings existed.

External reference: only the public README of https://github.com/AdityaP9116/ResQ-AI was inspected for documentation ideas. Its launch scripts, mission reports and explicit states suggest useful reproducibility/trace documentation patterns. Its capabilities were not verified. No code, assets, claims or drone architecture were imported.
