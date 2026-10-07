import { Injectable } from "@nestjs/common";
import { PaginatedResponseDto } from "../../../../common/dto/paginated-response.dto.js";
import {
  InvalidStateTransitionException,
  ResourceNotFoundException,
} from "../../../../common/exceptions/business.exception.js";
import { TeamContextService } from "../../../../platform/tenancy/team-context.service.js";
import { TenantContextService } from "../../../../platform/tenancy/tenant-context.service.js";
import { FieldEncryptionService } from "../../../../shared/crypto/field-encryption.service.js";
import {
  assertEmployeeInWriteScope,
  requireOrgWideScope,
} from "../shared/payroll-scope.js";
import { csvCell, maskEmployeeBankDetails } from "../shared/sensitive-data.js";
import type {
  CreatePaymentBatchDto,
  QueryPaymentBatchDto,
  UpdatePaymentDto,
} from "./dto/payment.dto.js";
import { PaymentsRepository } from "./payments.repository.js";

const READ = "hr.payment.read";
const WRITE = "hr.payment.write";

/** Allowed manual status changes of a single payment. PAID and CANCELLED
 * are terminal; FAILED may be retried (back to PENDING) or settled. */
const PAYMENT_TRANSITIONS: Record<string, readonly string[]> = {
  PENDING: ["PAID", "FAILED", "CANCELLED"],
  FAILED: ["PENDING", "PAID", "CANCELLED"],
  PAID: [],
  CANCELLED: [],
};

/**
 * A payment batch pays the whole organization's approved run, so every batch
 * operation needs an `.all` grant of `hr.payment.*`. Correcting a single
 * payment is narrower: a `.team` grant may touch its own teams' payments.
 */
@Injectable()
export class PaymentsService {
  constructor(
    private readonly repository: PaymentsRepository,
    private readonly tenantContext: TenantContextService,
    private readonly teamContext: TeamContextService,
    private readonly encryption: FieldEncryptionService,
  ) {}

  async findBatches(query: QueryPaymentBatchDto) {
    await this.requireOrgWide(READ, "view payment batches");
    const scope = this.tenantContext.getOrgScope();
    const { items, total } = await this.repository.findBatches(
      scope,
      query,
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  async findBatchById(id: number) {
    await this.requireOrgWide(READ, "view payment batches");
    const batch = await this.loadBatch(id);
    return { ...batch, payments: batch.payments.map(maskEmployeeBankDetails) };
  }

  async createBatch(dto: CreatePaymentBatchDto) {
    await this.requireOrgWide(WRITE, "create payment batches");
    const scope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();
    const batch = await this.repository.createBatch(
      scope,
      dto.payrollPeriodId,
      dto.paymentMethod ?? "BANK_TRANSFER",
      userId,
    );
    if (!batch) {
      throw new ResourceNotFoundException(
        "Payroll period",
        dto.payrollPeriodId,
      );
    }
    return { ...batch, payments: batch.payments.map(maskEmployeeBankDetails) };
  }

  async processBatch(id: number) {
    await this.requireOrgWide(WRITE, "process payment batches");
    const scope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();
    const batch = await this.repository.processBatch(scope, id, userId);
    if (!batch) {
      throw new ResourceNotFoundException("Payment batch", id);
    }
    return { ...batch, payments: batch.payments.map(maskEmployeeBankDetails) };
  }

  /**
   * Bank-transfer file. It carries the full account number (the bank needs
   * it) but not PAN, and every text cell goes through `csvCell` so names
   * cannot inject spreadsheet formulas.
   */
  async exportBatchCsv(id: number): Promise<string> {
    await this.requireOrgWide(READ, "export payment batches");
    const batch = await this.loadBatch(id);
    const encryptedAccounts = await this.repository.findEncryptedAccountNumbers(
      this.tenantContext.getOrgScope(),
      batch.payments.map((p) => p.employee.id),
    );
    const headers = [
      "Employee Code",
      "Employee Name",
      "Bank Name",
      "Account Number",
      "IFSC Code",
      "Amount",
      "Payment Method",
      "Status",
      "Payment Reference",
    ];

    const lines = [headers.join(",")];

    for (const p of batch.payments) {
      const bank = p.employee.bankDetail?.deletedAt
        ? null
        : p.employee.bankDetail;
      const encrypted = encryptedAccounts.get(p.employee.id);
      const row = [
        csvCell(p.employee.employeeCode),
        csvCell(p.employee.fullName),
        csvCell(bank?.bankName),
        csvCell(bank && encrypted ? this.encryption.decrypt(encrypted) : null),
        csvCell(bank?.ifsc),
        p.amount.toString(),
        csvCell(p.paymentMethod),
        csvCell(p.status),
        csvCell(p.bankReference),
      ];
      lines.push(row.join(","));
    }

    return lines.join("\n");
  }

  async updatePayment(paymentId: number, dto: UpdatePaymentDto) {
    const scope = await this.teamContext.resolveScope(WRITE);
    const orgScope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();
    const payment = await this.repository.findPaymentById(orgScope, paymentId);
    if (!payment) {
      throw new ResourceNotFoundException("Payroll payment", paymentId);
    }
    try {
      assertEmployeeInWriteScope(scope, payment.employee);
    } catch {
      throw new ResourceNotFoundException("Payroll payment", paymentId);
    }

    if (dto.status && dto.status !== payment.status) {
      const allowed = PAYMENT_TRANSITIONS[payment.status] ?? [];
      if (!allowed.includes(dto.status)) {
        throw new InvalidStateTransitionException(
          "Payroll payment",
          payment.status,
          dto.status,
        );
      }
    }

    const updated = await this.repository.updatePayment(
      orgScope,
      paymentId,
      payment.status,
      dto,
      userId,
    );
    if (!updated) {
      // Someone else changed the status between our read and write.
      throw new InvalidStateTransitionException(
        "Payroll payment",
        payment.status,
        dto.status ?? payment.status,
        "the payment was modified concurrently",
      );
    }
    return maskEmployeeBankDetails(updated);
  }

  private async loadBatch(id: number) {
    const scope = this.tenantContext.getOrgScope();
    const row = await this.repository.findBatchById(scope, id);
    if (!row) {
      throw new ResourceNotFoundException("Payment batch", id);
    }
    return row;
  }

  private async requireOrgWide(permission: string, action: string) {
    const scope = await this.teamContext.resolveScope(permission);
    requireOrgWideScope(scope, action);
  }
}
