import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../../../common/decorators/org-scoped.decorator.js";
import type { PaginationDto } from "../../../../common/dto/pagination.dto.js";
import type { OrgScope } from "../../../../common/tenancy/org-scope.js";
import {
  BusinessRuleConflictException,
  BusinessRuleViolationException,
} from "../../../../common/exceptions/business.exception.js";
import { PrismaService } from "../../../../shared/prisma/prisma.service.js";
import {
  issuePayrollNumber,
  lockPayrollPeriod,
  periodTag,
} from "../shared/payroll-locks.js";
import { findApprovedRun } from "../shared/payslip-generation.js";
import type {
  QueryPaymentBatchDto,
  UpdatePaymentDto,
} from "./dto/payment.dto.js";

const INCLUDE_BATCH_DETAILS = {
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
  generator: {
    select: {
      id: true,
      fullName: true,
    },
  },
} satisfies Prisma.PaymentBatchInclude;

const INCLUDE_PAYMENT_DETAILS = {
  employee: {
    select: {
      id: true,
      employeeCode: true,
      fullName: true,
      teamId: true,
      userId: true,
      bankDetails: {
        select: {
          bankName: true,
          accountNumber: true,
          ifscCode: true,
        },
      },
    },
  },
  payrollEntry: {
    select: {
      id: true,
      netPayable: true,
      totalGrossEarnings: true,
      totalDeductions: true,
    },
  },
} satisfies Prisma.PayrollPaymentInclude;

@Injectable()
export class PaymentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  @OrgScoped()
  async findBatches(
    scope: OrgScope,
    query: QueryPaymentBatchDto,
    pagination: PaginationDto,
  ) {
    const where: Prisma.PaymentBatchWhereInput = {
      organizationId: scope.organizationId,
      deletedAt: null,
      ...(query.payrollPeriodId
        ? { payrollPeriodId: query.payrollPeriodId }
        : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.paymentBatch.findMany({
        where,
        include: INCLUDE_BATCH_DETAILS,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [{ id: "desc" }],
      }),
      this.prisma.paymentBatch.count({ where }),
    ]);

    return { items, total };
  }

  @OrgScoped()
  async findBatchById(scope: OrgScope, id: number) {
    return this.prisma.paymentBatch.findFirst({
      where: {
        id,
        organizationId: scope.organizationId,
        deletedAt: null,
      },
      include: {
        ...INCLUDE_BATCH_DETAILS,
        payments: {
          include: INCLUDE_PAYMENT_DETAILS,
          orderBy: { id: "asc" },
        },
      },
    });
  }

  /**
   * Creates the payout batch for a FINALIZED period from its single approved
   * run, under the period row lock, so two concurrent calls cannot both
   * create one: at most one non-cancelled batch exists per period. For bank
   * transfers every employee must have bank details — a batch with blank
   * account lines is refused rather than silently produced. Returns `null`
   * for an unknown period.
   */
  @OrgScoped()
  async createBatch(
    scope: OrgScope,
    payrollPeriodId: number,
    paymentMethod: string,
    userId: number,
  ) {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const period = await lockPayrollPeriod(
        tx,
        scope.organizationId,
        payrollPeriodId,
      );
      if (!period) return null;

      if (period.status !== "FINALIZED") {
        throw new BusinessRuleViolationException(
          "Payment batches can only be created for a finalized payroll period",
          "PERIOD_NOT_FINALIZED",
        );
      }

      const existing = await tx.paymentBatch.findFirst({
        where: {
          organizationId: scope.organizationId,
          payrollPeriodId,
          deletedAt: null,
          status: { not: "CANCELLED" },
        },
        select: { batchNumber: true },
      });
      if (existing) {
        throw new BusinessRuleConflictException(
          `A payment batch (${existing.batchNumber}) already exists for this period`,
          "PAYMENT_BATCH_EXISTS",
        );
      }

      const run = await findApprovedRun(
        tx,
        scope.organizationId,
        payrollPeriodId,
      );
      const entries = await tx.payrollEntry.findMany({
        where: {
          organizationId: scope.organizationId,
          payrollRunId: run.id,
          deletedAt: null,
        },
        include: {
          employee: {
            select: {
              employeeCode: true,
              bankDetails: { select: { id: true, deletedAt: true } },
            },
          },
        },
        orderBy: { id: "asc" },
      });
      if (entries.length === 0) {
        throw new BusinessRuleViolationException(
          "The approved payroll run has no entries",
          "PAYROLL_RUN_EMPTY",
        );
      }

      if (paymentMethod === "BANK_TRANSFER") {
        const missing = entries
          .filter(
            (e) => !e.employee.bankDetails || e.employee.bankDetails.deletedAt,
          )
          .map((e) => e.employee.employeeCode);
        if (missing.length > 0) {
          throw new BusinessRuleViolationException(
            `Bank details are missing for: ${missing.join(", ")}`,
            "BANK_DETAILS_MISSING",
          );
        }
      }

      const seq = await issuePayrollNumber(
        tx,
        scope.organizationId,
        "payment_batch",
      );
      const batchNumber = `BATCH-${periodTag(period)}-${String(seq).padStart(6, "0")}`;
      const totalAmount = entries.reduce(
        (sum, entry) => sum.add(new Prisma.Decimal(entry.netPayable)),
        new Prisma.Decimal(0),
      );

      return tx.paymentBatch.create({
        data: {
          organizationId: scope.organizationId,
          payrollPeriodId,
          batchNumber,
          totalEmployees: entries.length,
          totalAmount,
          generatedById: userId,
          status: "PENDING",
          createdBy: userId,
          updatedBy: userId,
          payments: {
            create: entries.map((entry) => ({
              organizationId: scope.organizationId,
              payrollEntryId: entry.id,
              employeeId: entry.employeeId,
              amount: entry.netPayable,
              paymentMethod,
              status: "PENDING",
              createdBy: userId,
              updatedBy: userId,
            })),
          },
        },
        include: {
          ...INCLUDE_BATCH_DETAILS,
          payments: {
            include: INCLUDE_PAYMENT_DETAILS,
            orderBy: { id: "asc" },
          },
        },
      });
    });
  }

  /**
   * PENDING -> PROCESSED as one conditional update: of two concurrent calls
   * exactly one matches the PENDING row; the other fails. Only payments
   * still PENDING are marked PAID (a FAILED/CANCELLED one is left alone).
   * Returns `null` for an unknown batch.
   */
  @OrgScoped()
  async processBatch(scope: OrgScope, id: number, userId: number) {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const batch = await tx.paymentBatch.findFirst({
        where: { id, organizationId: scope.organizationId, deletedAt: null },
        select: { id: true, status: true },
      });
      if (!batch) return null;

      const now = new Date();
      const { count } = await tx.paymentBatch.updateMany({
        where: {
          id: batch.id,
          organizationId: scope.organizationId,
          status: "PENDING",
        },
        data: { status: "PROCESSED", processedAt: now, updatedBy: userId },
      });
      if (count === 0) {
        throw new BusinessRuleViolationException(
          `Payment batch cannot be processed from status ${batch.status}`,
          "BATCH_ALREADY_PROCESSED",
        );
      }

      await tx.payrollPayment.updateMany({
        where: {
          paymentBatchId: batch.id,
          organizationId: scope.organizationId,
          status: "PENDING",
        },
        data: { status: "PAID", creditedAt: now, updatedBy: userId },
      });

      return tx.paymentBatch.findUniqueOrThrow({
        where: { id: batch.id },
        include: {
          ...INCLUDE_BATCH_DETAILS,
          payments: {
            include: INCLUDE_PAYMENT_DETAILS,
            orderBy: { id: "asc" },
          },
        },
      });
    });
  }

  /** Applies the change only if the payment is still in `expectedStatus`
   * (the service validated the transition from it); `null` otherwise. */
  @OrgScoped()
  async updatePayment(
    scope: OrgScope,
    paymentId: number,
    expectedStatus: string,
    dto: UpdatePaymentDto,
    userId: number,
  ) {
    const { count } = await this.prisma.payrollPayment.updateMany({
      where: {
        id: paymentId,
        organizationId: scope.organizationId,
        status: expectedStatus,
        deletedAt: null,
      },
      data: {
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.bankReference !== undefined
          ? { bankReference: dto.bankReference }
          : {}),
        ...(dto.creditedAt ? { creditedAt: new Date(dto.creditedAt) } : {}),
        updatedBy: userId,
      },
    });
    if (count === 0) return null;
    return this.findPaymentById(scope, paymentId);
  }

  @OrgScoped()
  async findPaymentById(scope: OrgScope, paymentId: number) {
    return this.prisma.payrollPayment.findFirst({
      where: {
        id: paymentId,
        organizationId: scope.organizationId,
        deletedAt: null,
      },
      include: INCLUDE_PAYMENT_DETAILS,
    });
  }
}
