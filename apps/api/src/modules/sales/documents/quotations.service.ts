import { Injectable } from "@nestjs/common";
import { parseDateOnly } from "../../../common/dates/date-only.js";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import { ResourceNotFoundException } from "../../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import { CompanyProfileService } from "../master-list/company-profile.service.js";
import { DocumentDeliveryService } from "./document-delivery.service.js";
import { previewTotals, printableFromData } from "./document-preview.js";
import type { DocumentData } from "./document-repository.helpers.js";
import {
  DocumentPricingService,
  draftFromDto,
  draftFromStored,
  mergeDraft,
} from "./document-pricing.service.js";
import { pickDefined, storedRates, todayDateOnly } from "./documents.rules.js";
import type { SendDocumentEmailDto } from "./dto/document-parts.dto.js";
import type {
  CreateQuotationDto,
  QueryQuotationDto,
  UpdateQuotationDto,
} from "./dto/quotation.dto.js";
import { printableQuotation } from "./printable.js";
import {
  type QuotationView,
  QuotationsRepository,
} from "./quotations.repository.js";

const optionalDate = (v: string | undefined) =>
  v === undefined ? undefined : parseDateOnly(v);

@Injectable()
export class QuotationsService {
  constructor(
    private readonly repository: QuotationsRepository,
    private readonly pricing: DocumentPricingService,
    private readonly companyProfile: CompanyProfileService,
    private readonly delivery: DocumentDeliveryService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async findAll(query: QueryQuotationDto) {
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

  async findOne(id: number): Promise<QuotationView> {
    const row = await this.repository.findOne(
      this.tenantContext.getOrgScope(),
      id,
    );
    if (!row) throw new ResourceNotFoundException("Quotation", id);
    return row;
  }

  /** Preview of the next number for a date (not reserved). */
  nextNumber(date: string | undefined) {
    return this.pricing.previewNumber(
      "quotation",
      parseDateOnly(date ?? todayDateOnly()),
    );
  }

  async create(dto: CreateQuotationDto) {
    const data = await this.pricing.resolve(draftFromDto(dto), {
      requireActiveCustomer: true,
    });
    const quotationDate = parseDateOnly(dto.quotationDate);
    return this.repository.create(
      this.tenantContext.getOrgScope(),
      {
        ...data,
        quotationDate,
        validity: dto.validity ?? null,
        deliveryTerms: dto.deliveryTerms ?? null,
      },
      await this.pricing.numberFor("quotation", quotationDate),
      this.tenantContext.getUserId(),
    );
  }

  async update(id: number, dto: UpdateQuotationDto) {
    const current = await this.findOne(id);
    const draft = mergeDraft(
      draftFromStored(current, storedRates(current)),
      dto,
    );
    const data = await this.pricing.resolve(draft, {
      // Re-pointing to another customer needs an active one; editing a
      // document of a since-deactivated customer is still allowed.
      requireActiveCustomer: draft.customerId !== current.customerId,
    });
    const updated = await this.repository.update(
      this.tenantContext.getOrgScope(),
      id,
      {
        ...data,
        quotationDate:
          dto.quotationDate !== undefined
            ? parseDateOnly(dto.quotationDate)
            : current.quotationDate,
        validity: pickDefined(dto.validity, current.validity),
        deliveryTerms: pickDefined(dto.deliveryTerms, current.deliveryTerms),
      },
      this.tenantContext.getUserId(),
    );
    if (!updated) throw new ResourceNotFoundException("Quotation", id);
    return updated;
  }

  /**
   * Live preview of a quotation that is not saved yet: the same pricing as
   * create(), rendered with the same template as the PDF. Nothing is
   * stored and no number is reserved (the number shown is the next one).
   */
  async preview(dto: CreateQuotationDto) {
    const data = await this.pricing.resolve(draftFromDto(dto), {
      requireActiveCustomer: true,
    });
    const quotationDate = parseDateOnly(dto.quotationDate);
    const { number } = await this.pricing.previewNumber(
      "quotation",
      quotationDate,
    );
    return this.render(data, {
      quotationNumber: number,
      quotationDate,
      validity: dto.validity ?? null,
    });
  }

  /** Live preview of edits to a saved quotation (same merge as update()). */
  async previewUpdate(id: number, dto: UpdateQuotationDto) {
    const current = await this.findOne(id);
    const draft = mergeDraft(
      draftFromStored(current, storedRates(current)),
      dto,
    );
    const data = await this.pricing.resolve(draft, {
      requireActiveCustomer: draft.customerId !== current.customerId,
    });
    return this.render(data, {
      quotationNumber: current.quotationNumber,
      quotationDate:
        dto.quotationDate !== undefined
          ? parseDateOnly(dto.quotationDate)
          : current.quotationDate,
      validity: pickDefined(dto.validity, current.validity),
    });
  }

  private async render(
    data: DocumentData,
    meta: {
      quotationNumber: string;
      quotationDate: Date;
      validity: string | null;
    },
  ) {
    const company = await this.companyProfile.require();
    const doc = await this.delivery.withImages(
      printableQuotation({ ...printableFromData(data), ...meta }, company),
      data,
    );
    return {
      number: meta.quotationNumber,
      html: this.delivery.html(doc),
      totals: previewTotals(data),
    };
  }

  async remove(id: number): Promise<void> {
    const deleted = await this.repository.softDelete(
      this.tenantContext.getOrgScope(),
      id,
      this.tenantContext.getUserId(),
    );
    if (!deleted) throw new ResourceNotFoundException("Quotation", id);
  }

  async pdf(id: number) {
    return this.delivery.pdf(await this.printable(id));
  }

  async email(id: number, dto: SendDocumentEmailDto) {
    return this.delivery.email(
      "sales_quotation",
      id,
      await this.printable(id),
      dto,
    );
  }

  async whatsapp(id: number) {
    return this.delivery.whatsapp(
      "sales_quotation",
      id,
      await this.printable(id),
    );
  }

  private async printable(id: number) {
    const [quotation, company] = await Promise.all([
      this.findOne(id),
      this.companyProfile.require(),
    ]);
    return this.delivery.withImages(
      printableQuotation(quotation, company),
      quotation,
    );
  }
}
