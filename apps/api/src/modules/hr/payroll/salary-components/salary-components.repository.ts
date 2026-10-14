import { Injectable } from "@nestjs/common";
import type { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../../../common/decorators/org-scoped.decorator.js";
import type { OrgScope } from "../../../../common/tenancy/org-scope.js";
import { AuditWriter } from "../../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../../shared/prisma/prisma.service.js";
import type {
  CreateSalaryComponentDto,
  UpdateSalaryComponentDto,
} from "./dto/salary-component.dto.js";
import {
  type CalculationType,
  SYSTEM_COMPONENTS,
} from "./salary-template.rules.js";

const TEMPLATE_INCLUDE = {
  lines: {
    include: {
      component: {
        select: {
          id: true,
          code: true,
          name: true,
          kind: true,
          isActive: true,
        },
      },
    },
    orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
  },
} satisfies Prisma.SalaryTemplateInclude;

export type SalaryTemplateRow = Prisma.SalaryTemplateGetPayload<{
  include: typeof TEMPLATE_INCLUDE;
}>;

export interface TemplateLineInput {
  componentId: number;
  calculationType: CalculationType;
  value: number;
  displayOrder: number;
}

function toRow(l: TemplateLineInput) {
  return {
    salaryComponentId: l.componentId,
    calculationType: l.calculationType,
    value: l.value,
    displayOrder: l.displayOrder,
  };
}

function templateSnapshot(t: SalaryTemplateRow) {
  return {
    code: t.code,
    name: t.name,
    isActive: t.isActive,
    lines: t.lines.map((l) => ({
      component: l.component.code,
      calculationType: l.calculationType,
      value: l.value.toString(),
    })),
  };
}

/**
 * The salary component master and templates — organization-wide payroll
 * configuration, not employee data, so `@OrgScoped()` (like payroll
 * settings; Docs/CODING_STANDARDS.md §10a). Every write carries its audit
 * row in the same transaction.
 */
@Injectable()
export class SalaryComponentsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
  ) {}

  /** Seeds the system components for an organization that has none yet
   * (the migration seeded every organization that existed then). */
  @OrgScoped()
  async ensureSystemComponents(scope: OrgScope): Promise<void> {
    await this.prisma.salaryComponent.createMany({
      data: SYSTEM_COMPONENTS.map((c) => ({
        organizationId: scope.organizationId,
        code: c.code,
        name: c.name,
        kind: "EARNING",
        pfApplicable: c.pfApplicable,
        isSystem: true,
        displayOrder: c.displayOrder,
      })),
      skipDuplicates: true,
    });
  }

  @OrgScoped()
  findComponents(scope: OrgScope, includeInactive: boolean) {
    return this.prisma.salaryComponent.findMany({
      where: {
        organizationId: scope.organizationId,
        deletedAt: null,
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
    });
  }

  @OrgScoped()
  findComponentsByIds(scope: OrgScope, ids: number[]) {
    return this.prisma.salaryComponent.findMany({
      where: {
        organizationId: scope.organizationId,
        id: { in: ids },
        deletedAt: null,
      },
    });
  }

  @OrgScoped()
  findComponentsByCodes(scope: OrgScope, codes: string[]) {
    return this.prisma.salaryComponent.findMany({
      where: {
        organizationId: scope.organizationId,
        code: { in: codes },
        deletedAt: null,
      },
    });
  }

  @OrgScoped()
  findComponentById(scope: OrgScope, id: number) {
    return this.prisma.salaryComponent.findFirst({
      where: { id, organizationId: scope.organizationId, deletedAt: null },
    });
  }

  @OrgScoped()
  async createComponent(
    scope: OrgScope,
    dto: CreateSalaryComponentDto,
    userId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.salaryComponent.create({
        data: {
          organizationId: scope.organizationId,
          code: dto.code,
          name: dto.name,
          kind: dto.kind,
          isProrated: dto.isProrated ?? true,
          isTaxable: dto.isTaxable ?? true,
          pfApplicable: dto.pfApplicable ?? false,
          esiApplicable: dto.esiApplicable ?? true,
          displayOrder: dto.displayOrder ?? 100,
          createdBy: userId,
          updatedBy: userId,
        },
      });
      await this.audit.write(tx, {
        entityType: "salary_component",
        entityId: created.id,
        action: "create",
        after: created,
      });
      return created;
    });
  }

  @OrgScoped()
  async updateComponent(
    scope: OrgScope,
    id: number,
    dto: UpdateSalaryComponentDto,
    userId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.salaryComponent.findFirstOrThrow({
        where: { id, organizationId: scope.organizationId },
      });
      const after = await tx.salaryComponent.update({
        where: { id },
        data: { ...dto, updatedBy: userId },
      });
      await this.audit.write(tx, {
        entityType: "salary_component",
        entityId: id,
        action: "update",
        before,
        after,
      });
      return after;
    });
  }

  // ---- templates -------------------------------------------------------------

  @OrgScoped()
  findTemplates(scope: OrgScope, includeInactive: boolean) {
    return this.prisma.salaryTemplate.findMany({
      where: {
        organizationId: scope.organizationId,
        deletedAt: null,
        ...(includeInactive ? {} : { isActive: true }),
      },
      include: TEMPLATE_INCLUDE,
      orderBy: { code: "asc" },
    });
  }

  @OrgScoped()
  findTemplateById(scope: OrgScope, id: number) {
    return this.prisma.salaryTemplate.findFirst({
      where: { id, organizationId: scope.organizationId, deletedAt: null },
      include: TEMPLATE_INCLUDE,
    });
  }

  @OrgScoped()
  async createTemplate(
    scope: OrgScope,
    data: { code: string; name: string; description?: string | undefined },
    lines: TemplateLineInput[],
    userId: number,
  ): Promise<SalaryTemplateRow> {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.salaryTemplate.create({
        data: {
          organizationId: scope.organizationId,
          code: data.code,
          name: data.name,
          description: data.description ?? null,
          createdBy: userId,
          updatedBy: userId,
          lines: { create: lines.map(toRow) },
        },
        include: TEMPLATE_INCLUDE,
      });
      await this.audit.write(tx, {
        entityType: "salary_template",
        entityId: created.id,
        action: "create",
        after: templateSnapshot(created),
      });
      return created;
    });
  }

  @OrgScoped()
  async updateTemplate(
    scope: OrgScope,
    id: number,
    data: {
      name?: string | undefined;
      description?: string | undefined;
      isActive?: boolean | undefined;
    },
    lines: TemplateLineInput[] | undefined,
    userId: number,
  ): Promise<SalaryTemplateRow> {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.salaryTemplate.findFirstOrThrow({
        where: { id, organizationId: scope.organizationId },
        include: TEMPLATE_INCLUDE,
      });
      if (lines) {
        await tx.salaryTemplateComponent.deleteMany({
          where: { salaryTemplateId: id },
        });
        await tx.salaryTemplateComponent.createMany({
          data: lines.map((l) => ({ ...toRow(l), salaryTemplateId: id })),
        });
      }
      const after = await tx.salaryTemplate.update({
        where: { id },
        data: {
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.description !== undefined
            ? { description: data.description }
            : {}),
          ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
          updatedBy: userId,
        },
        include: TEMPLATE_INCLUDE,
      });
      await this.audit.write(tx, {
        entityType: "salary_template",
        entityId: id,
        action: "update",
        before: templateSnapshot(before),
        after: templateSnapshot(after),
      });
      return after;
    });
  }
}
