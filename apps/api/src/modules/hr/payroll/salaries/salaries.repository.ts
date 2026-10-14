import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../../../common/decorators/org-scoped.decorator.js";
import { TeamScoped } from "../../../../common/decorators/team-scoped.decorator.js";
import type { PaginationDto } from "../../../../common/dto/pagination.dto.js";
import { ResourceNotFoundException } from "../../../../common/exceptions/business.exception.js";
import type { OrgScope } from "../../../../common/tenancy/org-scope.js";
import type { TeamScope } from "../../../../common/tenancy/team-scope.js";
import { teamWhere } from "../../../../common/tenancy/team-where.js";
import { tenantWhere } from "../../../../common/tenancy/tenant-where.js";
import { AuditWriter } from "../../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../../shared/prisma/prisma.service.js";
import { findEmployeeInWriteScope } from "../shared/payroll-scope.js";
import type { QuerySalaryDto } from "./dto/salary.dto.js";

const VIA_EMPLOYEE = {
  teamField: "employee.teamId",
  ownerField: "employee.userId",
};

const INCLUDE_EMPLOYEE = {
  employee: {
    select: {
      id: true,
      employeeCode: true,
      fullName: true,
      teamId: true,
      userId: true,
      status: true,
    },
  },
  components: {
    include: {
      component: {
        select: {
          id: true,
          code: true,
          name: true,
          kind: true,
          displayOrder: true,
        },
      },
    },
    orderBy: { component: { displayOrder: "asc" } },
  },
  salaryTemplate: { select: { id: true, code: true, name: true } },
  revisionLetter: { select: { id: true, documentNo: true } },
} satisfies Prisma.EmployeeSalaryInclude;

/** One resolved line of a structure. */
export interface SalaryLine {
  componentId: number;
  code: string;
  kind: "EARNING" | "DEDUCTION";
  monthlyAmount: number;
}

const ENTITY_TYPE = "employee_salary";

function round2(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

/** Gross = the earning lines; the legacy columns mirror the system lines
 * (kept for older readers — the engine reads the lines). */
function columnsFromLines(lines: readonly SalaryLine[]) {
  const amount = (code: string) =>
    lines.find((l) => l.code === code)?.monthlyAmount ?? 0;
  return {
    grossMonthly: round2(
      lines
        .filter((l) => l.kind === "EARNING")
        .reduce((s, l) => s + l.monthlyAmount, 0),
    ),
    basic: amount("BASIC"),
    hra: amount("HRA"),
    conveyance: amount("CONVEYANCE"),
    otherAllowance: amount("OTHER_ALLOWANCE"),
    specialAllowance: amount("SPECIAL_ALLOWANCE"),
  };
}

/** The amounts and dates that define a structure — what the audit trail keeps. */
function salarySnapshot(row: SalaryRow) {
  return {
    employeeId: row.employeeId,
    effectiveFrom: row.effectiveFrom.toISOString().slice(0, 10),
    effectiveTo: row.effectiveTo
      ? row.effectiveTo.toISOString().slice(0, 10)
      : null,
    grossMonthly: row.grossMonthly.toString(),
    arrearsSalary: row.arrearsSalary.toString(),
    salaryTemplateId: row.salaryTemplateId,
    revisionLetterId: row.revisionLetterId,
    lines: row.components.map((c) => ({
      code: c.component.code,
      monthlyAmount: c.monthlyAmount.toString(),
    })),
  };
}

export type SalaryRow = Prisma.EmployeeSalaryGetPayload<{
  include: typeof INCLUDE_EMPLOYEE;
}>;

@Injectable()
export class SalariesRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
  ) {}

  /** Finalized payroll periods that overlap [from, to] (to = null: open-ended).
   * Their payslips used this structure, so its recurring amounts are fixed. */
  @OrgScoped()
  findFinalizedPeriodsOverlapping(
    scope: OrgScope,
    from: Date,
    to: Date | null,
  ) {
    return this.prisma.payrollPeriod.findMany({
      where: tenantWhere(scope, {
        status: "FINALIZED",
        deletedAt: null,
        periodEnd: { gte: from },
        ...(to ? { periodStart: { lte: to } } : {}),
      }),
      select: {
        id: true,
        year: true,
        month: true,
        periodStart: true,
        periodEnd: true,
      },
      orderBy: { periodEnd: "desc" },
    });
  }

  @TeamScoped()
  async findMany(
    scope: TeamScope,
    query: QuerySalaryDto,
    pagination: PaginationDto,
  ): Promise<{ items: SalaryRow[]; total: number }> {
    const filter: Prisma.EmployeeSalaryWhereInput = {
      deletedAt: null,
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.effectiveOn
        ? {
            effectiveFrom: { lte: new Date(query.effectiveOn) },
            OR: [
              { effectiveTo: null },
              { effectiveTo: { gte: new Date(query.effectiveOn) } },
            ],
          }
        : {}),
    };

    const where = teamWhere(
      scope,
      filter,
      VIA_EMPLOYEE,
    ) as Prisma.EmployeeSalaryWhereInput;

    const [items, total] = await Promise.all([
      this.prisma.employeeSalary.findMany({
        where,
        include: INCLUDE_EMPLOYEE,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [{ effectiveFrom: "desc" }, { id: "desc" }],
      }),
      this.prisma.employeeSalary.count({ where }),
    ]);

    return { items, total };
  }

  @TeamScoped()
  async findById(scope: TeamScope, id: number): Promise<SalaryRow | null> {
    const where = teamWhere(
      scope,
      { id, deletedAt: null },
      VIA_EMPLOYEE,
    ) as Prisma.EmployeeSalaryWhereInput;

    return this.prisma.employeeSalary.findFirst({
      where,
      include: INCLUDE_EMPLOYEE,
    });
  }

  @TeamScoped()
  async findApplicableOn(
    scope: TeamScope,
    employeeId: number,
    date: Date,
  ): Promise<SalaryRow | null> {
    const filter: Prisma.EmployeeSalaryWhereInput = {
      employeeId,
      deletedAt: null,
      effectiveFrom: { lte: date },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: date } }],
    };

    const where = teamWhere(
      scope,
      filter,
      VIA_EMPLOYEE,
    ) as Prisma.EmployeeSalaryWhereInput;

    return this.prisma.employeeSalary.findFirst({
      where,
      include: INCLUDE_EMPLOYEE,
      orderBy: { effectiveFrom: "desc" },
    });
  }

  @OrgScoped()
  async findOverlapping(
    scope: OrgScope,
    employeeId: number,
    from: Date,
    to: Date | null,
    excludeId?: number,
  ): Promise<{ id: number } | null> {
    const conditions: Prisma.EmployeeSalaryWhereInput[] = [
      tenantWhere(scope, {
        employeeId,
        deletedAt: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      }),
    ];

    if (to === null) {
      // open-ended range clashes if another range ends after from or is open-ended
      conditions.push({
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: from } }],
      });
    } else {
      // closed range clashes if it overlaps [from, to]
      conditions.push({
        effectiveFrom: { lte: to },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: from } }],
      });
    }

    return this.prisma.employeeSalary.findFirst({
      where: { AND: conditions },
      select: { id: true },
    });
  }

  /** A revision letter of this employee (organization-filtered), or null. */
  @OrgScoped()
  findRevisionLetter(scope: OrgScope, id: number, employeeId: number) {
    return this.prisma.revisionLetter.findFirst({
      where: { id, employeeId, organizationId: scope.organizationId },
      select: { id: true },
    });
  }

  /**
   * Creates a structure and its lines in one transaction. The employee is
   * re-read through the caller's write scope (`findEmployeeInWriteScope`):
   * `.team` writes only its teams' salaries, `.own` none.
   */
  @TeamScoped()
  async create(
    scope: TeamScope,
    data: {
      employeeId: number;
      effectiveFrom: Date;
      effectiveTo: Date | null;
      arrearsSalary: number;
      salaryTemplateId: number | null;
      revisionLetterId: number | null;
    },
    lines: SalaryLine[],
    createdById: number,
  ): Promise<SalaryRow> {
    return this.prisma.$transaction(async (tx) => {
      await findEmployeeInWriteScope(tx, scope, data.employeeId);
      const created = await tx.employeeSalary.create({
        data: {
          organizationId: scope.organizationId,
          employeeId: data.employeeId,
          effectiveFrom: data.effectiveFrom,
          effectiveTo: data.effectiveTo,
          ...columnsFromLines(lines),
          arrearsSalary: data.arrearsSalary,
          salaryTemplateId: data.salaryTemplateId,
          revisionLetterId: data.revisionLetterId,
          createdBy: createdById,
          updatedBy: createdById,
          components: {
            create: lines.map((l) => ({
              organizationId: scope.organizationId,
              salaryComponentId: l.componentId,
              monthlyAmount: l.monthlyAmount,
              createdBy: createdById,
              updatedBy: createdById,
            })),
          },
        },
        include: INCLUDE_EMPLOYEE,
      });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: created.id,
        action: "create",
        after: salarySnapshot(created),
      });
      return created;
    });
  }

  /**
   * Updates a structure within the caller's write scope; `lines`, when
   * given, replace every line (and the mirrored columns).
   */
  @TeamScoped()
  async update(
    scope: TeamScope,
    id: number,
    patch: {
      effectiveTo?: Date | null | undefined;
      arrearsSalary?: number | undefined;
    },
    lines: SalaryLine[] | undefined,
    updatedById: number,
  ): Promise<SalaryRow> {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.employeeSalary.findFirst({
        where: teamWhere(
          scope,
          { id, deletedAt: null },
          VIA_EMPLOYEE,
        ) as Prisma.EmployeeSalaryWhereInput,
        include: INCLUDE_EMPLOYEE,
      });
      if (!before) throw new ResourceNotFoundException("Salary structure", id);
      await findEmployeeInWriteScope(tx, scope, before.employeeId);

      if (lines) {
        await tx.employeeSalaryComponent.deleteMany({
          where: { employeeSalaryId: id },
        });
        await tx.employeeSalaryComponent.createMany({
          data: lines.map((l) => ({
            organizationId: scope.organizationId,
            employeeSalaryId: id,
            salaryComponentId: l.componentId,
            monthlyAmount: l.monthlyAmount,
            createdBy: updatedById,
            updatedBy: updatedById,
          })),
        });
      }
      const after = await tx.employeeSalary.update({
        where: { id },
        data: {
          ...(patch.effectiveTo !== undefined
            ? { effectiveTo: patch.effectiveTo }
            : {}),
          ...(lines ? columnsFromLines(lines) : {}),
          // New arrears are a new one-time payment: clear the "already paid"
          // marker so the next finalized period pays them.
          ...(patch.arrearsSalary !== undefined
            ? { arrearsSalary: patch.arrearsSalary, arrearsPaidPeriodId: null }
            : {}),
          updatedBy: updatedById,
        },
        include: INCLUDE_EMPLOYEE,
      });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: id,
        action: "update",
        before: salarySnapshot(before),
        after: salarySnapshot(after),
      });
      return after;
    });
  }
}
