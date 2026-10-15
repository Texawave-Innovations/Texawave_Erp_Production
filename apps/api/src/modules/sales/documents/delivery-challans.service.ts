import { Injectable } from "@nestjs/common";
import { parseDateOnly } from "../../../common/dates/date-only.js";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from "../../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import { CompanyProfileService } from "../master-list/company-profile.service.js";
import {
  type DcLine,
  type DeliveryChallanView,
  DeliveryChallansRepository,
} from "./delivery-challans.repository.js";
import { DocumentDeliveryService } from "./document-delivery.service.js";
import { DocumentPricingService } from "./document-pricing.service.js";
import {
  customerSnapshot,
  pickDefined,
  todayDateOnly,
} from "./documents.rules.js";
import type {
  CreateDeliveryChallanDto,
  QueryDeliveryChallanDto,
  UpdateDeliveryChallanDto,
} from "./dto/delivery-challan.dto.js";
import type {
  DispatchLineDto,
  SendDocumentEmailDto,
} from "./dto/document-parts.dto.js";
import type { ConvertToDeliveryChallanDto } from "./dto/invoice.dto.js";
import { InvoicesService } from "./invoices.service.js";
import { printableDeliveryChallan } from "./printable.js";

const optionalDate = (v: string | undefined) =>
  v === undefined ? undefined : parseDateOnly(v);

const toLines = (lines: readonly DispatchLineDto[]): DcLine[] =>
  lines.map((l, i) => ({
    lineNo: i + 1,
    description: l.description,
    hsnCode: l.hsnCode ?? null,
    quantity: l.quantity,
  }));

/** The legacy screen's fixed note, used when none is entered. */
export const DEFAULT_DC_NOTE =
  "Goods dispatched via this Delivery Challan are for delivery/transit purposes only and carry no commercial sale value.";

@Injectable()
export class DeliveryChallansService {
  constructor(
    private readonly repository: DeliveryChallansRepository,
    private readonly invoices: InvoicesService,
    private readonly pricing: DocumentPricingService,
    private readonly companyProfile: CompanyProfileService,
    private readonly delivery: DocumentDeliveryService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async findAll(query: QueryDeliveryChallanDto) {
    const { items, total } = await this.repository.findMany(
      this.tenantContext.getOrgScope(),
      {
        search: query.search,
        customerId: query.customerId,
        status: query.status,
        from: optionalDate(query.from),
        to: optionalDate(query.to),
      },
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  async findOne(id: number): Promise<DeliveryChallanView> {
    const row = await this.repository.findOne(
      this.tenantContext.getOrgScope(),
      id,
    );
    if (!row) throw new ResourceNotFoundException("Delivery challan", id);
    return row;
  }

  nextNumber(date: string | undefined) {
    return this.pricing.previewNumber(
      "delivery_challan",
      parseDateOnly(date ?? todayDateOnly()),
    );
  }

  async create(dto: CreateDeliveryChallanDto) {
    const customer = await this.pricing.customer(dto.customerId, {
      requireActive: true,
    });
    const dcDate = parseDateOnly(dto.dcDate);
    return this.repository.create(
      this.tenantContext.getOrgScope(),
      {
        customerId: customer.id,
        customerSnapshot: customerSnapshot(customer),
        dcDate,
        status: dto.status ?? "DRAFT",
        sealName: dto.sealName ?? null,
        signatureName: dto.signatureName ?? null,
        preparedBy: dto.preparedBy ?? null,
        notes: dto.notes ?? DEFAULT_DC_NOTE,
        customFields: dto.customFields ?? {},
        lines: toLines(dto.lines),
      },
      await this.pricing.numberFor("delivery_challan", dcDate),
      this.tenantContext.getUserId(),
    );
  }

  /** Tax invoice → delivery challan: same customer and items, no prices. */
  async createFromInvoice(invoiceId: number, dto: ConvertToDeliveryChallanDto) {
    const invoice = await this.invoices.findOne(invoiceId);
    if (invoice.invoiceType !== "TAX") {
      throw new BusinessRuleViolationException(
        `${invoice.invoiceNumber} is a proforma; only a tax invoice moves to a delivery challan`,
        "NOT_A_TAX_INVOICE",
      );
    }
    const customer = await this.pricing.customer(invoice.customerId, {
      requireActive: true,
    });
    const dcDate = parseDateOnly(dto.dcDate ?? todayDateOnly());
    const created = await this.repository.create(
      this.tenantContext.getOrgScope(),
      {
        customerId: customer.id,
        customerSnapshot: customerSnapshot(customer),
        dcDate,
        status: "DRAFT",
        sealName: invoice.sealName,
        signatureName: invoice.signatureName,
        preparedBy: invoice.preparedBy,
        notes: DEFAULT_DC_NOTE,
        customFields: {},
        lines: invoice.lines.map((l) => ({
          lineNo: l.lineNo,
          description: l.description,
          hsnCode: l.hsnCode,
          quantity: l.quantity.toNumber(),
        })),
      },
      await this.pricing.numberFor("delivery_challan", dcDate),
      this.tenantContext.getUserId(),
      invoiceId,
    );
    if (!created) throw new ResourceNotFoundException("Invoice", invoiceId);
    return created;
  }

  async update(id: number, dto: UpdateDeliveryChallanDto) {
    const current = await this.findOne(id);
    const customerChanged =
      dto.customerId !== undefined && dto.customerId !== current.customerId;
    const customer = await this.pricing.customer(
      dto.customerId ?? current.customerId,
      { requireActive: customerChanged },
    );
    const updated = await this.repository.update(
      this.tenantContext.getOrgScope(),
      id,
      {
        customerId: customer.id,
        customerSnapshot: customerSnapshot(customer),
        dcDate:
          dto.dcDate !== undefined ? parseDateOnly(dto.dcDate) : current.dcDate,
        status: dto.status ?? (current.status as "DRAFT" | "DISPATCHED"),
        sealName: pickDefined(dto.sealName, current.sealName),
        signatureName: pickDefined(dto.signatureName, current.signatureName),
        preparedBy: pickDefined(dto.preparedBy, current.preparedBy),
        notes: pickDefined(dto.notes, current.notes),
        customFields:
          dto.customFields ?? (current.customFields as Record<string, unknown>),
        lines: dto.lines
          ? toLines(dto.lines)
          : current.lines.map((l) => ({
              lineNo: l.lineNo,
              description: l.description,
              hsnCode: l.hsnCode,
              quantity: l.quantity.toNumber(),
            })),
      },
      this.tenantContext.getUserId(),
    );
    if (!updated) throw new ResourceNotFoundException("Delivery challan", id);
    return updated;
  }

  async remove(id: number): Promise<void> {
    const deleted = await this.repository.softDelete(
      this.tenantContext.getOrgScope(),
      id,
      this.tenantContext.getUserId(),
    );
    if (!deleted) throw new ResourceNotFoundException("Delivery challan", id);
  }

  async pdf(id: number) {
    return this.delivery.pdf(await this.printable(id));
  }

  async email(id: number, dto: SendDocumentEmailDto) {
    return this.delivery.email(
      "sales_delivery_challan",
      id,
      await this.printable(id),
      dto,
    );
  }

  async whatsapp(id: number) {
    return this.delivery.whatsapp(
      "sales_delivery_challan",
      id,
      await this.printable(id),
    );
  }

  private async printable(id: number) {
    const [dc, company] = await Promise.all([
      this.findOne(id),
      this.companyProfile.require(),
    ]);
    return printableDeliveryChallan(dc, company);
  }
}
