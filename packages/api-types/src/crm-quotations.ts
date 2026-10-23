// HANDWRITTEN — mirrors apps/api/src/modules/crm/quotations/. Migrated
// from the LIVE legacy TexaWave_ERP/src/modules/crm/QuoteForm.tsx +
// Quotes.tsx + domain/quotationsService.ts. See
// packages/api-types/README.md.

import type { Account } from "./crm-accounts.js";
import type { Contact } from "./crm-contacts.js";
import type { Opportunity } from "./crm-opportunities.js";

export const QUOTATION_STATUSES = [
  "Draft",
  "Sent",
  "Accepted",
  "Rejected",
  "Expired",
] as const;
export type QuotationStatus = (typeof QUOTATION_STATUSES)[number];

/** A line may have no catalog product at all (free text) — `productId`
 * is nullable. `unitPrice` is a genuine, independently editable manual
 * override, NOT frozen the way `OpportunityProduct.unitPrice` is; only
 * `listPrice` (the catalog reference) and `productCode` are frozen
 * snapshots. See Docs/CRM_QUOTES_LEGACY_PARITY.md §1.3/§3. */
export interface QuotationLineItem {
  id: number;
  quotationId: number;
  productId: number | null;
  product: { id: number; code: string; isActive: boolean } | null;
  productCode: string | null;
  description: string;
  uom: string | null;
  quantity: string;
  listPrice: string;
  unitPrice: string;
  discountPercent: string | null;
  discountAmount: string | null;
  taxPercent: string | null;
  taxAmount: string | null;
  amount: string;
  lineOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Quotation {
  id: number;
  organizationId: number;
  accountId: number;
  account: Pick<Account, "id" | "name">;
  opportunityId: number | null;
  opportunity: Pick<Opportunity, "id" | "title" | "opportunityNumber"> | null;
  contactId: number | null;
  contact: Pick<Contact, "id" | "name"> | null;
  quotationNumber: string;
  subject: string;
  status: QuotationStatus;
  quoteOwner: string | null;
  currency: string | null;
  quoteDate: string | null;
  validUntil: string | null;
  customerReference: string | null;
  billingStreet: string | null;
  billingCity: string | null;
  billingState: string | null;
  billingPostalCode: string | null;
  billingCountry: string | null;
  shippingStreet: string | null;
  shippingCity: string | null;
  shippingState: string | null;
  shippingPostalCode: string | null;
  shippingCountry: string | null;
  carrier: string | null;
  deliveryNotes: string | null;
  termsConditions: string | null;
  paymentTerms: string | null;
  deliveryTerms: string | null;
  notes: string | null;
  subtotal: string;
  totalDiscount: string;
  totalTax: string;
  adjustment: string;
  grandTotal: string;
  lineItems: QuotationLineItem[];
  isActive: boolean;
  createdBy: number | null;
  updatedBy: number | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface QuotationLineItemInput {
  productId?: number | undefined;
  description: string;
  uom?: string | undefined;
  quantity: number;
  unitPrice: number;
  discountPercent?: number | undefined;
  taxPercent?: number | undefined;
}

/** Shared shape for both create (`POST`) and full replace-all update
 * (`PUT`) — approved decision D2. There is no partial-update input type;
 * every save always submits the complete header and the complete line
 * item array together. `subtotal`/`totalDiscount`/`totalTax`/
 * `grandTotal` are deliberately absent — they are NEVER client-supplied
 * (approved decision D4). */
export interface QuotationPayloadInput {
  accountId: number;
  opportunityId?: number | undefined;
  contactId?: number | undefined;
  subject: string;
  status?: QuotationStatus | undefined;
  quoteOwner?: string | undefined;
  currency?: string | undefined;
  quoteDate?: string | undefined;
  validUntil: string;
  customerReference?: string | undefined;
  billingStreet?: string | undefined;
  billingCity?: string | undefined;
  billingState?: string | undefined;
  billingPostalCode?: string | undefined;
  billingCountry?: string | undefined;
  shippingStreet?: string | undefined;
  shippingCity?: string | undefined;
  shippingState?: string | undefined;
  shippingPostalCode?: string | undefined;
  shippingCountry?: string | undefined;
  carrier?: string | undefined;
  deliveryNotes?: string | undefined;
  termsConditions?: string | undefined;
  paymentTerms?: string | undefined;
  deliveryTerms?: string | undefined;
  notes?: string | undefined;
  adjustment?: number | undefined;
  items: QuotationLineItemInput[];
}

export interface QueryQuotationsInput {
  page?: number | undefined;
  limit?: number | undefined;
  order?: ("asc" | "desc") | undefined;
  q?: string | undefined;
  status?: QuotationStatus | undefined;
  accountId?: number | undefined;
  opportunityId?: number | undefined;
}
