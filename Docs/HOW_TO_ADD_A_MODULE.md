# How to add a module

**For:** anyone adding a new backend module (`apps/api/src/modules/<name>/`) and/or frontend
feature (`apps/ui/src/features/<name>/`) for the first time in this repo.
**Not canonical** — this is a practical walkthrough of applying the rules that already live in
`Docs/ARCHITECTURE.md` (module boundaries, data model) and `Docs/CODING_STANDARDS.md` (file
shape, `@OrgScoped()`/`@TeamScoped()`, testing, PR checklist). Where this doc and one of those
disagree, the canonical doc wins — file a fix here.
**Owner:** repository maintainers.
**Last verified:** 2026-09-22, against `apps/api/src/modules/_reference/tags/` and
`apps/ui/src/features/_reference/tags/`, the live, tested reference implementation this doc
annotates.

---

## 1. What `pnpm scaffold:module <kebab-case-name>` does and doesn't do

The script is `scripts/scaffold-module.mjs`. It generates two folders from the reference
pattern:

- `apps/api/src/modules/<name>/` — controller, service, repository, three DTOs
  (`create`/`update`/`query`), and a service spec placeholder.
- `apps/ui/src/features/<name>/` — `api.ts`, `hooks.ts`, `schema.ts`, and an empty
  `components/` folder.

**It validates:** the name is kebab-case (`Docs/CODING_STANDARDS.md` §2) and isn't reserved
(`_reference`/anything starting with `_`). **It refuses to overwrite** an existing module or
feature folder — this is deliberate; it never silently clobbers work in progress.

**It deliberately does NOT:**

- Create a Prisma model. You add that to `packages/database/prisma/schema.prisma` yourself and
  run the migration.
- Pick or seed a permission string. Every generated controller route carries
  `@RequirePermission("TODO.permission")` — a real string is your decision, seeded in
  `packages/database/prisma/seed.ts`.
- Wire the new module into `apps/api/src/app.module.ts`. A half-generated module is never
  silently live; you import it yourself once it actually does something.
- Fill in real wire types in `packages/api-types`, or write real tests. Every generated file
  with a `// GENERATED SCAFFOLD` header has TODOs — don't ship one of those files without
  resolving them.

Every generated file says exactly what's still missing in its own header comment; the script's
own console output repeats the same list as a final checklist. Treat scaffolding as "the
boilerplate is typed for you," not "the module is started for you."

---

## 2. Backend module — the exact file list

Reference: `apps/api/src/modules/_reference/tags/`. Every file's job, annotated against that
example:

```
<name>/
├── <name>.module.ts            # wires controller + providers together, nothing else
├── <name>.controller.ts        # routing, @RequirePermission(), request/response shape — no business logic
├── <name>.controller.spec.ts   # (not present on tags yet — add for real modules, §14)
├── <name>.service.ts           # business rules; the ONLY layer allowed to resolve scope from context
├── <name>.service.spec.ts      # required — unit tests for the business rules above
├── <name>.repository.ts        # the ONLY place PrismaService is called; every method is @OrgScoped()/@TeamScoped()
└── dto/
    ├── create-<name>.dto.ts    # class-validator decorators; the request-validation contract
    ├── update-<name>.dto.ts    # `extends PartialType(Create<Name>Dto)` — don't hand-duplicate fields
    └── query-<name>.dto.ts     # `extends PaginationDto` + filter fields (e.g. `search`)
```

`entities/` and `events/` (`Docs/ARCHITECTURE.md` §3) are added only when needed — an entity
class when the response shape differs from the Prisma model (e.g. hiding `passwordHash`), an
`events/` folder the moment the module emits its first domain event.

Walking `tags` file by file:

- **`tags.module.ts`** — `@Module({ controllers: [TagsController], providers: [TagsRepository, TagsService] })`.
  No exports unless another module needs a synchronous read via this module's public service
  (`Docs/CODING_STANDARDS.md` §11) — `tags` doesn't, so it exports nothing.
- **`tags.controller.ts`** — one `@RequirePermission("reference.tags.read" | "reference.tags.write")`
  per route, `@Paginate(QueryTagDto)` for the list endpoint, `ParseIntPipe` on every `:id` param
  (integer PKs — `Docs/ARCHITECTURE.md` §5.1). Every method is a one-line delegation to the
  service. No `this.prisma` anywhere in this file — if you find yourself reaching for Prisma in
  a controller, stop.
- **`tags.service.ts`** — resolves `OrgScope` from `TenantContextService.getOrgScope()` (never
  reads CLS directly in the repository — the service is where request context lives), then
  passes that scope explicitly into every repository call. Business rules live here: `create()`
  checks for a name collision and throws `ResourceConflictException` _before_ calling the
  repository; `findOne()`/`update()`/`remove()` translate "repository returned
  null/false" into `ResourceNotFoundException` — the repository itself never throws a
  business exception, only the service does.
- **`tags.repository.ts`** — every exported method takes `scope: OrgScope` as its **first**
  parameter and is decorated `@OrgScoped()`. Filters are always built with `tenantWhere(scope,
filter)`, never a hand-built `where` object, so scope can never lose a merge fight with a
  caller-supplied filter (`Docs/CODING_STANDARDS.md` §10). Soft-delete is `updateMany({
deletedAt: new Date() })`, never an actual `delete`.
- **`dto/create-tag.dto.ts`** — every field has a `class-validator` decorator
  (`@IsString()`, `@Length()`, `@IsIn()`, ...) and an `@ApiProperty()`/`@ApiPropertyOptional()`
  for Swagger. `customFields` is `@IsObject()` + optional, matching the §5.1 baseline.
- **`dto/update-tag.dto.ts`** — `PartialType(CreateTagDto)`. Don't hand-write update fields
  separately; that's how the two DTOs drift.
- **`dto/query-tag.dto.ts`** — `extends PaginationDto`, plus whatever's filterable (`search`
  here). This is also the type `@Paginate()` validates the query string into.

What `tags` is missing that a **real** module must have (don't copy this gap):
`tags.service.spec.ts` and `tags.controller.spec.ts` don't exist yet — the reference feature's
behavioral proof currently lives entirely in the e2e spec (§14, `apps/api/test/reference-tags.e2e-spec.ts`).
A real module still needs unit tests for the service layer per `Docs/CODING_STANDARDS.md` §14 —
don't point at `tags` as an excuse to skip them.

---

## 3. Frontend feature — the exact file list

Reference: `apps/ui/src/features/_reference/tags/`.

```
features/<name>/
├── api.ts                      # thin wrappers around packages/core's apiClient — never fetch() directly
├── hooks.ts                    # TanStack Query hooks, org-scoped query keys
├── schema.ts                   # zod schema mirroring the backend DTO (lives in packages/core for tags; see below)
└── components/
    ├── <Name>Form.tsx           # controlled form, client-side zod validation, all Design System states
    └── <Name>sView.tsx          # the screen: loading/empty/error/permission-denied states + the form
```

Walking `tags` file by file:

- **`api.ts`** — one function per endpoint (`listTags`/`getTag`/`createTag`/`updateTag`/`deleteTag`),
  each a thin call through `apiClient` (`packages/core/src/api/client.ts`), wrapped in
  `withAuthRetry()` (`apps/ui/src/lib/api-client.ts`) for the silent-refresh-on-401 behavior.
  Typed against `@texawave-erp/api-types` (currently hand-written for `tags` — see
  `packages/api-types/README.md`). List calls return the full `{ data, meta }` envelope; single-
  resource calls unwrap `.data` before returning.
- **`hooks.ts`** — one `useQuery`/`useMutation` per operation. Every query key starts with
  `orgScopedKey(organizationId, ...)` (`packages/core/src/query/query-keys.ts`) — read
  `organizationId` off `useAuthStore`, guard the query with `enabled: Boolean(organizationId)`.
  Every mutation's `onSuccess` invalidates the org-scoped key prefix, not a hand-picked single
  key, so any list/detail query sharing that prefix refetches.
- **`schema.ts` / the zod schema** — for `tags` this lives in `packages/core/src/schemas/tag.schema.ts`
  rather than inside the feature folder, specifically because it's imported by both the form
  (client-side validation) and could in principle be reused by `apps/mobile` later — `packages/core`
  is framework-agnostic (`Docs/ARCHITECTURE.md` §2). Put your schema in `packages/core/src/schemas/`
  too if it's a real validation contract; a feature-local `schema.ts` is fine for something that
  will only ever be used by that one screen. Either way it must mirror the backend's `create-<name>.dto.ts`
  field-for-field, so client and server reject the same input the same way.
- **`components/TagForm.tsx`** — a plain controlled form (no form library). Validates with
  `createTagSchema.safeParse()` on submit, maps zod issues to field errors, and **does not
  reset values on a failed submit** (`Docs/DESIGN_SYSTEM.md` "preserve entered values") — the
  `try { await onSubmit() } catch { setSubmitError(...) }` block is the whole pattern.
- **`components/TagsView.tsx`** — the composed screen. Branches, in order: `query.isPending` →
  skeleton rows; `query.isError` + `ApiError.isPermissionError` → a permission-denied `Alert`
  naming the required permission string; `query.isError` (anything else) → `ErrorState` with
  `onRetry`; empty list → `EmptyState`; otherwise the `DataTable` + `Pagination`. This is the
  minimum state set `Docs/DESIGN_SYSTEM.md` §3 requires for any new screen.

**Wiring into `app/`:** the route file stays a one-line composition —
`apps/ui/src/app/(dashboard)/reference/tags/page.tsx` is just
`export default function ReferenceTagsPage() { return <TagsView />; }`. Don't put markup, hooks,
or data fetching in `app/`; that's what `features/<name>/` is for
(`Docs/CODING_STANDARDS.md` §4).

**Wiring into the query client:** nothing feature-specific to configure — `createQueryClient()`
(`apps/ui/src/lib/query-client.ts`) is one shared instance for the whole app (retry policy: never
retry a 4xx, retry network/5xx twice). Your feature's hooks just call `useQuery`/`useMutation`
against it; the org-scoped key convention above is what keeps your feature's cache entries from
colliding with anyone else's.

---

## 4. `@OrgScoped()` / `@TeamScoped()` / `@RequirePermission()` together

These three operate at **different layers** — mixing them up (e.g. expecting `@OrgScoped()` on a
controller) is the most common mistake when copying the reference pattern into a real module:

| Decorator              | Layer      | What it does                                                                         |
| ---------------------- | ---------- | ------------------------------------------------------------------------------------ |
| `@RequirePermission()` | controller | declares the permission string `PermissionsGuard` checks before the handler runs     |
| `@OrgScoped()`         | repository | runtime assertion that the method's first param is a valid `OrgScope`                |
| `@TeamScoped()`        | repository | same, for `TeamScope` — HR/team-boundary data only (`Docs/CODING_STANDARDS.md` §10a) |

`tags` only needs `@OrgScoped()` (it isn't team-scoped data). A real HR module needs both
`@RequirePermission()` **and** `@TeamScoped()` together. Before/after for a hypothetical
`employees` module:

```ts
// ❌ BEFORE — compiles, but is wrong in three ways
@Controller("employees")
export class EmployeesController {
  @Get()
  findAll() {
    return this.employees.findAll(); // no @RequirePermission() — route is reachable by anyone authenticated
  }
}

@Injectable()
export class EmployeesService {
  findAll() {
    return this.repository.findMany(); // no scope resolved or passed at all
  }
}

@Injectable()
export class EmployeesRepository {
  findMany() {
    return this.prisma.employee.findMany(); // reads every org's, every team's rows
  }
}
```

```ts
// ✅ AFTER — matches the tags/HR pattern
@Controller("employees")
export class EmployeesController {
  @Get()
  @RequirePermission("hr.employee.read.team") // checked by PermissionsGuard before the handler runs
  findAll(@Paginate(QueryEmployeeDto) pagination: QueryEmployeeDto) {
    return this.employees.findAll(pagination); // no scope logic here — the service resolves it
  }
}

@Injectable()
export class EmployeesService {
  constructor(
    private readonly repository: EmployeesRepository,
    private readonly teamContext: TeamContextService,
  ) {}

  findAll(pagination: PaginationDto) {
    // resolves the caller's .own/.team/.all level from their permission set
    const scope = this.teamContext.resolveScope("hr.employee.read");
    return this.repository.findMany(scope, pagination);
  }
}

@Injectable()
export class EmployeesRepository {
  @TeamScoped() // runtime guard: throws if called without a valid TeamScope
  findMany(scope: TeamScope, pagination: PaginationDto) {
    return this.prisma.employee.findMany({
      where: teamWhere(scope, { deletedAt: null }), // scope always wins the merge
      skip: pagination.skip,
      take: pagination.limit,
    });
  }
}
```

If a table is tenant-scoped but **not** team-scoped (most platform tables — `tags` is the
example), use `OrgScoped()`/`OrgScope`/`tenantWhere()` in exactly the same shape instead —
`TenantContextService.getOrgScope()` in the service, not `TeamContextService.resolveScope()`.
Never call both for the same method; a table is one or the other.

**Permission string reminder** (`Docs/CODING_STANDARDS.md` §10a PR checklist): any new
`hr.*`/`employee_self_service.*` permission gets all three scope variants
(`.own`/`.team`/`.all`) seeded in `seed.ts` up front, even if only one is wired to a role today —
see `Docs/CODING_STANDARDS.md`'s "Permission Naming Convention" section for the full pattern and
real examples.

---

## Checklist — before opening a PR for a new module

- [ ] Migration — Prisma model added, `pnpm --filter database exec prisma migrate dev` run, the
      generated migration file committed (never hand-edited, never `db push`).
- [ ] Backend e2e spec (`apps/api/test/<name>.e2e-spec.ts`) — proves tenant isolation (404, not
      just absent from a list — see `reference-tags.e2e-spec.ts`) and, for team-scoped data, a
      negative test that a team-lead-scoped user is denied/filtered on another team's data.
- [ ] Playwright spec (`apps/ui/e2e/<name>.spec.ts`) for any new authenticated UI flow, using
      `getByRole`/`getByLabel` locators.
- [ ] DTO validation — every field on every DTO has a `class-validator` decorator; unknown
      fields are rejected (global `ValidationPipe` already does this — verify with a test, don't
      just assume).
- [ ] Permission strings added to `seed.ts` (all three `.own`/`.team`/`.all` variants if the data
      is team-scoped) and granted to the relevant role(s).
- [ ] Backend unit tests (`<name>.service.spec.ts`) for real business-rule behavior, not
      `expect(service).toBeDefined()`.
- [ ] New module imported into `apps/api/src/app.module.ts` (the scaffold script deliberately
      doesn't do this for you).
- [ ] `pnpm exec turbo run lint typecheck test build` passes.
