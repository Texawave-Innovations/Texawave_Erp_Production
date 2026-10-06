import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../../../common/decorators/org-scoped.decorator.js";
import { TeamScoped } from "../../../../common/decorators/team-scoped.decorator.js";
import type { PaginationDto } from "../../../../common/dto/pagination.dto.js";
import type { OrgScope } from "../../../../common/tenancy/org-scope.js";
import type { TeamScope } from "../../../../common/tenancy/team-scope.js";
import { teamWhere } from "../../../../common/tenancy/team-where.js";
import { PrismaService } from "../../../../shared/prisma/prisma.service.js";
import type { CreateLoanDto, QueryLoanDto } from "./dto/loan.dto.js";

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

  @OrgScoped()
  async create(
    scope: OrgScope,
    dto: CreateLoanDto,
    loanNumber: string,
    disbursedDate: Date,
    createdById: number,
  ): Promise<LoanRow> {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const loan = await tx.employeeLoan.create({
        data: {
          organizationId: scope.organizationId,
          employeeId: dto.employeeId,
          loanNumber,
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

      // Pre-schedule EMI installments
      const repaymentsData: Prisma.LoanRepaymentCreateManyInput[] = [];
      for (let i = 1; i <= dto.emiMonths; i++) {
        const dueDate = new Date(disbursedDate);
        dueDate.setUTCMonth(dueDate.getUTCMonth() + i);
        repaymentsData.push({
          organizationId: scope.organizationId,
          loanId: loan.id,
          installmentNo: i,
          dueDate,
          amount: dto.emiAmount,
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
        payrollPeriod: { select: { id: true, year: true, month: true } },
      },
    });
  }

  @OrgScoped()
  async decideSkipRequest(
    scope: OrgScope,
    id: number,
    status: "APPROVED" | "REJECTED",
    approvedById: number,
  ) {
    return this.prisma.loanSkipRequest.update({
      where: { id },
      data: {
        status,
        approvedById,
        approvedAt: new Date(),
        updatedBy: approvedById,
      },
      include: {
        loan: true,
        payrollPeriod: true,
      },
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
