import { Injectable } from "@nestjs/common";
import { parseDateOnly } from "../../../common/dates/date-only.js";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from "../../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import { CompanyProfileService } from "../master-list/company-profile.service.js";
import { DocumentDeliveryService } from "./document-delivery.service.js";
import {
  DocumentPricingService,
  draftFromDto,
  draftFromStored,
  mergeDraft,
} from "./document-pricing.service.js";
import { pickDefined, storedRates, todayDateOnly } from "./documents.rules.js";
import type { SendDocumentEmailDto } from "./dto/document-parts.dto.js";
import type {
  ConvertQuotationDto,
  ConvertToTaxInvoiceDto,
  CreateInvoiceDto,
  InvoiceType,
  QueryInvoiceDto,
  RecordPaymentDto,
  UpdateInvoiceDto,
} from "./dto/invoice.dto.js";
import { type InvoiceView, InvoicesRepository } from "./invoices.repository.js";
import { printableInvoice } from "./printable.js";
import { QuotationsService } from "./quotations.service.js";

const optionalDate = (v: string | undefined) =>
  v === undefined ? undefined : parseDateOnly(v);

const codeType = (t: InvoiceType) =>
  t === "PROFORMA" ? "proforma_invoice" : "tax_invoice";

function assertDueDate(invoiceDate: Date, dueDate: Date | null): void {
  if (dueDate && dueDate < invoiceDate) {
    throw new BusinessRuleViolationException(
      "dueDate cannot be before invoiceDate",
      "DUE_DATE_BEFORE_INVOICE_DATE",
    );
  }
}

@Injectable()
export class InvoicesService {
  constructor(
    private readonly repository: InvoicesRepository,
    private readonly quotations: QuotationsService,
    private readonly pricing: DocumentPricingService,
    private readonly companyProfile: CompanyProfileService,
    private readonly delivery: DocumentDeliveryService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async findAll(query: QueryInvoiceDto) {
    const { items, total } = await this.repository.findMany(
      this.tenantContext.getOrgScope(),
      {
        search: query.search,
        customerId: query.customerId,
        invoiceType: query.invoiceType,
        status: query.status,
        from: optionalDate(query.from),
        to: optionalDate(query.to),
      },
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  async findOne(id: number): Promise<InvoiceView> {
    const row = await this.repository.findOne(
      this.tenantContext.getOrgScope(),
      id,
    );
    if (!row) throw new ResourceNotFoundException("Invoice", id);
    return row;
  }

  nextNumber(invoiceType: InvoiceType, date: string | undefined) {
    return this.pricing.previewNumber(
      codeType(invoiceType),
      parseDateOnly(date ?? todayDateOnly()),
    );
  }

  async create(dto: CreateInvoiceDto) {
    const data = await this.pricing.resolve(draftFromDto(dto), {
      requireActiveCustomer: true,
    });
    const invoiceDate = parseDateOnly(dto.invoiceDate);
    const dueDate = dto.dueDate ? parseDateOnly(dto.dueDate) : null;
    assertDueDate(invoiceDate, dueDate);
    return this.repository.create(
      this.tenantContext.getOrgScope(),
      dto.invoiceType,
      {
        ...data,
        invoiceDate,
        dueDate,
        paymentTerms: dto.paymentTerms ?? null,
      },
      await this.pricing.numberFor(codeType(dto.invoiceType), invoiceDate),
      this.tenantContext.getUserId(),
    );
  }

  async update(id: number, dto: UpdateInvoiceDto) {
    const current = await this.findOne(id);
    const draft = mergeDraft(
      draftFromStored(current, storedRates(current)),
      dto,
    );
    const data = await this.pricing.resolve(draft, {
      requireActiveCustomer: draft.customerId !== current.customerId,
    });
    const invoiceDate =
      dto.invoiceDate !== undefined
        ? parseDateOnly(dto.invoiceDate)
        : current.invoiceDate;
    const dueDate =
      dto.dueDate !== undefined
        ? dto.dueDate === null
          ? null
          : parseDateOnly(dto.dueDate)
        : current.dueDate;
    assertDueDate(invoiceDate, dueDate);
    const updated = await this.repository.update(
      this.tenantContext.getOrgScope(),
      id,
      {
        ...data,
        invoiceDate,
        dueDate,
        paymentTerms: pickDefined(dto.paymentTerms, current.paymentTerms),
      },
      this.tenantContext.getUserId(),
    );
    if (!updated) throw new ResourceNotFoundException("Invoice", id);
    return updated;
  }

  async remove(id: number): Promise<void> {
    const deleted = await this.repository.softDelete(
      this.tenantContext.getOrgScope(),
      id,
      this.tenantContext.getUserId(),
    );
    if (!deleted) throw new ResourceNotFoundException("Invoice", id);
  }

  /** Quotation → proforma (default) or tax invoice: same customer, lines,
   * charges and rates, re-priced for today's customer; terms are left for
   * the invoice's own declaration. */
  async createFromQuotation(quotationId: number, dto: ConvertQuotationDto) {
    const quotation = await this.quotations.findOne(quotationId);
    const invoiceType = dto.invoiceType ?? "PROFORMA";
    const draft = draftFromStored(quotation, storedRates(quotation));
    const data = await this.pricing.resolve(
      { ...draft, terms: null },
      { requireActiveCustomer: true },
    );
    const invoiceDate = parseDateOnly(dto.invoiceDate ?? todayDateOnly());
    const created = await this.repository.createFromQuotation(
      this.tenantContext.getOrgScope(),
      quotationId,
      invoiceType,
      { ...data, invoiceDate, dueDate: null, paymentTerms: null },
      await this.pricing.numberFor(codeType(invoiceType), invoiceDate),
      this.tenantContext.getUserId(),
    );
    if (!created) throw new ResourceNotFoundException("Quotation", quotationId);
    return created;
  }

  /** Proforma → tax invoice ("Move to Tax Invoice"). Payments move along. */
  async convertToTax(proformaId: number, dto: ConvertToTaxInvoiceDto) {
    const pi = await this.findOne(proformaId);
    if (pi.invoiceType !== "PROFORMA") {
      throw new BusinessRuleViolationException(
        `${pi.invoiceNumber} is already a tax invoice`,
        "NOT_A_PROFORMA",
      );
    }
    const data = await this.pricing.resolve(
      { ...draftFromStored(pi, storedRates(pi)), terms: null },
      { requireActiveCustomer: true },
    );
    const invoiceDate = parseDateOnly(dto.invoiceDate ?? todayDateOnly());
    const created = await this.repository.convertProforma(
      this.tenantContext.getOrgScope(),
      proformaId,
      {
        ...data,
        invoiceDate,
        dueDate: null,
        paymentTerms: pi.paymentTerms,
      },
      await this.pricing.numberFor("tax_invoice", invoiceDate),
      this.tenantContext.getUserId(),
    );
    if (!created) throw new ResourceNotFoundException("Invoice", proformaId);
    return created;
  }

  async recordPayment(id: number, dto: RecordPaymentDto) {
    const updated = await this.repository.recordPayment(
      this.tenantContext.getOrgScope(),
      id,
      {
        amount: dto.amount,
        paymentDate: parseDateOnly(dto.paymentDate),
        mode: dto.mode,
        reference: dto.reference ?? null,
        notes: dto.notes ?? null,
      },
      this.tenantContext.getUserId(),
    );
    if (!updated) throw new ResourceNotFoundException("Invoice", id);
    return updated;
  }

  async deletePayment(id: number, paymentId: number) {
    const updated = await this.repository.deletePayment(
      this.tenantContext.getOrgScope(),
      id,
      paymentId,
      this.tenantContext.getUserId(),
    );
    if (!updated) {
      throw new ResourceNotFoundException("Payment", `${id}/${paymentId}`);
    }
    return updated;
  }

  async pdf(id: number) {
    return this.delivery.pdf(await this.printable(id));
  }

  async email(id: number, dto: SendDocumentEmailDto) {
    return this.delivery.email(
      "sales_invoice",
      id,
      await this.printable(id),
      dto,
    );
  }

  async whatsapp(id: number) {
    return this.delivery.whatsapp(
      "sales_invoice",
      id,
      await this.printable(id),
    );
  }

  private async printable(id: number) {
    const [invoice, company] = await Promise.all([
      this.findOne(id),
      this.companyProfile.require(),
    ]);
    return printableInvoice(invoice, company);
  }
}
