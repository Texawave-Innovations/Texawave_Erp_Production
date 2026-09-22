## What changed and why

<!-- One or two sentences. Link an issue/ticket if there is one. -->

## Scope check

- [ ] This PR does what it says and nothing more — no unrelated refactors, renames, or "while I was in there" cleanup bundled in.
- [ ] If it touches a shared/sensitive path (new dependency, `packages/*` boundary, `apps/api/src/platform` or `common`/`shared`, `packages/ui-kit` tokens/components, CI/lint config), that's called out below, not left for the reviewer to notice.

## Validation performed

<!-- Exact commands run and their actual outcome — not "should pass." -->

- [ ] `pnpm exec turbo run lint typecheck test build`
- [ ] Backend e2e (`pnpm --filter api test:e2e`), if this touches auth/tenancy/permissions or a module's data access
- [ ] Browser e2e (`pnpm --filter ui test:e2e`), if this touches an authenticated UI flow
- [ ] Manually exercised in a browser at mobile + desktop width, light + dark, if this is a UI change

## Docs/CODING_STANDARDS.md checklist

(See §17 for the full list — highlights below.)

- [ ] No hardcoded hex/px colors — uses tokens from `packages/ui-kit/src/theme.css`.
- [ ] No direct Prisma call outside a `*.repository.ts` file.
- [ ] Every repository method touching tenant data is `@OrgScoped()`, `scope` as the first explicit parameter.
- [ ] No cross-module import of another module's repository.
- [ ] Tests added/updated; nothing skipped without a comment explaining why.
- [ ] No new bare `eslint-disable`/`@ts-ignore` — every one has a `-- reason: ...` description.

## Anything left incomplete or known-broken

<!-- Say so explicitly rather than letting a reviewer discover it. "None" is a fine answer. -->

---

**Note for repo admins, not contributors:** this template and `.github/workflows/ci.yml` don't
by themselves block a merge — GitHub's branch protection settings (Settings > Branches, on
`main`) must separately require the `CI / checks` status check (and Code Owner review) to pass
before merge is allowed. That's outside this repo's files; see
`Docs/CODING_STANDARDS.md` §17.
