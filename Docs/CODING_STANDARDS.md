# TexaWave ERP — Coding Standards & Folder Structure Reference

**For every contributor.** If you're adding a file and you're not sure where it goes, this doc answers that before you ask. Companion docs: `ARCHITECTURE.md` (system design, data model, module boundaries), `DESIGN_SYSTEM.md` (tokens, component contracts) — this doc is about _how we write code inside that architecture_.

**Owner:** repository maintainers — assign a named owner/team before business-module work begins.
**Last verified:** 2026-09-18, against the actual repository state.
**Status:** §1–§9, §12–§13 describe target conventions being actively built out (see `apps/api/src`, `apps/ui/src` for current state). §10 (`@OrgScoped`) and §11 (cross-module coordination) were rewritten on this date to fix examples that didn't compile / had a scope-override hole — see git history for the prior text if you need it.

---

## 1. Repo layout (as scaffolded — Phase 0, already done)

```
texawave-erp/
├── apps/
│   ├── api/            # NestJS backend — Vitest for tests
│   ├── ui/              # Next.js (App Router), Tailwind v4
│   └── mobile/          # Expo — untouched until mobile work starts
├── packages/
│   ├── config/          # tsconfig.base.json, eslint.config.js, prettier.config.js
│   ├── core/             # framework-agnostic business logic, API client, zod schemas
│   ├── api-types/        # wire-contract TS types/DTOs — target: OpenAPI-generated; currently
│   │                      # hand-written for the reference feature only (see ARCHITECTURE.md §2)
│   ├── ui-kit/            # shared design-system primitives + theme.css
│   └── database/          # Prisma schema, migrations, seed
├── deployment/            # CI plumbing only
├── Docs/
│   ├── ARCHITECTURE.md
│   ├── CODING_STANDARDS.md
│   └── DESIGN_SYSTEM.md
├── .husky/
├── docker-compose.yml
├── turbo.json
└── pnpm-workspace.yaml
```

**Rule:** nothing shared or app-specific lives at repo root. Root only holds workspace glue, git hooks, docker-compose, and docs.

---

## 2. Naming conventions

| What                                       | Convention                                    | Example                                                   |
| ------------------------------------------ | --------------------------------------------- | --------------------------------------------------------- |
| Folders (features/modules)                 | kebab-case                                    | `sales-orders/`, `delivery-challans/`                     |
| NestJS files                               | kebab-case + type suffix                      | `sales-orders.controller.ts`, `create-sales-order.dto.ts` |
| React components                           | PascalCase file = PascalCase export           | `InvoiceTable.tsx`                                        |
| Component folders (ui-kit primitives)      | kebab-case folder, `index.tsx` inside         | `components/date-picker/index.tsx`                        |
| Hooks                                      | camelCase, `use` prefix                       | `useInvoices.ts`                                          |
| Prisma models                              | PascalCase singular                           | `model SalesOrder { ... }`                                |
| DB table/column names (via `@@map`/`@map`) | snake_case                                    | `sales_orders`, `organization_id`                         |
| Branches                                   | `<type>/<ticket-or-slug>`                     | `feat/sales-invoice-crud`                                 |
| Commits                                    | Conventional Commits (enforced by commitlint) | `feat(sales): add invoice status transitions`             |
| Permission strings                         | `<module>.<entity>.<action>`                  | `sales.invoice.approve`                                   |

---

## 3. Backend module standard (NestJS)

Every feature module — no exceptions, no "just this once it's simpler inline":

```
sales-orders/
├── sales-orders.module.ts
├── sales-orders.controller.ts
├── sales-orders.controller.spec.ts
├── sales-orders.service.ts
├── sales-orders.service.spec.ts
├── sales-orders.repository.ts
├── dto/
│   ├── create-sales-order.dto.ts
│   ├── update-sales-order.dto.ts
│   └── query-sales-order.dto.ts
└── entities/                      # only if response shape differs from the Prisma model
```

- **Controller**: routing, request/response shape, validation pipe, guards. No business logic.
- **Service**: business rules. Depends on the repository via constructor injection, never a direct Prisma import.
- **Repository**: the _only_ place `PrismaService` is called. Finding `this.prisma.salesOrder.*` inside a service is a standards violation — move it to the repository. Apply `@OrgScoped()` (§10) to every repository method that reads/writes tenant data.
- **Entities**: mandatory only when the response shape differs from the Prisma model (hiding `password_hash`, flattening a relation); returning the Prisma model as-is is fine otherwise.
- `apps/api/src/shared/` is for _injectable infra providers_ used by 2+ modules — `PrismaService`, the Redis client provider, the email/notification adapter, the encryption service. These are real NestJS providers with a DI token, importable via `SharedModule`.
- `apps/api/src/common/` is _framework-pipeline primitives with no external I/O and no DI-managed state of their own_ — filters, interceptors (except the tenancy one, see below), decorators (`@OrgScoped()`, `@Paginate()`, `@RawResponse()`), the `OrgScope` type + `tenantWhere()` pure helper (`common/tenancy/`), shared DTO base classes, constants, exception classes.
- `apps/api/src/platform/` owns auth, tenancy, and other cross-cutting _platform capabilities_ that are real injectable NestJS providers with request-scoped state — `platform/auth/` (login/refresh), `platform/tenancy/` (`TenantContextService` backed by `nestjs-cls`, `TenancyInterceptor` that populates it from the validated JWT), `platform/users/`, `platform/roles-permissions/`.
- Rule of thumb: if it holds a database/network/queue connection or wraps one, it's `shared/`. If it's a stateless pipeline primitive with no DI dependencies, it's `common/`. If it's a real NestJS module/provider implementing a cross-cutting platform concern (auth, tenancy, audit), it's `platform/`.
- If only one module uses something, it lives inside that module's own folder either way — neither `common/` nor `shared/` is a place to put module-specific code "just in case it's reused later."

---

## 4. Frontend standard (Next.js)

- `app/` = routing only. Route groups (`(auth)`, `(dashboard)`, `(employee-portal)`) control layout/auth, nothing else.
- `features/<module>/` = all real code: `components/`, `hooks/`, `api.ts`, `schema.ts`. The `app/` page file imports from here and stays thin.
- `components/<primitive>/index.tsx` (in `packages/ui-kit` or `apps/ui/src/components`) = dumb, reusable, no API calls, no domain knowledge.
- `components/widgets/` or `features/<module>/components/` = composed, domain-aware (`InvoiceStatusBadge`, `TaskAssigneePicker`). If a component reads from `statuses` or calls a hook that hits the API, it's a widget — it does not belong in `ui-kit`.

---

## 5. SOLID — applied concretely

**S — Single Responsibility.** A service method does **one** of: fetch/persist data, apply a business rule, or shape a response — never two. If `InvoicesService.create()` validates payment terms _and_ posts a journal entry _and_ formats the response, split it into three collaborators.

**O — Open/Closed.** Prefer extending via data or event listeners over editing existing service code:

- New status? Insert a row into `statuses`. Don't add an `if` branch.
- New behavior when an invoice is paid? A new `@OnEvent('invoice.paid')` listener in the new module. Don't edit `InvoicesService` to know about finance.
- New optional field? `custom_fields` JSON key, not a migration + service edit, _unless_ it needs to be queried/filtered/joined — then it earns a real column.

**L — Liskov Substitution.** Avoid class inheritance for special-case business rules. Prefer composition: small, injectable strategy functions/classes (`TaxCalculationStrategy`, `DiscountRule`) passed in, swapped per case.

**I — Interface Segregation.** Repository interfaces stay narrow — a service depending on `SalesOrdersRepository` shouldn't be forced to depend on unrelated methods from a bloated shared interface.

**D — Dependency Inversion.** Services depend on repository _tokens_, not concrete Prisma calls, so the underlying store can change without touching business logic.

---

## 6. Response entities (when the API shape differs from Prisma)

```ts
export class UserEntity {
  @Exclude() password_hash: string;
  // ...other fields...

  constructor(partial: Partial<UserEntity>) {
    Object.assign(this, partial);
  }

  static fromUser(row: AuthUserRow): UserEntity {
    /* flatten relations here */
  }
}
```

Construct the entity from the **raw** row (including the sensitive field) rather than manually omitting it beforehand — that's what makes `@Exclude()` a real guarantee: the interceptor strips it at serialization time no matter how the entity got built.

---

## 7. Global error handling

`apps/api/src/common/filters/all-exceptions.filter.ts` (`@Catch()` everything) turns every thrown error into the same response shape:

```json
{
  "statusCode": 401,
  "message": "Invalid email or password",
  "error": "Unauthorized",
  "path": "/auth/login",
  "timestamp": "...",
  "correlationId": "..."
}
```

Never includes a stack trace in the response body, in any environment — the full error goes to structured logs (§8), keyed by `correlationId`.

Throw a `BusinessException` subclass for business-rule violations, not a raw `HttpException` — it carries an `errorCode` (e.g. `RESOURCE_NOT_FOUND`) that becomes the response's `error` field. `BusinessException` (abstract base) → `ResourceNotFoundException`, `ResourceConflictException` to start; add subclasses as real modules need them, don't build a speculative full taxonomy ahead of need.

Nest's own built-in exceptions (`UnauthorizedException`, `ForbiddenException`, `BadRequestException`, ...) are still fine for framework-level rejections — `BusinessException` is specifically for domain rules a service enforces.

---

## 8. Structured logging & correlation IDs

`nestjs-pino` (JSON-structured, env-driven `LOG_LEVEL`) replaces Nest's default logger globally. Inject Nest's own `Logger` — existing `new Logger(ClassName.name)` call sites get structured output automatically.

Every request gets a `correlationId`, carried through every log line, the exception filter's response body, and the CLS store. Never log secrets — `redact` in `common/logger/logger.module.ts` covers `req.headers.authorization`/`req.headers.cookie`; extend that list, never log request bodies containing passwords/tokens directly.

---

## 9. Response envelope & pagination

Every successful response is wrapped as `{ data, meta }` by `ResponseInterceptor`, registered globally. `packages/core/src/api/client.ts` unwraps it centrally, so frontend call sites work against the inner shape.

**Opting out** (raw response bodies, e.g. `GET /health`): decorate the route with `@RawResponse()`.

**Pagination**: use `@Paginate()` to get a validated `PaginationDto` instead of parsing `page`/`limit` by hand. Note `@Paginate()` is a **controller parameter decorator** (it reads query params off the request) — this is a different kind of decorator from `@OrgScoped()`, which is a **repository method decorator** (§10) and never appears on a controller method or parameter:

```ts
// controller — no scope handling here at all; the service resolves it internally
@Get()
findAll(@Paginate() pagination: PaginationDto) {
  return this.salesOrdersService.findAll(pagination);
}

// service — resolves scope from the tenancy context, passes it explicitly to the repository
findAll(pagination: PaginationDto) {
  const scope = this.tenantContext.getOrgScope();
  return this.salesOrdersRepository.findMany(scope, pagination); // -> PaginatedResponseDto
}
```

Return a `PaginatedResponseDto<T>` from the service/repository — `ResponseInterceptor` detects it via `instanceof` and unwraps it into `{ data: items, meta: { page, limit, total, totalPages } }`.

---

## 10. `@OrgScoped()`

Every repository method that reads/writes tenant data must be scoped by `organizationId`. `@OrgScoped()` is a **runtime guard, not magic** — it does not inject a hidden argument, and it does not make missing scope "structurally impossible" by itself. It exists to (a) fail loudly at runtime if a scope is missing/malformed and (b) guarantee scope always wins over caller-supplied filters, no matter what the filter object contains.

**Corrected pattern — scope is an explicit, typed parameter the caller must pass:**

```ts
// common/tenancy/org-scope.ts
export interface OrgScope {
  organizationId: string;
}

// common/decorators/org-scoped.decorator.ts
// Wraps a repository method whose FIRST parameter is an OrgScope. Throws if it's
// missing or malformed. Does not read anything from CLS itself and does not
// change the method's arity — the TS signature below is exactly what gets called.
export function OrgScoped() {
  return function (
    _target: object,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const original = descriptor.value;
    descriptor.value = function (scope: OrgScope, ...rest: unknown[]) {
      if (
        !scope ||
        typeof scope.organizationId !== "string" ||
        scope.organizationId.length === 0
      ) {
        throw new Error(
          `${propertyKey} was called without a valid OrgScope — this is a coding-standards violation, not a business error`,
        );
      }
      return original.call(this, scope, ...rest);
    };
    return descriptor;
  };
}

// common/tenancy/tenant-where.ts — scope always wins the merge
export function tenantWhere<F extends object>(scope: OrgScope, filter?: F) {
  // Scope is spread LAST: a caller-supplied filter.organizationId can never override it.
  return { ...filter, ...scope };
}
```

```ts
// sales-orders.repository.ts
@OrgScoped()
findMany(scope: OrgScope, filter?: SalesOrderFilter) {
  return this.prisma.salesOrder.findMany({ where: tenantWhere(scope, filter) });
}

// sales-orders.service.ts — the SERVICE reads scope from tenancy context and
// passes it explicitly. Repositories never read CLS themselves — that would
// make them untestable without a request context.
findAll(filter?: SalesOrderFilter) {
  const scope = this.tenantContext.getOrgScope(); // throws OUTSIDE a request context
  return this.salesOrdersRepository.findMany(scope, filter);
}
```

Why this replaces the earlier draft: the previous example showed a call site (`findMany(filter)`) that didn't match the declared signature (`findMany(scope, filter)`) — that doesn't compile, and "the decorator injects the first argument" was never implemented anywhere. The corrected pattern keeps the TypeScript signature honest (what you see is what's called), pushes scope resolution to the service layer (where the request context actually lives via `TenantContextService`, see ARCHITECTURE.md §6), and uses `@OrgScoped()` purely as a defense-in-depth runtime assertion plus the `tenantWhere()` helper to close the override hole. **This decorator is a safety net, not a substitute for code review** — a reviewer still needs to confirm a new repository method both has `@OrgScoped()` and takes `scope` as its first parameter; nothing prevents a developer from writing an unscoped method entirely.

Reference implementation: `apps/api/src/common/tenancy/` (the pure `OrgScope` type + `tenantWhere()` + the `@OrgScoped()` decorator) and `apps/api/src/platform/tenancy/` (the real `TenantContextService` + `TenancyInterceptor` that populate it from the request's JWT via `nestjs-cls`) — see `apps/api/src/modules/_reference/tags/` for the whole pattern wired end to end.

---

## 11. Cross-module coordination

**Repositories are always private.** A module's `*.repository.ts` is never imported by another module, full stop — no exceptions.

**Async side effects go through `EventEmitter2`.** If `sales` needs `finance` to react when an invoice is created, `sales` emits an event; `finance` subscribes. This is the default for "module A did something, module B should react" — it is not the only allowed form of cross-module coordination, but it is the default, and the bar for reaching for a direct call instead should be high.

**Necessary synchronous reads are allowed through a module's public service, not its repository.** Some coordination is genuinely synchronous — e.g. `sales` needs to validate a `customerId` against `master-data` before creating a quotation. For that: `master-data` exports a narrow, purpose-built service (e.g. `MasterDataLookupService`, not `CustomersService` wholesale) from its module and documents it as a public interface; `sales` injects that exported service directly. This is a synchronous, in-process call — not an event — and should be reserved for reads/validations that a caller cannot reasonably proceed without. Do not use this path to trigger side effects in another module; that's what events are for.

**`EventEmitter2` is in-process and non-durable — say so, don't oversell it.** It runs synchronously in the same Node process, in the same request if not explicitly deferred, with no persistence, no retry, and no delivery guarantee across a crash or restart. If a listener throws, the emitting call is unaffected but the failure is easy to lose track of unless the listener logs it. It is the right tool for "same-process, best-effort, doesn't need to survive a crash" reactions (e.g. cache invalidation, an audit-log write, a notification enqueue to a _different_ durable system). It is **not** a substitute for a transactional outbox, a message queue, or a workflow engine — if a future module genuinely needs guaranteed delivery or cross-process durability, that is new infrastructure to design deliberately, not something to bolt onto `EventEmitter2`. Building that is explicitly out of scope for the current foundation work.

**Convention:**

- Every module that emits events gets an `events/` folder: `sales-orders/events/sales-order.created.event.ts`.
- Event name strings: `<module>.<entity>.<event>`, e.g. `invoice.created`, `user.logged_in`. Define as a `const` (e.g. `INVOICE_EVENTS.CREATED`), not a bare string literal at each call site.
- Event file: one class per event, carrying only the data a listener needs (IDs + a few fields, not a full entity graph).
- Emitting is a **pure addition** after a service method's existing logic — it must never change that method's return value or behavior.
- Listeners live in the _subscribing_ module (`finance/listeners/invoice-created.listener.ts`), using `@OnEvent(INVOICE_EVENTS.CREATED)` — never in the emitting module.

**PR review question:** does this PR touch two modules' folders? If yes, check whether it should have been an event listener instead — not an automatic violation, but worth a second look every time.

---

## 12. Design tokens

No component anywhere hardcodes a hex value, a raw `px` font size, or an ad-hoc `transition` duration. Need a new color, radius, shadow, or type size? It gets added to `packages/ui-kit/src/theme.css` first, then used. Every color utility ships with its `dark:` pair in the same commit — see `Docs/DESIGN_SYSTEM.md` for the full token reference and dark-mode substitution table. Status badges always read `color_token` off the `statuses` row and render through the shared `<StatusBadge />` widget (`packages/ui-kit`) — never a per-module reimplementation.

Tailwind classes are always written as **complete literal strings**, never built by interpolating a variable into a class name (`` `bg-${color}-500` ``) — Tailwind's compiler only sees classes that appear literally in source, so an interpolated one is silently dropped in production. If a class needs to vary, map every case to its own literal string (see `Docs/DESIGN_SYSTEM.md` for the pattern) or use a small `class-variance-authority`/lookup-object approach with literal keys.

---

## 13. Frontend API/state/error standard

One documented pattern, so every feature doesn't reinvent its own fetch/auth/error plumbing:

- **API client**: `packages/core`'s `ApiClient` (`packages/core/src/api/client.ts`) — every feature's `api.ts` calls it, never `fetch` directly. It returns the _full_ envelope (`{ data, meta }`), never silently drops `meta` — a paginated hook reads `.meta` for `page`/`totalPages`, a single-resource call reads `.data`.
- **Errors**: every failure — HTTP error body, network failure, unparseable response — normalizes to one `ApiError` (`packages/core/src/api/api-error.ts`) with `.isAuthError`/`.isPermissionError`/`.isNotFound`/`.isValidationError`/`.fieldErrors` helpers. Components branch on these, never on a raw status code.
- **Field errors vs. toasts**: validation errors render inline via `FormField`'s `error` prop (same zod schema client- and conceptually server-side, see `packages/core/src/schemas/`); the _result_ of an action (created/deleted/failed) is a toast (`useToast()`, `packages/ui-kit`) — don't mix the two.
- **Auth-expiry handling**: `apps/ui/src/lib/api-client.ts`'s `withAuthRetry()` — one silent refresh-and-retry on a 401, concurrent 401s share a single in-flight refresh (no thundering herd of refresh calls). If refresh itself fails, auth is cleared and the `(dashboard)` layout's guard redirects to `/login`.
- **Query keys & invalidation**: every TanStack Query key starts with `orgScopedKey(organizationId, ...)` (`packages/core/src/query/query-keys.ts`) — organization-scoped by construction, so switching orgs can never render stale cross-org data from cache. Mutations invalidate by the same org-scoped prefix on success.
- **Org-aware cache separation, logout, org-switch cleanup**: logout calls `queryClient.clear()` (see `apps/ui/src/app/(dashboard)/layout.tsx`) in addition to clearing the auth store — belt-and-suspenders with the org-scoped keys above.
- **Server vs. Client Component boundaries**: default to a Server Component (no `"use client"`) for static/non-interactive markup (`apps/ui/src/app/page.tsx` is the example). The App Router tree switches to client-rendered at `apps/ui/src/app/providers.tsx` — everything needing hooks/state lives below that boundary. Don't mark a page `"use client"` just because something _inside_ it needs to be; push the boundary down to the smallest component that actually needs it.
- **Private authenticated data / server-cache behavior**: **not implemented in this foundation.** The access token lives in memory only (`apps/ui/src/stores/auth-store.ts`, a Zustand store) — not a cookie — so there is no server-visible session, `middleware.ts` route gating doesn't exist, and Next.js's server-side data cache never sees per-user data (everything authenticated is fetched client-side via TanStack Query). This is a real, deliberate limitation: moving to server-verified auth requires the refresh token behind an httpOnly cookie via a thin BFF (a Next.js Route Handler), which is a security-relevant change, not a config toggle — do that deliberately when a real module needs it, don't half-build it per-feature.

---

## 14. Testing requirements

- **Backend unit tests** (`*.spec.ts`, Vitest): required for service-layer business logic — the reference feature doesn't have one yet for `TagsService` (see §16), the scaffold generator creates a placeholder that must be replaced, not left as `expect(service).toBeDefined()`.
- **Backend e2e tests** (`*.e2e-spec.ts`, `vitest.config.e2e.ts`, run via `pnpm --filter api test:e2e`): required for anything touching auth, tenancy, or permissions — `apps/api/test/reference-tags.e2e-spec.ts` is the reference: it proves tenant isolation by asserting a 404 (not just "absent from a list") when org B tries to read/update/delete org A's record by ID, not just that "the code looks right." Needs a real Postgres + Redis — see `Docs/ARCHITECTURE.md` "Local environment".
- **Frontend e2e tests** (Playwright, `apps/ui/e2e/`, run via `pnpm --filter ui test:e2e`): required for a new authenticated flow — `apps/ui/e2e/reference-tags.spec.ts` is the reference. Use `getByRole`/`getByLabel` locators, not CSS selectors — they only resolve when the accessible name/role tree is actually correct, so the test doubles as an accessibility check.
- Don't skip a test for "obvious" logic. A disabled/skipped test (`.skip`) needs a comment explaining why and is a review flag, not a routine thing to leave behind.

---

## 15. Documented exceptions (`any`, unsafe casts, `eslint-disable`)

`apps/api/eslint.config.cjs` enforces `@typescript-eslint/no-explicit-any`, `no-unsafe-assignment`, `no-unsafe-member-access`, `no-unsafe-call` (type-aware linting) as **errors**, and every workspace enforces `@eslint-community/eslint-comments/require-description` — a bare `// eslint-disable-next-line` with no explanation fails lint.

**The exception process, when a rule is genuinely wrong for a specific line:**

```ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- reason: <why this specific line genuinely needs it>
```

- The description is not optional decoration — it's what a reviewer (and future-you) needs to judge whether the exception still holds.
- A disable that suppresses a whole file or a whole rule for a whole package is a **shared-architecture change** (`packages/config/eslint.config.js`, or a workspace's own `eslint.config.js`/`.cjs`) and needs review before merge (see root `CLAUDE.md`) — it is never a routine fix for "lint is in my way right now."
- Blanket `eslint-disable` (no rule name) is separately caught by `no-unlimited-disable` — always name the specific rule.
- If you find yourself reaching for `any` more than once in a PR, that's usually a sign the actual type is knowable and should be written down (even `unknown` + a runtime check is better than `any`), not a sign the lint rule needs an exception.

---

## 16. Reference implementation & scaffolding

**Reference implementation** (compiles, is tested, and is live-verified — not pseudocode to copy blindly):

- Backend: `apps/api/src/modules/_reference/tags/` (controller → service → repository, `@OrgScoped()`, permission checks, pagination, the `{ data, meta }` envelope) + `apps/api/test/reference-tags.e2e-spec.ts` (tenant isolation, permission-denied, refresh-token rotation, health check).
- Frontend: `apps/ui/src/features/_reference/tags/` (api.ts, hooks.ts using org-scoped TanStack Query keys, `TagForm`/`TagsView` demonstrating every screen state in `Docs/DESIGN_SYSTEM.md` §3) + `apps/ui/e2e/reference-tags.spec.ts`.
- It's named `_reference`/fixture on purpose — `Tag` is not a real business concept. Don't extend it with real business fields; copy its _shape_ into a real module's own folder instead.

**Scaffolding**: `pnpm scaffold:module <kebab-case-name>` (`scripts/scaffold-module.mjs`) generates the backend module skeleton (controller/service/repository/DTOs/spec placeholder) and the frontend feature folder (api.ts/hooks.ts/schema.ts/components/), both matching the reference's shape. It validates the name, **refuses to overwrite existing work**, and deliberately does **not**: create a Prisma model, pick a permission string, or wire the new module into `apps/api/src/app.module.ts` — those are business/architecture decisions the script won't make for you. Every generated file with a `GENERATED SCAFFOLD` header comment lists exactly what's still a placeholder; don't ship one of those files without resolving its TODOs first.

---

## 17. PR/CI rules and Definition of Done

**CI** (`.github/workflows/ci.yml`) runs `pnpm install --frozen-lockfile` then `pnpm exec turbo run lint typecheck test build` on every PR, with Postgres/Redis services so `api:test` (which includes the e2e suite via Vitest's project config) can run against them. Browser e2e (`pnpm --filter ui test:e2e`, Playwright) is **not yet wired into CI** — run it locally before a PR that touches an authenticated UI flow. Check `.github/workflows/ci.yml` directly for the current state rather than trusting this doc if the two ever disagree.

**Repository settings this relies on, that live in GitHub's settings UI/API, not in this repo's files** — someone with admin access needs to configure these; they cannot be verified from within a checkout:

- Protected `main` branch (no direct pushes).
- Required PR review (at least one approval) before merge.
- Required status check: the CI workflow above, before merge is allowed.
- CODEOWNERS-based review requirement for the sensitive paths listed in `CODEOWNERS` — a `CODEOWNERS` file alone does **not** enforce review; "require review from Code Owners" must also be turned on for the branch protection rule.

**PR checklist:**

- [ ] No hardcoded hex/px colors or font sizes — uses tokens from `packages/ui-kit/src/theme.css`.
- [ ] No direct Prisma call outside a `*.repository.ts` file.
- [ ] No cross-module import of another module's repository — use `EventEmitter2`, or a module's own exported public service for a necessary synchronous read (§11).
- [ ] Every new tenant table has the §5.1 baseline columns (see `ARCHITECTURE.md`).
- [ ] Every repository method touching tenant data is `@OrgScoped()`, with `scope` as its first, explicit parameter.
- [ ] Business-rule failures throw a `BusinessException` subclass, not a raw error.
- [ ] New/changed screens cover the states in `Docs/DESIGN_SYSTEM.md` §3 (loading, empty, error-with-retry, permission-denied, save-in-progress, validation, preserved-on-failure).
- [ ] Tests added per §14; nothing skipped without a comment explaining why.
- [ ] No new bare `eslint-disable`/`@ts-ignore` without the description §15 requires.
- [ ] Conventional Commit message, correct scope.
- [ ] If a new dependency, shared-package boundary, auth/tenancy, or ui-kit/token change is included, it's flagged for the review-before-merge list in root `CLAUDE.md`.
