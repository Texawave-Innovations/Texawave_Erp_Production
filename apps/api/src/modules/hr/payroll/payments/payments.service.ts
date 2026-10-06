import { Injectable } from "@nestjs/common";
import { PaginatedResponseDto } from "../../../../common/dto/paginated-response.dto.js";
import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from "../../../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../../../platform/tenancy/tenant-context.service.js";
import type {
  CreatePaymentBatchDto,
  QueryPaymentBatchDto,
  UpdatePaymentDto,
} from "./dto/payment.dto.js";
import { PaymentsRepository } from "./payments.repository.js";

@Injectable()
export class PaymentsService {
  constructor(
    private readonly repository: PaymentsRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async findBatches(query: QueryPaymentBatchDto) {
    const scope = this.tenantContext.getOrgScope();
    const { items, total } = await this.repository.findBatches(
      scope,
      query,
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  async findBatchById(id: number) {
    const scope = this.tenantContext.getOrgScope();
    const row = await this.repository.findBatchById(scope, id);
    if (!row) {
      throw new ResourceNotFoundException("Payment batch", id);
    }
    return row;
  }

  async createBatch(dto: CreatePaymentBatchDto) {
    const scope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();
    try {
      return await this.repository.createBatch(
        scope,
        dto.payrollPeriodId,
        dto.paymentMethod ?? "BANK_TRANSFER",
        userId,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new BusinessRuleViolationException(msg, "PAYMENT_BATCH_FAILED");
    }
  }

  async processBatch(id: number) {
    const scope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();
    const batch = await this.repository.findBatchById(scope, id);
    if (!batch) {
      throw new ResourceNotFoundException("Payment batch", id);
    }
    if (batch.status === "PROCESSED") {
      throw new BusinessRuleViolationException(
        "Payment batch is already processed",
        "BATCH_ALREADY_PROCESSED",
      );
    }
    return this.repository.processBatch(scope, id, userId);
  }

  async exportBatchCsv(id: number): Promise<string> {
    const batch = await this.findBatchById(id);
    const headers = [
      "Employee Code",
      "Employee Name",
      "Bank Name",
      "Account Number",
      "IFSC Code",
      "PAN Number",
      "Amount",
      "Payment Method",
      "Status",
      "Payment Reference",
    ];

    const lines = [headers.join(",")];

    for (const p of batch.payments) {
      const bank = p.employee.bankDetails;
      const row = [
        `"${p.employee.employeeCode}"`,
        `"${p.employee.fullName.replace(/"/g, '""')}"`,
        `"${bank?.bankName ?? ""}"`,
        `"${bank?.accountNumber ?? ""}"`,
        `"${bank?.ifscCode ?? ""}"`,
        `"${bank?.panNumber ?? ""}"`,
        p.amount.toString(),
        p.paymentMethod,
        p.status,
        `"${p.bankReference ?? ""}"`,
      ];
      lines.push(row.join(","));
    }

    return lines.join("\n");
  }

  async updatePayment(paymentId: number, dto: UpdatePaymentDto) {
    const scope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();
    const payment = await this.repository.findPaymentById(scope, paymentId);
    if (!payment) {
      throw new ResourceNotFoundException("Payroll payment", paymentId);
    }
    return this.repository.updatePayment(scope, paymentId, dto, userId);
  }
}
