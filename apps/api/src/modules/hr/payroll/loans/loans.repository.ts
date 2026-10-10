import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../../../common/decorators/org-scoped.decorator.js";
import { TeamScoped } from "../../../../common/decorators/team-scoped.decorator.js";
import type { PaginationDto } from "../../../../common/dto/pagination.dto.js";
import type { OrgScope } from "../../../../common/tenancy/org-scope.js";
import type { TeamScope } from "../../../../common/tenancy/team-scope.js";
import { teamWhere } from "../../../../common/tenancy/team-where.js";
import { PrismaService } from "../../../../shared/prisma/prisma.service.js";
import { issuePayrollNumber } from "../shared/payroll-locks.js";
import type { CreateLoanDto, QueryLoanDto } from "./dto/loan.dto.js";

/** Same day `months` later, clamped to the month end (31 Jan + 1 = 28/29 Feb). */
function addMonths(date: Date, months: number): Date {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(date.getUTCDate(), lastDay)));
}

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
  repayments: {
    orderBy: { installmentNo: "asc" },
  },
  skipRequests: {
    include: {
      payrollPeriod: { select: { id: true, year: true, month: true } },
      requester: { select: { id: true, fullName: true } },
      approver: { select: { id: true, fullName: true } },
    },
    orderBy: { id: "desc" },
  },
} satisfies Prisma.EmployeeLoanInclude;

export type LoanRow = Prisma.EmployeeLoanGetPayload<{
  include: typeof INCLUDE_DETAILS;
}>;

@Injectable()
export class LoansRepository {
  constructor(private readonly prisma: PrismaService) {}

  @TeamScoped()
  async findMany(
    scope: TeamScope,
    query: QueryLoanDto,
    pagination: PaginationDto,
  ): Promise<{ items: LoanRow[]; total: number }> {
    const filter: Prisma.EmployeeLoanWhereInput = {
      deletedAt: null,
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const where = teamWhere(
      scope,
      filter,
      VIA_EMPLOYEE,
    ) as Prisma.EmployeeLoanWhereInput;

    const [items, total] = await Promise.all([
      this.prisma.employeeLoan.findMany({
        where,
        include: INCLUDE_DETAILS,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [{ id: "desc" }],
      }),
      this.prisma.employeeLoan.count({ where }),
    ]);

    return { items, total };
  }

  @TeamScoped()
  async findById(scope: TeamScope, id: number): Promise<LoanRow | null> {
    const where = teamWhere(
      scope,
      { id, deletedAt: null },
      VIA_EMPLOYEE,
    ) as Prisma.EmployeeLoanWhereInput;

    return this.prisma.employeeLoan.findFirst({
      where,
      include: INCLUDE_DETAILS,
    });
  }

  /**
   * Creates the loan and its full repayment schedule: `emiMonths`
   * installments one month apart, the last one adjusted so the schedule sums
   * to exactly the principal (the service has validated that it fits). The
   * loan number comes from the per-organization counter (no count() race).
   */
  @OrgScoped()
  async create(
    scope: OrgScope,
    dto: CreateLoanDto,
    disbursedDate: Date,
    createdById: number,
  ): Promise<LoanRow> {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const seq = await issuePayrollNumber(
        tx,
        scope.organizationId,
        "employee_loan",
      );
      const loan = await tx.employeeLoan.create({
        data: {
          organizationId: scope.organizationId,
          employeeId: dto.employeeId,
          loanNumber: `LOAN-${String(seq).padStart(6, "0")}`,
          principalAmount: dto.principalAmount,
          emiAmount: dto.emiAmount,
          emiMonths: dto.emiMonths,
          disbursedDate,
          status: "ACTIVE",
          reason: dto.reason ?? null,
          createdBy: createdById,
          updatedBy: createdById,
        },
      });

      const principal = new Prisma.Decimal(dto.principalAmount);
      const emi = new Prisma.Decimal(dto.emiAmount);
      const lastAmount = principal.sub(emi.mul(dto.emiMonths - 1));

      const repaymentsData: Prisma.LoanRepaymentCreateManyInput[] = [];
      for (let i = 1; i <= dto.emiMonths; i++) {
        repaymentsData.push({
          organizationId: scope.organizationId,
          loanId: loan.id,
          installmentNo: i,
          dueDate: addMonths(disbursedDate, i),
          amount: i === dto.emiMonths ? lastAmount : emi,
          status: "PENDING",
          createdBy: createdById,
          updatedBy: createdById,
        });
      }

      await tx.loanRepayment.createMany({ data: repaymentsData });

      return tx.employeeLoan.findUniqueOrThrow({
        where: { id: loan.id },
        include: INCLUDE_DETAILS,
      });
    });
  }

  @OrgScoped()
  async createSkipRequest(
    scope: OrgScope,
    loanId: number,
    payrollPeriodId: number,
    reason: string,
    requestedById: number,
  ) {
    return this.prisma.loanSkipRequest.create({
      data: {
        organizationId: scope.organizationId,
        loanId,
        payrollPeriodId,
        reason,
        status: "PENDING",
        requestedById,
        createdBy: requestedById,
        updatedBy: requestedById,
      },
      include: {
        loan: { select: { id: true, loanNumber: true, employeeId: true } },
        payrollPeriod: { select: { id: true, year: true, month: true } },
      },
    });
  }

  @TeamScoped()
  async findSkipRequestById(scope: TeamScope, id: number) {
    const where = teamWhere(
      scope,
      { id, deletedAt: null },
      { teamField: "loan.employee.teamId", ownerField: "loan.employee.userId" },
    ) as Prisma.LoanSkipRequestWhereInput;

    return this.prisma.loanSkipRequest.findFirst({
      where,
      include: {
        loan: {
          select: {
            id: true,
            loanNumber: true,
            employeeId: true,
            employee: { select: { id: true, teamId: true, userId: true } },
          },
        },
        payrollPeriod: {
          select: {
            id: true,
            year: true,
            month: true,
            status: true,
            periodEnd: true,
          },
        },
      },
    });
  }

  /**
   * Decides a PENDING skip request (conditional update, so two concurrent
   * decisions cannot both apply). On approval the installment that period
   * would have recovered — the earliest still-PENDING one due by the period
   * end — becomes SKIPPED and an installment of the same amount is appended
   * one month after the current last one, so the skipped amount is still
   * recovered. Returns `null` if the request was decided meanwhile.
   */
  @OrgScoped()
  async decideSkipRequest(
    scope: OrgScope,
    id: number,
    decision: "APPROVED" | "REJECTED",
    approvedById: number,
  ) {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const { count } = await tx.loanSkipRequest.updateMany({
        where: { id, organizationId: scope.organizationId, status: "PENDING" },
        data: {
          status: decision,
          approvedById,
          approvedAt: new Date(),
          updatedBy: approvedById,
        },
      });
      if (count === 0) return null;

      const request = await tx.loanSkipRequest.findUniqueOrThrow({
        where: { id },
        include: { payrollPeriod: { select: { periodEnd: true } } },
      });

      if (decision === "APPROVED") {
        const skipped = await tx.loanRepayment.findFirst({
          where: {
            organizationId: scope.organizationId,
            loanId: request.loanId,
            status: "PENDING",
            deletedAt: null,
            dueDate: { lte: request.payrollPeriod.periodEnd },
          },
          orderBy: { installmentNo: "asc" },
        });
        if (skipped) {
          const last = await tx.loanRepayment.findFirstOrThrow({
            where: { loanId: request.loanId },
            orderBy: { installmentNo: "desc" },
          });
          await tx.loanRepayment.update({
            where: { id: skipped.id },
            data: {
              status: "SKIPPED",
              payrollEntryId: null,
              updatedBy: approvedById,
            },
          });
          await tx.loanRepayment.create({
            data: {
              organizationId: scope.organizationId,
              loanId: request.loanId,
              installmentNo: last.installmentNo + 1,
              dueDate: addMonths(last.dueDate, 1),
              amount: skipped.amount,
              status: "PENDING",
              createdBy: approvedById,
              updatedBy: approvedById,
            },
          });
        }
      }

      return tx.loanSkipRequest.findUniqueOrThrow({
        where: { id },
        include: {
          loan: { select: { id: true, loanNumber: true, employeeId: true } },
          payrollPeriod: { select: { id: true, year: true, month: true } },
        },
      });
    });
  }

  @OrgScoped()
  async findMine(
    scope: OrgScope,
    employeeId: number,
    query: QueryLoanDto,
    pagination: PaginationDto,
  ): Promise<{ items: LoanRow[]; total: number }> {
    const where: Prisma.EmployeeLoanWhereInput = {
      organizationId: scope.organizationId,
      employeeId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.employeeLoan.findMany({
        where,
        include: INCLUDE_DETAILS,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [{ id: "desc" }],
      }),
      this.prisma.employeeLoan.count({ where }),
    ]);

    return { items, total };
  }

  @OrgScoped()
  async findMineById(
    scope: OrgScope,
    employeeId: number,
    id: number,
  ): Promise<LoanRow | null> {
    return this.prisma.employeeLoan.findFirst({
      where: {
        id,
        organizationId: scope.organizationId,
        employeeId,
        deletedAt: null,
      },
      include: INCLUDE_DETAILS,
    });
  }
}
