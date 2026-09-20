# @texawave-erp/api-types

**Current state: hand-written.** Every file here mirrors a specific backend
DTO/response shape by hand and says so in a header comment
(`// HANDWRITTEN — see ...`). There is no generation pipeline yet.

**Target state** (Docs/ARCHITECTURE.md §2): generated from the NestJS
OpenAPI document (`apps/api` already serves one at `/docs-json` via
`@nestjs/swagger`) using a tool such as `openapi-typescript`, wired into a
`generate` script here and into CI, so `ui`/`mobile` and `api` cannot
silently drift.

**Until that pipeline exists:**

- When a backend DTO or response shape changes, update the matching file
  here in the _same_ PR — there is no automated check that will catch drift
  for you yet.
- When the generation pipeline is built, delete the hand-written files it
  replaces in that same PR and remove this notice.
