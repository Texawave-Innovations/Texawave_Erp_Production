import { z } from "zod";

/** Shared client-side validation for CRM Accounts — mirrors
 * apps/api/src/modules/crm/accounts/dto/account.dto.ts exactly. Only
 * `name` is required, matching legacy `AccountFormDialog.tsx`'s single
 * client-side save guard. Field groupings in the form component follow
 * legacy's 5 tabs: Company Info / Contact Details / Billing Address /
 * Shipping Address / Business Profile (+ Tags). */
export const ACCOUNT_TYPES = [
  "Prospect",
  "Customer",
  "Partner",
  "Vendor",
  "Reseller",
] as const;
export const CUSTOMER_CATEGORIES = [
  "Enterprise",
  "Mid-Market",
  "SMB",
  "Individual",
] as const;
export const CUSTOMER_CLASSES = ["A", "B", "C"] as const;
export const BUSINESS_TYPES = [
  "Manufacturer",
  "Distributor",
  "Retailer",
  "Service Provider",
  "Reseller",
  "Other",
] as const;
export const ACCOUNT_PRIORITIES = ["High", "Medium", "Low"] as const;
export const ACCOUNT_TEMPERATURES = ["Hot", "Warm", "Cold"] as const;
export const ACCOUNT_STATUS_TAGS = [
  "Interested",
  "Not Interested",
  "Keep in Touch",
  "Call Back",
  "Send Info",
] as const;

const optionalStr = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal(""));

export const createAccountSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(200, "Name must be 200 characters or fewer"),
  accountType: z.enum(ACCOUNT_TYPES).optional(),
  ownerName: optionalStr(150),
  industry: optionalStr(150),
  hq: optionalStr(300),
  priority: z.enum(ACCOUNT_PRIORITIES).optional(),
  temperature: z.enum(ACCOUNT_TEMPERATURES).optional(),
  website: optionalStr(300),
  phone: optionalStr(50),
  email: z
    .string()
    .trim()
    .email("Enter a valid email")
    .optional()
    .or(z.literal("")),
  linkedin: optionalStr(300),
  registrationNumber: optionalStr(100),
  numberOfEmployees: z.number().int().min(0).optional(),
  annualRevenue: z.number().min(0).optional(),
  description: z.string().optional().or(z.literal("")),
  billingStreet: optionalStr(300),
  billingCity: optionalStr(150),
  billingState: optionalStr(150),
  billingPostalCode: optionalStr(30),
  billingCountry: optionalStr(150),
  shippingStreet: optionalStr(300),
  shippingCity: optionalStr(150),
  shippingState: optionalStr(150),
  shippingPostalCode: optionalStr(30),
  shippingCountry: optionalStr(150),
  customerCategory: z.enum(CUSTOMER_CATEGORIES).optional(),
  customerClass: z.enum(CUSTOMER_CLASSES).optional(),
  businessType: z.enum(BUSINESS_TYPES).optional(),
  resellerType: optionalStr(100),
  tags: z.array(z.string()).max(50).optional(),
  customFields: z.record(z.string(), z.string()).optional(),
});

export type CreateAccountFormValues = z.infer<typeof createAccountSchema>;

export const updateAccountSchema = createAccountSchema.partial();
export type UpdateAccountFormValues = z.infer<typeof updateAccountSchema>;

/** Mirrors `AccountsService.changeStatusTag`'s per-tag required companion
 * field exactly: `Not Interested` -> statusReason; `Keep in Touch`/
 * `Call Back` -> statusDate; `Send Info` -> statusInfoType. */
export const changeAccountStatusTagSchema = z
  .object({
    statusTag: z.enum(ACCOUNT_STATUS_TAGS),
    statusReason: z.string().trim().optional().or(z.literal("")),
    statusDate: z.string().trim().optional().or(z.literal("")),
    statusInfoType: z.string().trim().optional().or(z.literal("")),
  })
  .superRefine((val, ctx) => {
    if (val.statusTag === "Not Interested" && !val.statusReason?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["statusReason"],
        message: "A reason is required when setting status to Not Interested",
      });
    }
    if (
      (val.statusTag === "Keep in Touch" || val.statusTag === "Call Back") &&
      !val.statusDate?.trim()
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["statusDate"],
        message:
          val.statusTag === "Call Back"
            ? "A date/time is required when setting status to Call Back"
            : "A date is required when setting status to Keep in Touch",
      });
    }
    if (val.statusTag === "Send Info" && !val.statusInfoType?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["statusInfoType"],
        message: "An info type is required when setting status to Send Info",
      });
    }
  });

export type ChangeAccountStatusTagFormValues = z.infer<
  typeof changeAccountStatusTagSchema
>;
