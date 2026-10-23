import { z } from "zod";

/** Shared client-side validation for CRM Quotations — mirrors
 * apps/api/src/modules/crm/quotations/dto/quotation.dto.ts. There is
 * deliberately no partial "update" schema — every save submits the full
 * header and the full line-item array together (approved decision D2,
 * Docs/CRM_QUOTES_LEGACY_PARITY.md §2.4/§6). `subtotal`/`totalDiscount`/
 * `totalTax`/`grandTotal` are intentionally absent — never
 * client-computed-and-trusted (approved decision D4). */
export const QUOTATION_STATUSES = [
  "Draft",
  "Sent",
  "Accepted",
  "Rejected",
  "Expired",
] as const;

const optionalString = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal(""));

export const quotationLineItemSchema = z.object({
  productId: z.number().int().min(1).optional(),
  description: z.string().trim().min(1, "Description is required").max(2000),
  uom: optionalString(30),
  quantity: z
    .number()
    .min(0.01, "Every quoted item needs a quantity greater than 0"),
  unitPrice: z.number().min(0),
  discountPercent: z.number().min(0).max(100).optional(),
  taxPercent: z.number().min(0).optional(),
});

export type QuotationLineItemFormValues = z.infer<
  typeof quotationLineItemSchema
>;

export const quotationPayloadSchema = z
  .object({
    accountId: z.number({ message: "Account is required" }).int().min(1),
    opportunityId: z.number().int().min(1).optional(),
    contactId: z.number().int().min(1).optional(),
    subject: z.string().trim().min(1, "Subject is required").max(300),
    status: z.enum(QUOTATION_STATUSES).optional(),
    quoteOwner: optionalString(150),
    currency: optionalString(10),
    quoteDate: optionalString(10),
    validUntil: z.string().trim().min(1, "Valid Until date is required"),
    customerReference: optionalString(150),
    billingStreet: optionalString(250),
    billingCity: optionalString(100),
    billingState: optionalString(100),
    billingPostalCode: optionalString(20),
    billingCountry: optionalString(100),
    shippingStreet: optionalString(250),
    shippingCity: optionalString(100),
    shippingState: optionalString(100),
    shippingPostalCode: optionalString(20),
    shippingCountry: optionalString(100),
    carrier: optionalString(100),
    deliveryNotes: optionalString(500),
    termsConditions: optionalString(4000),
    paymentTerms: optionalString(300),
    deliveryTerms: optionalString(300),
    notes: optionalString(2000),
    adjustment: z.number().optional(),
    items: z
      .array(quotationLineItemSchema)
      .min(1, "Add at least one quoted item"),
  })
  .refine((v) => !v.quoteDate || v.validUntil >= v.quoteDate, {
    message: "Valid Until must be on or after the Quote Date",
    path: ["validUntil"],
  });

export type QuotationPayloadFormValues = z.infer<typeof quotationPayloadSchema>;
