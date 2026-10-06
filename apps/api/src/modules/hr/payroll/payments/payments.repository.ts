import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../../../common/decorators/org-scoped.decorator.js";
import type { PaginationDto } from "../../../../common/dto/pagination.dto.js";
import type { OrgScope } from "../../../../common/tenancy/org-scope.js";
import { PrismaService } from "../../../../shared/prisma/prisma.service.js";
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
      bankDetails: {
        select: {
          bankName: true,
          accountNumber: true,
          ifscCode: true,
          panNumber: true,
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

  @OrgScoped()
  async createBatch(
    scope: OrgScope,
    payrollPeriodId: number,
    paymentMethod: string,
    userId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const period = await tx.payrollPeriod.findFirstOrThrow({
        where: { id: payrollPeriodId, organizationId: scope.organizationId },
      });

      const run = await tx.payrollRun.findFirst({
        where: {
          payrollPeriodId,
          organizationId: scope.organizationId,
          status: "APPROVED",
        },
        orderBy: { runNumber: "desc" },
        include: { entries: true },
      });

      if (!run || run.entries.length === 0) {
        throw new Error(
          "No approved payroll run with entries found for period",
        );
      }

      const seq = await tx.paymentBatch.count({
        where: { organizationId: scope.organizationId },
      });

      const batchNumber = `BATCH-${period.year}${String(period.month).padStart(2, "0")}-${String(seq + 1).padStart(4, "0")}`;
      const totalAmount = run.entries.reduce(
        (sum, entry) => sum.add(new Prisma.Decimal(entry.netPayable)),
        new Prisma.Decimal(0),
      );

      const batch = await tx.paymentBatch.create({
        data: {
          organizationId: scope.organizationId,
          payrollPeriodId,
          batchNumber,
          totalEmployees: run.entries.length,
          totalAmount,
          generatedById: userId,
          status: "PENDING",
          createdBy: userId,
          updatedBy: userId,
          payments: {
            create: run.entries.map((entry) => ({
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
          },
        },
      });

      return batch;
    });
  }

  @OrgScoped()
  async processBatch(scope: OrgScope, id: number, userId: number) {
    return this.prisma.$transaction(async (tx) => {
      const batch = await tx.paymentBatch.findFirstOrThrow({
        where: { id, organizationId: scope.organizationId, deletedAt: null },
      });

      const now = new Date();
      await tx.payrollPayment.updateMany({
        where: {
          paymentBatchId: batch.id,
          organizationId: scope.organizationId,
        },
        data: {
          status: "PAID",
          creditedAt: now,
          updatedBy: userId,
        },
      });

      return tx.paymentBatch.update({
        where: { id: batch.id },
        data: {
          status: "PROCESSED",
          processedAt: now,
          updatedBy: userId,
        },
        include: {
          ...INCLUDE_BATCH_DETAILS,
          payments: {
            include: INCLUDE_PAYMENT_DETAILS,
          },
        },
      });
    });
  }

  @OrgScoped()
  async updatePayment(
    scope: OrgScope,
    paymentId: number,
    dto: UpdatePaymentDto,
    userId: number,
  ) {
    return this.prisma.payrollPayment.update({
      where: { id: paymentId },
      data: {
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.bankReference !== undefined
          ? { bankReference: dto.bankReference }
          : {}),
        ...(dto.creditedAt ? { creditedAt: new Date(dto.creditedAt) } : {}),
        updatedBy: userId,
      },
      include: INCLUDE_PAYMENT_DETAILS,
    });
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
