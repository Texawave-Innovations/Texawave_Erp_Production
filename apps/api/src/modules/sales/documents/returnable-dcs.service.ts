import { Injectable } from "@nestjs/common";
import { parseDateOnly } from "../../../common/dates/date-only.js";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import {
  BusinessRuleConflictException,
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from "../../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import { CompanyProfileService } from "../master-list/company-profile.service.js";
import { DocumentDeliveryService } from "./document-delivery.service.js";
import { DocumentPricingService } from "./document-pricing.service.js";
import {
  customerSnapshot,
  pickDefined,
  todayDateOnly,
} from "./documents.rules.js";
import type { SendDocumentEmailDto } from "./dto/document-parts.dto.js";
import type {
  CreateReturnableDcDto,
  MarkReturnedDto,
  QueryReturnableDcDto,
  ReturnableLineDto,
  UpdateReturnableDcDto,
} from "./dto/returnable-dc.dto.js";
import { monthRange } from "./payments.rules.js";
import { printableReturnableDc } from "./printable.js";
import {
  type RdcLine,
  type ReturnableDcView,
  ReturnableDcsRepository,
} from "./returnable-dcs.repository.js";

/** The legacy screen's fixed returnable terms, used when none are entered. */
export function defaultReturnableTerms(companyName: string): string {
  return `The above items remain the property of ${companyName} and are issued on returnable basis. Please return goods on or before the expected return date in original working condition.`;
}

const toLines = (lines: readonly ReturnableLineDto[]): RdcLine[] =>
  lines.map((l, i) => ({
    lineNo: i + 1,
    description: l.description,
    quantity: l.quantity,
  }));

function assertReturnDate(issueDate: Date, expected: Date): void {
  if (expected < issueDate) {
    throw new BusinessRuleViolationException(
      "expectedReturnDate cannot be before issueDate",
      "RETURN_DATE_BEFORE_ISSUE_DATE",
    );
  }
}

function assertNotReturned(current: { status: string; rdcNumber: string }) {
  if (current.status === "RETURNED") {
    throw new BusinessRuleConflictException(
      `${current.rdcNumber} has been returned; reopen it to edit`,
      "RDC_RETURNED",
    );
  }
}

/**
 * Returnable delivery challans (TW/RDC/26-27/0001): goods lent to a
 * customer and expected back by a date. Numbered from the master list's
 * running numbers; seal, signature and prepared-by come from the master
 * list's RETURNABLE_DC fields; logo, name and address from the shared
 * company details.
 */
@Injectable()
export class ReturnableDcsService {
  constructor(
    private readonly repository: ReturnableDcsRepository,
    private readonly pricing: DocumentPricingService,
    private readonly companyProfile: CompanyProfileService,
    private readonly delivery: DocumentDeliveryService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async findAll(query: QueryReturnableDcDto) {
    const range = query.month
      ? monthRange(query.month)
      : query.date
        ? { from: parseDateOnly(query.date), to: parseDateOnly(query.date) }
        : undefined;
    const { items, total } = await this.repository.findMany(
      this.tenantContext.getOrgScope(),
      {
        search: query.search,
        customerId: query.customerId,
        status: query.status,
        from: range?.from,
        to: range?.to,
      },
      query,
      today(),
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  async findOne(id: number): Promise<ReturnableDcView> {
    const row = await this.repository.findOne(
      this.tenantContext.getOrgScope(),
      id,
      today(),
    );
    if (!row) throw new ResourceNotFoundException("Returnable DC", id);
    return row;
  }

  nextNumber(date: string | undefined) {
    return this.pricing.previewNumber(
      "returnable_dc",
      parseDateOnly(date ?? todayDateOnly()),
    );
  }

  async create(dto: CreateReturnableDcDto) {
    const [customer, company] = await Promise.all([
      this.pricing.customer(dto.customerId, { requireActive: true }),
      this.companyProfile.require(),
    ]);
    const issueDate = parseDateOnly(dto.issueDate);
    const expectedReturnDate = parseDateOnly(dto.expectedReturnDate);
    assertReturnDate(issueDate, expectedReturnDate);
    return this.repository.create(
      this.tenantContext.getOrgScope(),
      {
        customerId: customer.id,
        customerSnapshot: customerSnapshot(customer),
        issueDate,
        purpose: dto.purpose,
        expectedReturnDate,
        takenBy: dto.takenBy || null,
        ...(await this.pricing.signatories({
          sealItemId: dto.sealItemId ?? null,
          sealName: dto.sealName ?? null,
          signatureItemId: dto.signatureItemId ?? null,
          signatureName: dto.signatureName ?? null,
        })),
        preparedBy: dto.preparedBy || null,
        notes: dto.notes ?? defaultReturnableTerms(company.legalName),
        customFields: dto.customFields ?? {},
        lines: toLines(dto.lines),
      },
      await this.pricing.numberFor("returnable_dc", issueDate),
      this.tenantContext.getUserId(),
      today(),
    );
  }

  async update(id: number, dto: UpdateReturnableDcDto) {
    const current = await this.findOne(id);
    assertNotReturned(current);
    const customerChanged =
      dto.customerId !== undefined && dto.customerId !== current.customerId;
    const customer = await this.pricing.customer(
      dto.customerId ?? current.customerId,
      { requireActive: customerChanged },
    );
    const issueDate =
      dto.issueDate !== undefined
        ? parseDateOnly(dto.issueDate)
        : current.issueDate;
    const expectedReturnDate =
      dto.expectedReturnDate !== undefined
        ? parseDateOnly(dto.expectedReturnDate)
        : current.expectedReturnDate;
    assertReturnDate(issueDate, expectedReturnDate);
    const updated = await this.repository.update(
      this.tenantContext.getOrgScope(),
      id,
      {
        customerId: customer.id,
        customerSnapshot: customerSnapshot(customer),
        issueDate,
        purpose: dto.purpose ?? current.purpose,
        expectedReturnDate,
        takenBy: pickDefined(dto.takenBy, current.takenBy) || null,
        ...(await this.pricing.signatories({
          sealItemId: pickDefined(dto.sealItemId, current.sealItemId),
          sealName: pickDefined(dto.sealName, current.sealName),
          signatureItemId: pickDefined(
            dto.signatureItemId,
            current.signatureItemId,
          ),
          signatureName: pickDefined(dto.signatureName, current.signatureName),
        })),
        preparedBy: pickDefined(dto.preparedBy, current.preparedBy) || null,
        notes: pickDefined(dto.notes, current.notes),
        customFields:
          dto.customFields ?? (current.customFields as Record<string, unknown>),
        lines: dto.lines
          ? toLines(dto.lines)
          : current.lines.map((l) => ({
              lineNo: l.lineNo,
              description: l.description,
              quantity: l.quantity.toNumber(),
            })),
      },
      this.tenantContext.getUserId(),
      today(),
      assertNotReturned,
    );
    if (!updated) throw new ResourceNotFoundException("Returnable DC", id);
    return updated;
  }

  /** "Returned": the goods are back (default today). */
  async markReturned(id: number, dto: MarkReturnedDto) {
    const returnedDate = parseDateOnly(dto.returnedDate ?? todayDateOnly());
    const updated = await this.repository.setStatus(
      this.tenantContext.getOrgScope(),
      id,
      "RETURNED",
      returnedDate,
      this.tenantContext.getUserId(),
      today(),
      (current) => {
        assertNotReturned(current);
        if (returnedDate < current.issueDate) {
          throw new BusinessRuleViolationException(
            "returnedDate cannot be before issueDate",
            "RETURN_DATE_BEFORE_ISSUE_DATE",
          );
        }
      },
    );
    if (!updated) throw new ResourceNotFoundException("Returnable DC", id);
    return updated;
  }

  /** Undo "Returned" (marked by mistake): back to Issued (Pending Return). */
  async reopen(id: number) {
    const updated = await this.repository.setStatus(
      this.tenantContext.getOrgScope(),
      id,
      "ISSUED",
      null,
      this.tenantContext.getUserId(),
      today(),
      (current) => {
        if (current.status !== "RETURNED") {
          throw new BusinessRuleConflictException(
            `${current.rdcNumber} is not returned`,
            "RDC_NOT_RETURNED",
          );
        }
      },
    );
    if (!updated) throw new ResourceNotFoundException("Returnable DC", id);
    return updated;
  }

  async remove(id: number): Promise<void> {
    const deleted = await this.repository.softDelete(
      this.tenantContext.getOrgScope(),
      id,
      this.tenantContext.getUserId(),
    );
    if (!deleted) throw new ResourceNotFoundException("Returnable DC", id);
  }

  async pdf(id: number) {
    return this.delivery.pdf(await this.printable(id));
  }

  async email(id: number, dto: SendDocumentEmailDto) {
    return this.delivery.email(
      "sales_returnable_dc",
      id,
      await this.printable(id),
      dto,
    );
  }

  async whatsapp(id: number) {
    return this.delivery.whatsapp(
      "sales_returnable_dc",
      id,
      await this.printable(id),
    );
  }

  private async printable(id: number) {
    const [rdc, company] = await Promise.all([
      this.findOne(id),
      this.companyProfile.require(),
    ]);
    return this.delivery.withImages(printableReturnableDc(rdc, company), rdc);
  }
}

function today(): Date {
  return parseDateOnly(todayDateOnly());
}
