#!/usr/bin/env node
// Scaffolds a new backend module + frontend feature folder pair from the
// verified reference pattern (apps/api/src/modules/_reference/tags/,
// apps/ui/src/features/_reference/tags/). See Docs/CODING_STANDARDS.md
// "Scaffolding" for what this does and does not do for you.
//
// Usage: pnpm scaffold:module <kebab-case-name>
// Example: pnpm scaffold:module delivery-challans

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

const rawName = process.argv[2];
if (!rawName) {
  fail("Usage: pnpm scaffold:module <kebab-case-name>  (e.g. delivery-challans)");
}

// Validate the name — kebab-case, letters/digits/hyphens only, can't start
// or end with a hyphen. This is a naming-convention check only; it does not
// (and should not) validate that the name makes business sense.
const KEBAB_CASE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
if (!KEBAB_CASE.test(rawName)) {
  fail(
    `"${rawName}" is not kebab-case (Docs/CODING_STANDARDS.md §2). Expected e.g. "delivery-challans", got "${rawName}".`,
  );
}
if (rawName === "_reference" || rawName.startsWith("_")) {
  fail(`"${rawName}" is reserved (the "_reference" prefix is for fixture/teaching code only).`);
}

const kebabName = rawName;
const pascalName = kebabName
  .split("-")
  .map((part) => part[0].toUpperCase() + part.slice(1))
  .join("");
const camelName = pascalName[0].toLowerCase() + pascalName.slice(1);

const apiModuleDir = join(ROOT, "apps/api/src/modules", kebabName);
const uiFeatureDir = join(ROOT, "apps/ui/src/features", kebabName);

// Refuse to overwrite existing work — this is the single most important
// safety property of this script (Phase 11 requirement).
for (const dir of [apiModuleDir, uiFeatureDir]) {
  if (existsSync(dir)) {
    fail(
      `${dir.replace(ROOT + "/", "")} already exists. This script never overwrites existing work — ` +
        "remove it yourself first if you really mean to start over, or pick a different name.",
    );
  }
}

/** Writes a file, creating parent directories as needed. Every generated
 * file gets a leading "GENERATED SCAFFOLD" comment so it's unmistakable
 * which parts of a new module are still placeholders — never delete that
 * comment without actually implementing the TODOs it lists first. */
function writeFile(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  console.log(`  created ${path.replace(ROOT + "/", "")}`);
}

const scaffoldNotice = (whatsMissing) =>
  `// GENERATED SCAFFOLD (pnpm scaffold:module) — placeholder, not production-ready.\n` +
  `// Still needed before this is real: ${whatsMissing}\n`;

// ---------------------------------------------------------------------------
// Backend: apps/api/src/modules/<kebabName>/
// ---------------------------------------------------------------------------

writeFile(
  join(apiModuleDir, `${kebabName}.repository.ts`),
  `${scaffoldNotice("real Prisma model + fields below (this compiles against nothing yet)")}
import { Injectable } from "@nestjs/common";
import { OrgScoped } from "../../common/decorators/org-scoped.decorator.js";
import type { OrgScope } from "../../common/tenancy/org-scope.js";
import { PrismaService } from "../../shared/prisma/prisma.service.js";

/** The only place PrismaService is called for this module
 * (Docs/CODING_STANDARDS.md §3). TODO: replace \`this.prisma.TODO_MODEL\`
 * below with the real Prisma model once it exists in
 * packages/database/prisma/schema.prisma (§5.1 baseline columns) — see
 * apps/api/src/modules/_reference/tags/tags.repository.ts for a working
 * example of every method below. */
@Injectable()
export class ${pascalName}Repository {
  constructor(private readonly prisma: PrismaService) {}

  @OrgScoped()
  findMany(_scope: OrgScope /* , filter, pagination */) {
    throw new Error("TODO: implement findMany() against the real Prisma model");
  }

  @OrgScoped()
  findOne(_scope: OrgScope, _id: string) {
    throw new Error("TODO: implement findOne() against the real Prisma model");
  }

  @OrgScoped()
  create(_scope: OrgScope /* , dto, createdBy */) {
    throw new Error("TODO: implement create() against the real Prisma model");
  }
}
`,
);

writeFile(
  join(apiModuleDir, `${kebabName}.service.ts`),
  `${scaffoldNotice("business rules — this currently just passes through to the repository")}
import { Injectable } from "@nestjs/common";
import { TenantContextService } from "../../platform/tenancy/tenant-context.service.js";
import { ${pascalName}Repository } from "./${kebabName}.repository.js";

@Injectable()
export class ${pascalName}Service {
  constructor(
    private readonly repository: ${pascalName}Repository,
    private readonly tenantContext: TenantContextService,
  ) {}

  findAll(/* query */) {
    const scope = this.tenantContext.getOrgScope();
    return this.repository.findMany(scope);
  }
}
`,
);

writeFile(
  join(apiModuleDir, `${kebabName}.controller.ts`),
  `${scaffoldNotice(
    'a real permission string — replace "TODO.permission" below with e.g. "sales.invoice.read", seeded against a role, before this route is reachable by anyone',
  )}
import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { RequirePermission } from "../../common/decorators/require-permission.decorator.js";
import { ${pascalName}Service } from "./${kebabName}.service.js";

@ApiTags("${kebabName}")
@Controller("${kebabName}")
export class ${pascalName}Controller {
  constructor(private readonly ${camelName}: ${pascalName}Service) {}

  @Get()
  @RequirePermission("TODO.permission")
  findAll() {
    return this.${camelName}.findAll();
  }
}
`,
);

writeFile(
  join(apiModuleDir, `${kebabName}.module.ts`),
  `import { Module } from "@nestjs/common";
import { ${pascalName}Controller } from "./${kebabName}.controller.js";
import { ${pascalName}Repository } from "./${kebabName}.repository.js";
import { ${pascalName}Service } from "./${kebabName}.service.js";

@Module({
  controllers: [${pascalName}Controller],
  providers: [${pascalName}Repository, ${pascalName}Service],
})
export class ${pascalName}Module {}
`,
);

writeFile(
  join(apiModuleDir, "dto", `create-${kebabName}.dto.ts`),
  `${scaffoldNotice("real fields with class-validator decorators — this DTO is currently empty")}
export class Create${pascalName}Dto {
  // TODO: add fields, e.g.:
  // @IsString()
  // @Length(1, 100)
  // name!: string;
}
`,
);

writeFile(
  join(apiModuleDir, "dto", `update-${kebabName}.dto.ts`),
  `import { PartialType } from "@nestjs/swagger";
import { Create${pascalName}Dto } from "./create-${kebabName}.dto.js";

export class Update${pascalName}Dto extends PartialType(Create${pascalName}Dto) {}
`,
);

writeFile(
  join(apiModuleDir, "dto", `query-${kebabName}.dto.ts`),
  `import { PaginationDto } from "../../../common/dto/pagination.dto.js";

export class Query${pascalName}Dto extends PaginationDto {
  // TODO: add filter fields (e.g. \`search?: string\`)
}
`,
);

writeFile(
  join(apiModuleDir, `${kebabName}.service.spec.ts`),
  `${scaffoldNotice("real assertions — this only proves the module wires up, not that it behaves correctly")}
import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { TenantContextService } from "../../platform/tenancy/tenant-context.service.js";
import { ${pascalName}Repository } from "./${kebabName}.repository.js";
import { ${pascalName}Service } from "./${kebabName}.service.js";

describe("${pascalName}Service", () => {
  it("TODO: replace this with real behavior tests (see tags.service.spec.ts once it exists)", async () => {
    const module = await Test.createTestingModule({
      providers: [
        ${pascalName}Service,
        { provide: ${pascalName}Repository, useValue: { findMany: vi.fn() } },
        { provide: TenantContextService, useValue: { getOrgScope: () => ({ organizationId: "test" }) } },
      ],
    }).compile();

    const service = module.get(${pascalName}Service);
    expect(service).toBeDefined();
  });
});
`,
);

// ---------------------------------------------------------------------------
// Frontend: apps/ui/src/features/<kebabName>/
// ---------------------------------------------------------------------------

writeFile(
  join(uiFeatureDir, "api.ts"),
  `${scaffoldNotice("real request/response types from packages/api-types — everything below is untyped placeholders")}
import { apiClient, withAuthRetry } from "@/lib/api-client";

// TODO: replace \`unknown\` with real types from packages/api-types once
// that package has an entry for this feature (see
// packages/api-types/README.md for the handwritten-vs-generated convention).
export function list${pascalName}() {
  return withAuthRetry(() => apiClient.get<unknown>("/${kebabName}"));
}
`,
);

writeFile(
  join(uiFeatureDir, "hooks.ts"),
  `"use client";

import { orgScopedKey } from "@texawave-erp/core";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { list${pascalName} } from "./api.js";

export function use${pascalName}() {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: orgScopedKey(organizationId ?? "", "${kebabName}"),
    queryFn: () => list${pascalName}(),
    enabled: Boolean(organizationId),
  });
}
`,
);

writeFile(
  join(uiFeatureDir, "schema.ts"),
  `${scaffoldNotice("a real zod schema matching the backend's create DTO")}
import { z } from "zod";

export const create${pascalName}Schema = z.object({
  // TODO: match apps/api/src/modules/${kebabName}/dto/create-${kebabName}.dto.ts
});
`,
);

writeFile(
  join(uiFeatureDir, "components", ".gitkeep"),
  "# TODO: add components here (e.g. a *View.tsx composing ui-kit primitives — see\n# apps/ui/src/features/_reference/tags/components/ for the reference shape).\n",
);

console.log(`
✓ Scaffolded "${kebabName}". This is a STARTING POINT, not a finished module — every
  file above with a "GENERATED SCAFFOLD" header has real TODOs to resolve.

Still needed, deliberately NOT done for you (Docs/CODING_STANDARDS.md "Scaffolding" —
this script never invents business rules, permissions, schema, or authorization decisions):
  1. Add the Prisma model (packages/database/prisma/schema.prisma, §5.1 baseline columns),
     then run \`pnpm --filter database migrate:dev\`.
  2. Fill in the repository/service/DTOs against that real model.
  3. Pick and seed a real permission string (replace "TODO.permission" in the controller).
  4. Import ${pascalName}Module into apps/api/src/app.module.ts yourself — this script does not
     edit app.module.ts, so a half-wired module is never silently live.
  5. Fill in packages/api-types with real wire types, then use them in apps/ui/src/features/${kebabName}/.
  6. Write real tests replacing the placeholder in ${kebabName}.service.spec.ts.
`);
