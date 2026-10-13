import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../../../common/decorators/org-scoped.decorator.js";
import { TeamScoped } from "../../../../common/decorators/team-scoped.decorator.js";
import type { PaginationDto } from "../../../../common/dto/pagination.dto.js";
import type { OrgScope } from "../../../../common/tenancy/org-scope.js";
import type { TeamScope } from "../../../../common/tenancy/team-scope.js";
import { teamWhere } from "../../../../common/tenancy/team-where.js";
import { ResourceNotFoundException } from "../../../../common/exceptions/business.exception.js";
import { AuditWriter } from "../../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../../shared/prisma/prisma.service.js";
import { findEmployeeInWriteScope } from "../shared/payroll-scope.js";
import type { CreateBonusDto, QueryBonusDto } from "./dto/bonus.dto.js";

const VIA_EMPLOYEE = {
  teamField: "employee.teamId",
  ownerField: "employee.userId",
};

const INCLUDE_DETAILS = {
  employee: {
    select: {
      id: true,
      employeeCode: true,
      fullName: true,
      teamId: true,
      userId: true,
    },
  },
  payrollPeriod: {
    select: { id: true, year: true, month: true, status: true },
  },
  approver: {
    select: { id: true, fullName: true },
  },
} satisfies Prisma.EmployeeBonusInclude;

export type BonusRow = Prisma.EmployeeBonusGetPayload<{
  include: typeof INCLUDE_DETAILS;
}>;

@Injectable()
export class BonusesRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
  ) {}

  @TeamScoped()
  async findMany(
    scope: TeamScope,
    query: QueryBonusDto,
    pagination: PaginationDto,
  ): Promise<{ items: BonusRow[]; total: number }> {
    const filter: Prisma.EmployeeBonusWhereInput = {
      deletedAt: null,
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.payrollPeriodId
        ? { payrollPeriodId: query.payrollPeriodId }
        : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const where = teamWhere(
      scope,
      filter,
      VIA_EMPLOYEE,
    ) as Prisma.EmployeeBonusWhereInput;

    const [items, total] = await Promise.all([
      this.prisma.employeeBonus.findMany({
        where,
        include: INCLUDE_DETAILS,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [{ id: "desc" }],
      }),
      this.prisma.employeeBonus.count({ where }),
    ]);

    return { items, total };
  }

  @TeamScoped()
  async findById(scope: TeamScope, id: number): Promise<BonusRow | null> {
    const where = teamWhere(
      scope,
      { id, deletedAt: null },
      VIA_EMPLOYEE,
    ) as Prisma.EmployeeBonusWhereInput;

    return this.prisma.employeeBonus.findFirst({
      where,
      include: INCLUDE_DETAILS,
    });
  }

  /** Within the caller's write scope (`.team`: own teams; `.own`: never). */
  @TeamScoped()
  async create(
    scope: TeamScope,
    dto: CreateBonusDto,
    createdById: number,
  ): Promise<BonusRow> {
    return this.prisma.$transaction(async (tx) => {
      await findEmployeeInWriteScope(tx, scope, dto.employeeId);
      const created = await tx.employeeBonus.create({
        data: {
          organizationId: scope.organizationId,
          employeeId: dto.employeeId,
          payrollPeriodId: dto.payrollPeriodId ?? null,
          bonusType: dto.bonusType,
          calculationBase: dto.calculationBase ?? null,
          tenureMonths: dto.tenureMonths ?? null,
          attendanceDays: dto.attendanceDays ?? null,
          amount: dto.amount,
          status: "PENDING",
          reason: dto.reason ?? null,
          createdBy: createdById,
          updatedBy: createdById,
        },
        include: INCLUDE_DETAILS,
      });
      await this.audit.write(tx, {
        entityType: "employee_bonus",
        entityId: created.id,
        action: "create",
        after: {
          employeeId: created.employeeId,
          bonusType: created.bonusType,
          amount: created.amount.toString(),
          payrollPeriodId: created.payrollPeriodId,
        },
        reason: dto.reason,
      });
      return created;
    });
  }

  @TeamScoped()
  async decide(
    scope: TeamScope,
    id: number,
    status: "APPROVED" | "REJECTED",
    approvedById: number,
    note?: string,
  ): Promise<BonusRow | null> {
    return this.prisma.$transaction(async (tx) => {
      const bonus = await tx.employeeBonus.findFirst({
        where: teamWhere(
          scope,
          { id, deletedAt: null },
          VIA_EMPLOYEE,
        ) as Prisma.EmployeeBonusWhereInput,
        select: { employeeId: true },
      });
      if (!bonus) throw new ResourceNotFoundException("Employee bonus", id);
      await findEmployeeInWriteScope(tx, scope, bonus.employeeId);
      // Conditional on PENDING so two approvers racing on the same bonus
      // can't both win — the loser's update matches 0 rows and gets null.
      const { count } = await tx.employeeBonus.updateMany({
        where: { id, organizationId: scope.organizationId, status: "PENDING" },
        data: {
          status,
          approvedById,
          approvedAt: new Date(),
          updatedBy: approvedById,
        },
      });
      if (count === 0) return null;
      await this.audit.write(tx, {
        entityType: "employee_bonus",
        entityId: id,
        action: status === "APPROVED" ? "approve" : "reject",
        before: { status: "PENDING" },
        after: { status },
        reason: note,
      });
      return tx.employeeBonus.findUniqueOrThrow({
        where: { id },
        include: INCLUDE_DETAILS,
      });
    });
  }

  /**
   * Per employee, the finalized months of a financial year: Basic + DA
   * earned and payable days, from the approved run of every FINALIZED
   * period in [fyStart, fyEnd]. For the statutory bonus.
   */
  @OrgScoped()
  async finalizedYearEntries(scope: OrgScope, fyStart: Date, fyEnd: Date) {
    return this.prisma.payrollEntry.findMany({
      where: {
        organizationId: scope.organizationId,
        deletedAt: null,
        status: { not: "CANCELLED" },
        payrollRun: {
          status: "APPROVED",
          payrollPeriod: {
            status: "FINALIZED",
            periodStart: { gte: fyStart, lte: fyEnd },
          },
        },
      },
      select: {
        employeeId: true,
        payableDays: true,
        employee: {
          select: { id: true, employeeCode: true, fullName: true },
        },
        earnings: {
          where: { code: { in: ["BASIC", "DA"] }, deletedAt: null },
          select: { code: true, baseAmount: true, calculatedAmount: true },
        },
      },
      orderBy: { id: "asc" },
    });
  }

  /** Employees who already have a live statutory bonus for this year. */
  @OrgScoped()
  async statutoryBonusAlreadyRaised(scope: OrgScope, financialYear: string) {
    const rows = await this.prisma.employeeBonus.findMany({
      where: {
        organizationId: scope.organizationId,
        bonusType: "STATUTORY",
        calculationBase: `FY ${financialYear}`,
        status: { not: "REJECTED" },
        deletedAt: null,
      },
      select: { employeeId: true },
    });
    return new Set(rows.map((r) => r.employeeId));
  }

  /** Raises the year's statutory bonuses (PENDING approval) in one go. */
  @OrgScoped()
  async createStatutoryBonuses(
    scope: OrgScope,
    financialYear: string,
    rows: Array<{ employeeId: number; amount: number; workedDays: number }>,
    userId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const ids: number[] = [];
      for (const r of rows) {
        const created = await tx.employeeBonus.create({
          data: {
            organizationId: scope.organizationId,
            employeeId: r.employeeId,
            bonusType: "STATUTORY",
            calculationBase: `FY ${financialYear}`,
            attendanceDays: r.workedDays,
            amount: r.amount,
            status: "PENDING",
            reason: `Statutory bonus for FY ${financialYear}`,
            createdBy: userId,
            updatedBy: userId,
          },
          select: { id: true },
        });
        ids.push(created.id);
      }
      await this.audit.write(tx, {
        entityType: "employee_bonus",
        entityId: ids[0] ?? 0,
        action: "statutory_calculate",
        after: { financialYear, bonusIds: ids },
      });
      return ids;
    });
  }

  /** The employee (in read scope) with Basic + DA in force on `asOf`. */
  @TeamScoped()
  async gratuityInputs(scope: TeamScope, employeeId: number, asOf: Date) {
    return this.prisma.employee.findFirst({
      where: teamWhere(scope, {
        id: employeeId,
        deletedAt: null,
      }) as Prisma.EmployeeWhereInput,
      select: {
        id: true,
        employeeCode: true,
        fullName: true,
        dateOfJoining: true,
        dateOfExit: true,
        salaries: {
          where: {
            deletedAt: null,
            effectiveFrom: { lte: asOf },
            OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOf } }],
          },
          orderBy: { effectiveFrom: "desc" },
          take: 1,
          select: {
            basic: true,
            components: {
              where: { component: { code: { in: ["BASIC", "DA"] } } },
              select: { monthlyAmount: true },
            },
          },
        },
      },
    });
  }
}
