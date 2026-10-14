import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../../../common/decorators/org-scoped.decorator.js";
import { TeamScoped } from "../../../../common/decorators/team-scoped.decorator.js";
import type { PaginationDto } from "../../../../common/dto/pagination.dto.js";
import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from "../../../../common/exceptions/business.exception.js";
import type { OrgScope } from "../../../../common/tenancy/org-scope.js";
import type { TeamScope } from "../../../../common/tenancy/team-scope.js";
import { teamWhere } from "../../../../common/tenancy/team-where.js";
import { AuditWriter } from "../../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../../shared/prisma/prisma.service.js";
import { issuePayrollNumber } from "../shared/payroll-locks.js";
import { findEmployeeInWriteScope } from "../shared/payroll-scope.js";
import type { CreateLoanDto, QueryLoanDto } from "./dto/loan.dto.js";
import { addMonths, applyPrepayment, buildSchedule } from "./loan.rules.js";

const VIA_EMPLOYEE = {
  teamField: "employee.teamId",
  ownerField: "employee.userId",
};
const VIA_LOAN = {
  teamField: "loan.employee.teamId",
  ownerField: "loan.employee.userId",
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
  approver: { select: { id: true, fullName: true } },
  hrReviewer: { select: { id: true, fullName: true } },
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
  prepayments: {
    include: {
      requester: { select: { id: true, fullName: true } },
      decider: { select: { id: true, fullName: true } },
    },
    orderBy: { id: "desc" },
  },
} satisfies Prisma.EmployeeLoanInclude;

export type LoanRow = Prisma.EmployeeLoanGetPayload<{
  include: typeof INCLUDE_DETAILS;
}>;

function loanSnapshot(l: {
  status: string;
  principalAmount: unknown;
  emiAmount: unknown;
  emiMonths: number;
  limitOverride: boolean;
}) {
  return {
    status: l.status,
    principalAmount: String(l.principalAmount),
    emiAmount: String(l.emiAmount),
    emiMonths: l.emiMonths,
    limitOverride: l.limitOverride,
  };
}

/**
 * Employee loans. Every single-employee write is `@TeamScoped()`: the loan
 * (or its employee) is re-read through the caller's scope inside the
 * transaction, so a `.team` grant never reaches another team's loan and
 * `.own` never writes (Docs/CODING_STANDARDS.md §10a). Each write carries
 * its audit row.
 */
@Injectable()
export class LoansRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
  ) {}

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

  /** Monthly EMIs of the employee's other live loans (active or awaiting
   * approval) — for the EMI limit. */
  @OrgScoped()
  async otherEmis(scope: OrgScope, employeeId: number): Promise<number> {
    const agg = await this.prisma.employeeLoan.aggregate({
      where: {
        organizationId: scope.organizationId,
        employeeId,
        deletedAt: null,
        status: { in: ["ACTIVE", "PENDING_HR", "PENDING_ADMIN"] },
      },
      _sum: { emiAmount: true },
    });
    return Number(agg._sum.emiAmount ?? 0);
  }

  /** The employee's gross monthly salary in force on `date`, or null. */
  @OrgScoped()
  async grossOn(
    scope: OrgScope,
    employeeId: number,
    date: Date,
  ): Promise<number | null> {
    const salary = await this.prisma.employeeSalary.findFirst({
      where: {
        organizationId: scope.organizationId,
        employeeId,
        deletedAt: null,
        effectiveFrom: { lte: date },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: date } }],
      },
      orderBy: { effectiveFrom: "desc" },
      select: { grossMonthly: true },
    });
    return salary ? Number(salary.grossMonthly) : null;
  }

  /**
   * Records a loan request HR makes for an employee: PENDING_HR (the HR
   * review, by someone else), no schedule yet (the schedule
   * is built when it is approved). The loan number comes from the
   * per-organization counter.
   */
  @TeamScoped()
  async create(
    scope: TeamScope,
    dto: CreateLoanDto,
    disbursedDate: Date,
    limitOverride: boolean,
    createdById: number,
  ): Promise<LoanRow> {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await findEmployeeInWriteScope(tx, scope, dto.employeeId);
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
          status: "PENDING_HR",
          requestedVia: "HR",
          reason: dto.reason ?? null,
          limitOverride,
          overrideReason: limitOverride ? (dto.overrideReason ?? null) : null,
          createdBy: createdById,
          updatedBy: createdById,
        },
      });
      await this.audit.write(tx, {
        entityType: "employee_loan",
        entityId: loan.id,
        action: "create",
        after: loanSnapshot(loan),
        reason: limitOverride ? dto.overrideReason : dto.reason,
      });
      return tx.employeeLoan.findUniqueOrThrow({
        where: { id: loan.id },
        include: INCLUDE_DETAILS,
      });
    });
  }

  /**
   * Final approval of a loan HR forwarded (PENDING_ADMIN; conditional update — decided exactly
   * once). Approval builds the repayment schedule from the recorded
   * disbursement date (HR may record a loan given earlier); the first EMI
   * falls due one month after it. Returns `null` if it was decided meanwhile.
   */
  @TeamScoped()
  async decide(
    scope: TeamScope,
    id: number,
    decision: "APPROVED" | "REJECTED",
    note: string | undefined,
    userId: number,
  ): Promise<LoanRow | null> {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const loan = await tx.employeeLoan.findFirst({
        where: teamWhere(
          scope,
          { id, deletedAt: null },
          VIA_EMPLOYEE,
        ) as Prisma.EmployeeLoanWhereInput,
      });
      if (!loan) throw new ResourceNotFoundException("Employee loan", id);
      await findEmployeeInWriteScope(tx, scope, loan.employeeId);

      const disbursedOn = loan.disbursedDate;
      const { count } = await tx.employeeLoan.updateMany({
        where: {
          id,
          status: "PENDING_ADMIN",
          // Maker-checker, also under concurrency: never the HR reviewer.
          NOT: { hrReviewedById: userId },
        },
        data: {
          status: decision === "APPROVED" ? "ACTIVE" : "REJECTED",
          approvedById: userId,
          approvedAt: new Date(),
          decisionNote: note ?? null,
          updatedBy: userId,
        },
      });
      if (count === 0) return null;

      if (decision === "APPROVED") {
        const schedule = buildSchedule(
          Number(loan.principalAmount),
          Number(loan.emiAmount),
          loan.emiMonths,
          disbursedOn,
        );
        if (!schedule) throw new Error("Loan schedule became invalid");
        await tx.loanRepayment.createMany({
          data: schedule.map((i) => ({
            organizationId: scope.organizationId,
            loanId: id,
            installmentNo: i.installmentNo,
            dueDate: i.dueDate,
            amount: i.amount,
            status: "PENDING",
            createdBy: userId,
            updatedBy: userId,
          })),
        });
      }
      await this.audit.write(tx, {
        entityType: "employee_loan",
        entityId: id,
        action: decision === "APPROVED" ? "approve" : "reject",
        before: { status: "PENDING_ADMIN" },
        after: {
          status: decision === "APPROVED" ? "ACTIVE" : "REJECTED",
          disbursedDate: disbursedOn.toISOString().slice(0, 10),
        },
        reason: note,
      });
      return tx.employeeLoan.findUniqueOrThrow({
        where: { id },
        include: INCLUDE_DETAILS,
      });
    });
  }

  /**
   * The employee's own loan request from the portal (`requested_via` SELF):
   * PENDING_HR, no schedule yet. `employeeId` is always the caller's own
   * employee record (the service resolves it), never a client value.
   */
  @OrgScoped()
  async createForSelf(
    scope: OrgScope,
    employeeId: number,
    dto: CreateLoanDto,
    disbursedDate: Date,
    limitOverride: boolean,
    userId: number,
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
          employeeId,
          loanNumber: `LOAN-${String(seq).padStart(6, "0")}`,
          principalAmount: dto.principalAmount,
          emiAmount: dto.emiAmount,
          emiMonths: dto.emiMonths,
          disbursedDate,
          status: "PENDING_HR",
          requestedVia: "SELF",
          reason: dto.reason ?? null,
          limitOverride,
          overrideReason: limitOverride ? (dto.overrideReason ?? null) : null,
          createdBy: userId,
          updatedBy: userId,
        },
      });
      await this.audit.write(tx, {
        entityType: "employee_loan",
        entityId: loan.id,
        action: "request",
        after: { ...loanSnapshot(loan), requestedVia: "SELF" },
        reason: limitOverride ? dto.overrideReason : dto.reason,
      });
      return tx.employeeLoan.findUniqueOrThrow({
        where: { id: loan.id },
        include: INCLUDE_DETAILS,
      });
    });
  }

  /**
   * The HR step (PENDING_HR → PENDING_ADMIN or REJECTED), within the
   * caller's review scope; conditional update, so it happens exactly once.
   * A rejection keeps its note as the loan's decision note too. Returns
   * `null` if it was reviewed meanwhile.
   */
  @TeamScoped()
  async review(
    scope: TeamScope,
    id: number,
    decision: "FORWARD" | "REJECT",
    note: string | undefined,
    userId: number,
  ): Promise<LoanRow | null> {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const loan = await tx.employeeLoan.findFirst({
        where: teamWhere(
          scope,
          { id, deletedAt: null },
          VIA_EMPLOYEE,
        ) as Prisma.EmployeeLoanWhereInput,
        select: { employeeId: true },
      });
      if (!loan) throw new ResourceNotFoundException("Employee loan", id);
      await findEmployeeInWriteScope(tx, scope, loan.employeeId);
      const rejecting = decision === "REJECT";
      const { count } = await tx.employeeLoan.updateMany({
        where: { id, status: "PENDING_HR" },
        data: {
          status: rejecting ? "REJECTED" : "PENDING_ADMIN",
          hrReviewedById: userId,
          hrReviewedAt: new Date(),
          hrReviewNote: note ?? null,
          ...(rejecting ? { decisionNote: note ?? null } : {}),
          updatedBy: userId,
        },
      });
      if (count === 0) return null;
      await this.audit.write(tx, {
        entityType: "employee_loan",
        entityId: id,
        action: rejecting ? "hr_reject" : "hr_forward",
        before: { status: "PENDING_HR" },
        after: { status: rejecting ? "REJECTED" : "PENDING_ADMIN" },
        reason: note,
      });
      return tx.employeeLoan.findUniqueOrThrow({
        where: { id },
        include: INCLUDE_DETAILS,
      });
    });
  }

  /** What the loan notifications need (organization-filtered). */
  @OrgScoped()
  notificationFacts(scope: OrgScope, id: number) {
    return this.prisma.employeeLoan.findFirst({
      where: { id, organizationId: scope.organizationId },
      select: {
        id: true,
        loanNumber: true,
        principalAmount: true,
        status: true,
        limitOverride: true,
        createdBy: true,
        hrReviewedById: true,
        hrReviewNote: true,
        decisionNote: true,
        employee: { select: { fullName: true, userId: true, teamId: true } },
      },
    });
  }

  /**
   * Active users who hold `<prefix>.all`, or `<prefix>.team` with access to
   * `teamId` — whom a loan step notifies (`.team` only when allowed).
   */
  @OrgScoped()
  async usersHolding(
    scope: OrgScope,
    prefix: "hr.loan.review" | "hr.loan.approve",
    teamId: number,
    includeTeam: boolean,
  ): Promise<number[]> {
    const holding = (code: string): Prisma.UserWhereInput => ({
      userRoles: {
        some: {
          isActive: true,
          role: {
            organizationId: scope.organizationId,
            isActive: true,
            rolePermissions: {
              some: { isActive: true, permission: { code, isActive: true } },
            },
          },
        },
      },
    });
    const or: Prisma.UserWhereInput[] = [holding(`${prefix}.all`)];
    if (includeTeam) {
      or.push({
        AND: [
          holding(`${prefix}.team`),
          { teamAccess: { some: { teamId, isActive: true } } },
        ],
      });
    }
    const rows = await this.prisma.user.findMany({
      where: {
        organizationId: scope.organizationId,
        isActive: true,
        deletedAt: null,
        OR: or,
      },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  @TeamScoped()
  async createSkipRequest(
    scope: TeamScope,
    loanId: number,
    payrollPeriodId: number,
    reason: string,
    requestedById: number,
  ) {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const loan = await tx.employeeLoan.findFirst({
        where: teamWhere(
          scope,
          { id: loanId, deletedAt: null },
          VIA_EMPLOYEE,
        ) as Prisma.EmployeeLoanWhereInput,
        select: { employeeId: true },
      });
      if (!loan) throw new ResourceNotFoundException("Employee loan", loanId);
      await findEmployeeInWriteScope(tx, scope, loan.employeeId);

      const created = await tx.loanSkipRequest.create({
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
      await this.audit.write(tx, {
        entityType: "loan_skip_request",
        entityId: created.id,
        action: "create",
        after: { loanId, payrollPeriodId, status: "PENDING" },
        reason,
      });
      return created;
    });
  }

  @TeamScoped()
  async findSkipRequestById(scope: TeamScope, id: number) {
    const where = teamWhere(
      scope,
      { id, deletedAt: null },
      VIA_LOAN,
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
  @TeamScoped()
  async decideSkipRequest(
    scope: TeamScope,
    id: number,
    decision: "APPROVED" | "REJECTED",
    approvedById: number,
  ) {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const inScope = await tx.loanSkipRequest.findFirst({
        where: teamWhere(
          scope,
          { id, deletedAt: null },
          VIA_LOAN,
        ) as Prisma.LoanSkipRequestWhereInput,
        select: { loan: { select: { employeeId: true } } },
      });
      if (!inScope)
        throw new ResourceNotFoundException("Loan skip request", id);
      await findEmployeeInWriteScope(tx, scope, inScope.loan.employeeId);

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
      await this.audit.write(tx, {
        entityType: "loan_skip_request",
        entityId: id,
        action: decision === "APPROVED" ? "approve" : "reject",
        before: { status: "PENDING" },
        after: { status: decision, loanId: request.loanId },
      });

      return tx.loanSkipRequest.findUniqueOrThrow({
        where: { id },
        include: {
          loan: { select: { id: true, loanNumber: true, employeeId: true } },
          payrollPeriod: { select: { id: true, year: true, month: true } },
        },
      });
    });
  }

  @TeamScoped()
  async createPrepayment(
    scope: TeamScope,
    loanId: number,
    data: {
      amount: number;
      receivedOn: Date;
      reference?: string | undefined;
      reason: string;
    },
    userId: number,
  ) {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const loan = await tx.employeeLoan.findFirst({
        where: teamWhere(
          scope,
          { id: loanId, deletedAt: null },
          VIA_EMPLOYEE,
        ) as Prisma.EmployeeLoanWhereInput,
        select: { employeeId: true },
      });
      if (!loan) throw new ResourceNotFoundException("Employee loan", loanId);
      await findEmployeeInWriteScope(tx, scope, loan.employeeId);
      const created = await tx.loanPrepayment.create({
        data: {
          organizationId: scope.organizationId,
          loanId,
          amount: data.amount,
          receivedOn: data.receivedOn,
          reference: data.reference ?? null,
          reason: data.reason,
          status: "PENDING",
          requestedById: userId,
          createdBy: userId,
          updatedBy: userId,
        },
      });
      await this.audit.write(tx, {
        entityType: "loan_prepayment",
        entityId: created.id,
        action: "create",
        after: { loanId, amount: data.amount, status: "PENDING" },
        reason: data.reason,
      });
      return created;
    });
  }

  @TeamScoped()
  findPrepaymentById(scope: TeamScope, id: number) {
    return this.prisma.loanPrepayment.findFirst({
      where: teamWhere(
        scope,
        { id },
        VIA_LOAN,
      ) as Prisma.LoanPrepaymentWhereInput,
      include: {
        loan: {
          select: {
            id: true,
            status: true,
            employeeId: true,
            employee: { select: { userId: true } },
          },
        },
      },
    });
  }

  /**
   * Decides a PENDING prepayment (exactly once). Approval settles the LAST
   * pending installments first — ones a live payroll run has already
   * claimed are left to that run — and closes the loan when nothing is left.
   * Returns `null` if it was decided meanwhile; throws when the amount no
   * longer fits what is outstanding.
   */
  @TeamScoped()
  async decidePrepayment(
    scope: TeamScope,
    id: number,
    decision: "APPROVED" | "REJECTED",
    userId: number,
  ) {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const current = await tx.loanPrepayment.findFirst({
        where: teamWhere(
          scope,
          { id },
          VIA_LOAN,
        ) as Prisma.LoanPrepaymentWhereInput,
        include: { loan: { select: { id: true, employeeId: true } } },
      });
      if (!current) throw new ResourceNotFoundException("Loan prepayment", id);
      await findEmployeeInWriteScope(tx, scope, current.loan.employeeId);

      // Lock the loan's installments while settling them.
      await tx.$queryRaw`
        SELECT id FROM hr.loan_repayments
         WHERE loan_id = ${current.loanId}
         ORDER BY id
           FOR UPDATE`;

      const { count } = await tx.loanPrepayment.updateMany({
        where: { id, status: "PENDING" },
        data: {
          status: decision,
          decidedById: userId,
          decidedAt: new Date(),
          updatedBy: userId,
        },
      });
      if (count === 0) return null;

      let prepaidIds: number[] = [];
      if (decision === "APPROVED") {
        const pending = await tx.loanRepayment.findMany({
          where: {
            loanId: current.loanId,
            status: "PENDING",
            deletedAt: null,
            OR: [
              { payrollEntryId: null },
              { payrollEntry: { status: "CANCELLED" } },
            ],
          },
          select: { id: true, installmentNo: true, amount: true },
        });
        const outstanding = pending.reduce((s, p) => s + Number(p.amount), 0);
        if (Number(current.amount) - outstanding > 0.005) {
          throw new BusinessRuleViolationException(
            `The prepayment (${Number(current.amount)}) is more than the unclaimed outstanding balance (${Math.round(outstanding * 100) / 100})`,
            "LOAN_PREPAYMENT_EXCEEDS_BALANCE",
          );
        }
        const plan = applyPrepayment(
          pending.map((p) => ({
            id: p.id,
            installmentNo: p.installmentNo,
            amount: Number(p.amount),
          })),
          Number(current.amount),
        );
        prepaidIds = plan.prepaidIds;
        if (prepaidIds.length > 0) {
          await tx.loanRepayment.updateMany({
            where: { id: { in: prepaidIds } },
            data: { status: "PREPAID", paidAt: new Date(), updatedBy: userId },
          });
        }
        if (plan.reduced) {
          await tx.loanRepayment.update({
            where: { id: plan.reduced.id },
            data: { amount: plan.reduced.amount, updatedBy: userId },
          });
        }
        await tx.employeeLoan.updateMany({
          where: {
            id: current.loanId,
            status: "ACTIVE",
            repayments: { none: { status: "PENDING", deletedAt: null } },
          },
          data: { status: "CLOSED", updatedBy: userId },
        });
      }
      await this.audit.write(tx, {
        entityType: "loan_prepayment",
        entityId: id,
        action: decision === "APPROVED" ? "approve" : "reject",
        before: { status: "PENDING" },
        after: { status: decision, prepaidInstallmentIds: prepaidIds },
      });
      return tx.employeeLoan.findUniqueOrThrow({
        where: { id: current.loanId },
        include: INCLUDE_DETAILS,
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
