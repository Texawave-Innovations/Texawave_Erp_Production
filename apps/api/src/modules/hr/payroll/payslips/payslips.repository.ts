import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../../../common/decorators/org-scoped.decorator.js";
import { TeamScoped } from "../../../../common/decorators/team-scoped.decorator.js";
import type { PaginationDto } from "../../../../common/dto/pagination.dto.js";
import type { OrgScope } from "../../../../common/tenancy/org-scope.js";
import type { TeamScope } from "../../../../common/tenancy/team-scope.js";
import { teamWhere } from "../../../../common/tenancy/team-where.js";
import { BusinessRuleViolationException } from "../../../../common/exceptions/business.exception.js";
import { AuditWriter } from "../../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../../shared/prisma/prisma.service.js";
import { lockPayrollPeriod } from "../shared/payroll-locks.js";
import {
  findApprovedRun,
  generatePayslipsForRun,
} from "../shared/payslip-generation.js";
import type { QueryPayslipDto } from "./dto/payslip.dto.js";

const VIA_EMPLOYEE = {
  teamField: "employee.teamId",
  ownerField: "employee.userId",
};

const INCLUDE_PAYSLIP_DETAILS = {
  employee: {
    select: {
      id: true,
      employeeCode: true,
      fullName: true,
      teamId: true,
      userId: true,
      designation: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
      team: { select: { id: true, name: true } },
      bankDetail: {
        select: {
          bankName: true,
          accountNumberMasked: true,
          ifsc: true,
          deletedAt: true,
        },
      },
      employeeGovernmentId: { select: { panNumber: true, deletedAt: true } },
      pfProfile: { select: { uan: true, pfNumber: true } },
      esiProfile: { select: { insuranceNumber: true } },
    },
  },
  payrollPeriod: {
    select: {
      id: true,
      year: true,
      month: true,
      periodStart: true,
      periodEnd: true,
      status: true,
    },
  },
  payrollEntry: {
    include: {
      earnings: {
        select: {
          code: true,
          name: true,
          baseAmount: true,
          earningRatio: true,
          calculatedAmount: true,
        },
      },
      deductions: {
        select: {
          code: true,
          name: true,
          amount: true,
          sourceType: true,
        },
      },
    },
  },
} satisfies Prisma.PayslipInclude;

/** The stored PDF bytes never go into a JSON response. */
const OMIT_PDF = { pdfContent: true } as const;

export type PayslipRow = Prisma.PayslipGetPayload<{
  include: typeof INCLUDE_PAYSLIP_DETAILS;
  omit: typeof OMIT_PDF;
}>;

@Injectable()
export class PayslipsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
  ) {}

  @TeamScoped()
  async findMany(
    scope: TeamScope,
    query: QueryPayslipDto,
    pagination: PaginationDto,
  ): Promise<{ items: PayslipRow[]; total: number }> {
    const filter: Prisma.PayslipWhereInput = {
      deletedAt: null,
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.payrollPeriodId
        ? { payrollPeriodId: query.payrollPeriodId }
        : {}),
    };

    const where = teamWhere(
      scope,
      filter,
      VIA_EMPLOYEE,
    ) as Prisma.PayslipWhereInput;

    const [items, total] = await Promise.all([
      this.prisma.payslip.findMany({
        where,
        include: INCLUDE_PAYSLIP_DETAILS,
        omit: OMIT_PDF,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [{ id: "desc" }],
      }),
      this.prisma.payslip.count({ where }),
    ]);

    return { items, total };
  }

  @TeamScoped()
  async findById(scope: TeamScope, id: number): Promise<PayslipRow | null> {
    const where = teamWhere(
      scope,
      { id, deletedAt: null },
      VIA_EMPLOYEE,
    ) as Prisma.PayslipWhereInput;

    return this.prisma.payslip.findFirst({
      where,
      include: INCLUDE_PAYSLIP_DETAILS,
      omit: OMIT_PDF,
    });
  }

  @OrgScoped()
  async findMine(
    scope: OrgScope,
    employeeId: number,
    query: QueryPayslipDto,
    pagination: PaginationDto,
  ): Promise<{ items: PayslipRow[]; total: number }> {
    const where: Prisma.PayslipWhereInput = {
      organizationId: scope.organizationId,
      employeeId,
      deletedAt: null,
      ...(query.payrollPeriodId
        ? { payrollPeriodId: query.payrollPeriodId }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.payslip.findMany({
        where,
        include: INCLUDE_PAYSLIP_DETAILS,
        omit: OMIT_PDF,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [{ id: "desc" }],
      }),
      this.prisma.payslip.count({ where }),
    ]);

    return { items, total };
  }

  @OrgScoped()
  async findMineById(
    scope: OrgScope,
    employeeId: number,
    id: number,
  ): Promise<PayslipRow | null> {
    return this.prisma.payslip.findFirst({
      where: {
        id,
        organizationId: scope.organizationId,
        employeeId,
        deletedAt: null,
      },
      include: INCLUDE_PAYSLIP_DETAILS,
      omit: OMIT_PDF,
    });
  }

  /**
   * (Re)generates payslips for the period's approved run. Both lookups are
   * organization-filtered and the period is row-locked, so another org's
   * period id is "not found" and concurrent calls cannot double-number.
   */
  @OrgScoped()
  async generateForPeriod(
    scope: OrgScope,
    payrollPeriodId: number,
    createdById: number,
    reason?: string,
  ): Promise<PayslipRow[] | null> {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const period = await lockPayrollPeriod(
        tx,
        scope.organizationId,
        payrollPeriodId,
      );
      if (!period) return null;

      const run = await findApprovedRun(
        tx,
        scope.organizationId,
        payrollPeriodId,
      );
      const { ids, regeneratedIds } = await generatePayslipsForRun(
        tx,
        scope.organizationId,
        period,
        run.id,
        createdById,
        reason,
      );
      await this.audit.write(tx, {
        entityType: "payroll_period",
        entityId: payrollPeriodId,
        action: "generate_payslips",
        after: { payrollRunId: run.id, payslips: ids.length, regeneratedIds },
        reason,
      });

      return tx.payslip.findMany({
        where: { id: { in: ids }, organizationId: scope.organizationId },
        include: INCLUDE_PAYSLIP_DETAILS,
        omit: OMIT_PDF,
        orderBy: { id: "asc" },
      });
    });
  }

  /**
   * Regenerates ONE payslip from its (still current) payroll entry: picks up
   * corrected employee, bank or company details. Only while its run is the
   * period's approved one; the reason is mandatory and versioned. Returns
   * `null` for an unknown id.
   */
  @OrgScoped()
  async regenerateOne(
    scope: OrgScope,
    id: number,
    reason: string,
    userId: number,
  ): Promise<PayslipRow | null> {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const payslip = await tx.payslip.findFirst({
        where: { id, organizationId: scope.organizationId, deletedAt: null },
        select: {
          id: true,
          version: true,
          payrollPeriodId: true,
          payrollEntryId: true,
          payrollEntry: { select: { payrollRunId: true } },
        },
      });
      if (!payslip) return null;
      const period = await lockPayrollPeriod(
        tx,
        scope.organizationId,
        payslip.payrollPeriodId,
      );
      if (!period) return null;
      const run = await findApprovedRun(
        tx,
        scope.organizationId,
        payslip.payrollPeriodId,
      );
      if (run.id !== payslip.payrollEntry.payrollRunId) {
        throw new BusinessRuleViolationException(
          "This payslip belongs to a superseded run and cannot be regenerated",
          "PAYSLIP_SUPERSEDED",
        );
      }
      const { regeneratedIds } = await generatePayslipsForRun(
        tx,
        scope.organizationId,
        period,
        run.id,
        userId,
        reason,
        [payslip.payrollEntryId],
      );
      await this.audit.write(tx, {
        entityType: "payslip",
        entityId: id,
        action: "regenerate",
        before: { version: payslip.version },
        after: { changed: regeneratedIds.includes(id) },
        reason,
      });
      return tx.payslip.findUniqueOrThrow({
        where: { id },
        include: INCLUDE_PAYSLIP_DETAILS,
        omit: OMIT_PDF,
      });
    });
  }

  /** What the PDF download needs: stored bytes, or the snapshot to render. */
  @OrgScoped()
  findPdfState(scope: OrgScope, id: number) {
    return this.prisma.payslip.findFirst({
      where: { id, organizationId: scope.organizationId, deletedAt: null },
      select: {
        payslipNumber: true,
        generatedAt: true,
        version: true,
        snapshot: true,
        pdfContent: true,
      },
    });
  }

  /** Stores the first rendering of a snapshot so every later download
   * returns the same bytes (only while none is stored). */
  @OrgScoped()
  async storePdf(scope: OrgScope, id: number, version: number, pdf: Buffer) {
    await this.prisma.payslip.updateMany({
      where: {
        id,
        organizationId: scope.organizationId,
        version,
        pdfContent: null,
      },
      data: { pdfContent: new Uint8Array(pdf), pdfRenderedAt: new Date() },
    });
  }
}
