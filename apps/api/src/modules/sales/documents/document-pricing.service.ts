import { Injectable } from "@nestjs/common";
import type { Prisma } from "@texawave-erp/database";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import { CustomersService } from "../customers/customers.service.js";
import {
  type DocumentCodeType,
  fiscalYearLabel,
} from "../master-list/code-formats.rules.js";
import { CodeFormatsService } from "../master-list/code-formats.service.js";
import { CompanyProfileService } from "../master-list/company-profile.service.js";
import { DocumentFieldsService } from "../master-list/document-fields.service.js";
import { DocumentNumbersRepository } from "./document-numbers.repository.js";
import type { RateSet } from "./document-totals.js";
import type {
  BankDetails,
  DocumentData,
} from "./document-repository.helpers.js";
import {
  assertCustomerActive,
  type CustomerForDocument,
  customerSnapshot,
  placeOfSupplyFor,
  pickDefined,
  price,
  type PricingInput,
} from "./documents.rules.js";
import type { PricedDocumentDto } from "./dto/document-parts.dto.js";

/** Every priced field after merging the request with the stored document
 * (on update) — what `resolve()` prices. */
export interface PricedDraft extends PricingInput {
  customerId: number;
  placeOfSupply: string | null;
  transportDescription: string | null;
  transportHsn: string | null;
  bankDetails: BankDetails | null;
  sealName: string | null;
  signatureName: string | null;
  sealItemId: number | null;
  signatureItemId: number | null;
  preparedBy: string | null;
  terms: string | null;
  customFields: Record<string, unknown>;
}

/** The seal / signature a document prints: a master-list option (its label
 * becomes the name, its image is printed) or a free-text name. */
export interface Signatories {
  sealItemId: number | null;
  sealName: string | null;
  signatureItemId: number | null;
  signatureName: string | null;
}

/** A stored quotation/invoice, as the draft of an update or conversion. */
export interface StoredPricedDocument {
  customerId: number;
  placeOfSupply: string;
  taxMode: string;
  cgstRate: Prisma.Decimal;
  sgstRate: Prisma.Decimal;
  igstRate: Prisma.Decimal;
  transportDescription: string | null;
  transportCharge: Prisma.Decimal;
  transportHsn: string | null;
  bankDetails: unknown;
  sealName: string | null;
  signatureName: string | null;
  sealItemId: number | null;
  signatureItemId: number | null;
  preparedBy: string | null;
  terms: string | null;
  customFields: unknown;
  lines: Array<{
    description: string;
    hsnCode: string | null;
    quantity: Prisma.Decimal;
    unitPrice: Prisma.Decimal;
  }>;
}

/**
 * Turns a draft into the columns a quotation or invoice stores: reads the
 * customer (CustomersService) and the company profile (master list),
 * freezes the customer snapshot, decides the tax mode and prices it.
 */
@Injectable()
export class DocumentPricingService {
  constructor(
    private readonly customers: CustomersService,
    private readonly companyProfile: CompanyProfileService,
    private readonly codeFormats: CodeFormatsService,
    private readonly documentFields: DocumentFieldsService,
    private readonly numbers: DocumentNumbersRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async customer(
    id: number,
    opts: { requireActive: boolean },
  ): Promise<CustomerForDocument> {
    const customer: CustomerForDocument = await this.customers.findOne(id);
    if (opts.requireActive) assertCustomerActive(customer);
    return customer;
  }

  /** Checks chosen seal / signature options and takes their labels. */
  async signatories(input: Signatories): Promise<Signatories> {
    const [seal, signature] = await Promise.all([
      input.sealItemId === null
        ? null
        : this.documentFields.resolveOption(input.sealItemId, "COMPANY_SEAL"),
      input.signatureItemId === null
        ? null
        : this.documentFields.resolveOption(
            input.signatureItemId,
            "AUTHORIZED_SIGNATURE",
          ),
    ]);
    return {
      sealItemId: seal?.id ?? null,
      sealName: seal?.label ?? input.sealName,
      signatureItemId: signature?.id ?? null,
      signatureName: signature?.label ?? input.signatureName,
    };
  }

  /** The draft's priced columns. `placeOfSupply` null = the customer's. */
  async resolve(
    draft: PricedDraft,
    opts: { requireActiveCustomer: boolean },
  ): Promise<DocumentData> {
    const [customer, company, signatories] = await Promise.all([
      this.customer(draft.customerId, {
        requireActive: opts.requireActiveCustomer,
      }),
      this.companyProfile.require(),
      this.signatories(draft),
    ]);
    const placeOfSupply = placeOfSupplyFor(customer, draft.placeOfSupply);
    const { columns, lines } = price(
      draft,
      customer,
      company.stateCode,
      placeOfSupply,
    );
    return {
      ...columns,
      customerId: customer.id,
      customerSnapshot: customerSnapshot(customer),
      transportDescription: draft.transportDescription,
      transportHsn: draft.transportHsn,
      bankDetails: draft.bankDetails,
      ...signatories,
      preparedBy: draft.preparedBy,
      terms: draft.terms,
      customFields: draft.customFields,
      lines,
    };
  }

  /** Preview of the number a new document dated `date` will get. */
  async previewNumber(codeType: DocumentCodeType, date: Date) {
    const spec = await this.numberFor(codeType, date);
    return {
      number: await this.numbers.peek(
        this.tenantContext.getOrgScope(),
        codeType,
        spec.format,
        spec.fiscalYear,
      ),
      fiscalYear: spec.fiscalYear,
    };
  }

  /** The number spec for a new document of `codeType` dated `date`. */
  async numberFor(codeType: DocumentCodeType, date: Date) {
    return {
      format: await this.codeFormats.getFormat(codeType),
      fiscalYear: fiscalYearLabel(date),
    };
  }
}

/** A stored document as a draft: its own lines, charges and rates (the
 * rates of its tax mode — see `storedRates`). */
export function draftFromStored(
  doc: StoredPricedDocument,
  rates: RateSet,
): PricedDraft {
  return {
    customerId: doc.customerId,
    placeOfSupply: doc.placeOfSupply,
    lines: doc.lines.map((l) => ({
      description: l.description,
      hsnCode: l.hsnCode,
      quantity: l.quantity.toNumber(),
      unitPrice: l.unitPrice.toNumber(),
    })),
    transportCharge: doc.transportCharge.toNumber(),
    rates,
    transportDescription: doc.transportDescription,
    transportHsn: doc.transportHsn,
    bankDetails: (doc.bankDetails ?? null) as BankDetails | null,
    sealName: doc.sealName,
    signatureName: doc.signatureName,
    sealItemId: doc.sealItemId,
    signatureItemId: doc.signatureItemId,
    preparedBy: doc.preparedBy,
    terms: doc.terms,
    customFields: (doc.customFields ?? {}) as Record<string, unknown>,
  };
}

/** A create request as a draft (nothing stored yet). */
export function draftFromDto(dto: PricedDocumentDto): PricedDraft {
  return {
    customerId: dto.customerId,
    placeOfSupply: dto.placeOfSupply ?? null,
    lines: dto.lines,
    transportCharge: dto.transportCharge ?? 0,
    rates: {
      cgstRate: dto.cgstRate ?? null,
      sgstRate: dto.sgstRate ?? null,
      igstRate: dto.igstRate ?? null,
    },
    transportDescription: dto.transportDescription ?? null,
    transportHsn: dto.transportHsn ?? null,
    bankDetails: dto.bankDetails ?? null,
    sealName: dto.sealName ?? null,
    signatureName: dto.signatureName ?? null,
    sealItemId: dto.sealItemId ?? null,
    signatureItemId: dto.signatureItemId ?? null,
    preparedBy: dto.preparedBy ?? null,
    terms: dto.terms ?? null,
    customFields: dto.customFields ?? {},
  };
}

/**
 * An update request over a stored draft: `undefined` keeps the stored
 * value, `null` clears it. A new customer re-derives the place of supply
 * unless one is sent.
 */
export function mergeDraft(
  stored: PricedDraft,
  dto: Partial<PricedDocumentDto>,
): PricedDraft {
  const customerChanged =
    dto.customerId !== undefined && dto.customerId !== stored.customerId;
  return {
    customerId: dto.customerId ?? stored.customerId,
    placeOfSupply:
      dto.placeOfSupply !== undefined
        ? dto.placeOfSupply
        : customerChanged
          ? null
          : stored.placeOfSupply,
    lines: dto.lines ?? stored.lines,
    transportCharge: dto.transportCharge ?? stored.transportCharge,
    rates: {
      cgstRate: pickDefined(dto.cgstRate, stored.rates.cgstRate),
      sgstRate: pickDefined(dto.sgstRate, stored.rates.sgstRate),
      igstRate: pickDefined(dto.igstRate, stored.rates.igstRate),
    },
    transportDescription: pickDefined(
      dto.transportDescription,
      stored.transportDescription,
    ),
    transportHsn: pickDefined(dto.transportHsn, stored.transportHsn),
    bankDetails: pickDefined(dto.bankDetails, stored.bankDetails),
    sealName: pickDefined(dto.sealName, stored.sealName),
    signatureName: pickDefined(dto.signatureName, stored.signatureName),
    sealItemId: pickDefined(dto.sealItemId, stored.sealItemId),
    signatureItemId: pickDefined(dto.signatureItemId, stored.signatureItemId),
    preparedBy: pickDefined(dto.preparedBy, stored.preparedBy),
    terms: pickDefined(dto.terms, stored.terms),
    customFields: dto.customFields ?? stored.customFields,
  };
}
