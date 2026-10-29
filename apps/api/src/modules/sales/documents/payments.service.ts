import { Injectable } from "@nestjs/common";
import { parseDateOnly } from "../../../common/dates/date-only.js";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from "../../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import { CompanyProfileService } from "../master-list/company-profile.service.js";
import { DocumentFieldsService } from "../master-list/document-fields.service.js";
import { DocumentDeliveryService } from "./document-delivery.service.js";
import { DocumentPricingService } from "./document-pricing.service.js";
import {
  customerSnapshot,
  pickDefined,
  todayDateOnly,
} from "./documents.rules.js";
import type {
  CreatePaymentDto,
  QueryPaymentDto,
  RecordPaymentDto,
  UpdatePaymentDto,
} from "./dto/payment.dto.js";
import {
  type PaymentData,
  type PaymentView,
  PaymentsRepository,
} from "./payments.repository.js";
import { modeLabel, monthRange } from "./payments.rules.js";
import { printablePaymentReceipt } from "./printable.js";

const optionalDate = (v: string | null | undefined) =>
  v === undefined ? undefined : v === null ? null : parseDateOnly(v);

/**
 * Payments Received: every payment against a proforma or tax invoice, with
 * its own number (TW/PR/26-27/0001, from the master list's running numbers),
 * mode (a master-list PAYMENT_MODE option, or typed), due date and receipt
 * PDF. "Record Payment" on an invoice goes through here too.
 */
@Injectable()
export class PaymentsService {
  constructor(
    private readonly repository: PaymentsRepository,
    private readonly pricing: DocumentPricingService,
    private readonly documentFields: DocumentFieldsService,
    private readonly companyProfile: CompanyProfileService,
    private readonly delivery: DocumentDeliveryService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async findAll(query: QueryPaymentDto) {
    const { items, total } = await this.repository.findMany(
      this.tenantContext.getOrgScope(),
      {
        search: query.search,
        customerId: query.customerId,
        invoiceId: query.invoiceId,
        paid: query.paymentMonth ? monthRange(query.paymentMonth) : undefined,
        due: query.dueMonth ? monthRange(query.dueMonth) : undefined,
        overdueOnly: query.overdueOnly,
      },
      query,
      today(),
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  async findOne(id: number): Promise<PaymentView> {
    const row = await this.repository.findOne(
      this.tenantContext.getOrgScope(),
      id,
      today(),
    );
    if (!row) throw new ResourceNotFoundException("Payment", id);
    return row;
  }

  alerts() {
    return this.repository.overdueSummary(
      this.tenantContext.getOrgScope(),
      today(),
    );
  }

  nextNumber(date: string | undefined) {
    return this.pricing.previewNumber(
      "payment_received",
      parseDateOnly(date ?? todayDateOnly()),
    );
  }

  create(dto: CreatePaymentDto) {
    return this.record(dto.invoiceId, dto);
  }

  /** A new payment against `invoiceId` (≤ its balance). */
  async record(invoiceId: number, dto: RecordPaymentDto) {
    const paymentDate = parseDateOnly(dto.paymentDate);
    const created = await this.repository.create(
      this.tenantContext.getOrgScope(),
      invoiceId,
      {
        amount: dto.amount,
        paymentDate,
        dueDate: optionalDate(dto.dueDate) ?? null,
        ...(await this.mode(dto.modeItemId ?? null, dto.mode)),
        reference: dto.reference ?? null,
        notes: dto.notes ?? null,
      },
      await this.pricing.numberFor("payment_received", paymentDate),
      this.tenantContext.getUserId(),
      today(),
    );
    if (!created) throw new ResourceNotFoundException("Invoice", invoiceId);
    return created;
  }

  async update(id: number, dto: UpdatePaymentDto) {
    const current = await this.findOne(id);
    const modeChanged = dto.modeItemId !== undefined || dto.mode !== undefined;
    const data: PaymentData = {
      amount: dto.amount ?? current.amount.toNumber(),
      paymentDate:
        dto.paymentDate !== undefined
          ? parseDateOnly(dto.paymentDate)
          : current.paymentDate,
      dueDate: pickDefined(optionalDate(dto.dueDate), current.dueDate),
      ...(modeChanged
        ? await this.mode(dto.modeItemId ?? null, dto.mode)
        : { mode: current.mode, modeItemId: current.modeItemId }),
      reference: pickDefined(dto.reference, current.reference),
      notes: pickDefined(dto.notes, current.notes),
    };
    const updated = await this.repository.update(
      this.tenantContext.getOrgScope(),
      id,
      data,
      this.tenantContext.getUserId(),
      today(),
    );
    if (!updated) throw new ResourceNotFoundException("Payment", id);
    return updated;
  }

  /** `invoiceId` set → the invoice route, which must own the payment. */
  async remove(id: number, invoiceId?: number): Promise<void> {
    const deleted = await this.repository.softDelete(
      this.tenantContext.getOrgScope(),
      id,
      this.tenantContext.getUserId(),
      invoiceId,
    );
    if (!deleted) {
      throw new ResourceNotFoundException(
        "Payment",
        invoiceId === undefined ? id : `${invoiceId}/${id}`,
      );
    }
  }

  /** The payment receipt PDF ("Download Receipt PDF"). */
  async receipt(id: number) {
    const payment = await this.findOne(id);
    const [company, customer] = await Promise.all([
      this.companyProfile.require(),
      this.pricing.customer(payment.customer.id, { requireActive: false }),
    ]);
    return this.delivery.pdf(
      await this.delivery.withImages(
        printablePaymentReceipt(payment, customerSnapshot(customer), company),
        { sealItemId: null, signatureItemId: null },
      ),
    );
  }

  /** A master-list option (its label is stored), else the typed mode. */
  private async mode(
    modeItemId: number | null,
    typed: string | undefined,
  ): Promise<{ mode: string; modeItemId: number | null }> {
    if (modeItemId !== null) {
      const option = await this.documentFields.resolveOption(
        modeItemId,
        "PAYMENT_MODE",
      );
      return { mode: option.label, modeItemId: option.id };
    }
    if (typed) return { mode: modeLabel(typed), modeItemId: null };
    throw new BusinessRuleViolationException(
      "Choose a payment mode (modeItemId) or type one (mode)",
      "PAYMENT_MODE_REQUIRED",
    );
  }
}

function today(): Date {
  return parseDateOnly(todayDateOnly());
}
