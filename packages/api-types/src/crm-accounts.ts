// HANDWRITTEN — mirrors apps/api/src/modules/crm/accounts/dto/account.dto.ts
// and apps/api/src/modules/crm/accounts/accounts.{controller,service,repository}.ts.
// Phase 0/1A: expanded from the Phase 4B minimal `{id,name}` foundation to
// the full Account-360 shape (Docs/CRM_FULL_LEGACY_PARITY.md §4/§8). See
// packages/api-types/README.md.

export const ACCOUNT_TYPES = [
  "Prospect",
  "Customer",
  "Partner",
  "Vendor",
  "Reseller",
] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const CUSTOMER_CATEGORIES = [
  "Enterprise",
  "Mid-Market",
  "SMB",
  "Individual",
] as const;
export type CustomerCategory = (typeof CUSTOMER_CATEGORIES)[number];

export const CUSTOMER_CLASSES = ["A", "B", "C"] as const;
export type CustomerClass = (typeof CUSTOMER_CLASSES)[number];

export const BUSINESS_TYPES = [
  "Manufacturer",
  "Distributor",
  "Retailer",
  "Service Provider",
  "Reseller",
  "Other",
] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];

/** Mirrors legacy `CrmStatusTag` exactly — the `AccountStatusQueue`/
 * `StatusTagDialog` engagement-posture tag, independent of any Opportunity
 * pipeline stage. */
export const ACCOUNT_STATUS_TAGS = [
  "Interested",
  "Not Interested",
  "Keep in Touch",
  "Call Back",
  "Send Info",
] as const;
export type AccountStatusTag = (typeof ACCOUNT_STATUS_TAGS)[number];

export interface Account {
  id: number;
  organizationId: number;
  teamId: number | null;
  name: string;
  accountType: AccountType | null;
  ownerName: string | null;
  industry: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  linkedin: string | null;
  registrationNumber: string | null;
  numberOfEmployees: number | null;
  /** Decimal column — serializes as string in responses. */
  annualRevenue: string | null;
  description: string | null;
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
  customerCategory: CustomerCategory | null;
  customerClass: CustomerClass | null;
  businessType: BusinessType | null;
  resellerType: string | null;
  tags: string[];
  statusTag: AccountStatusTag | null;
  statusReason: string | null;
  statusDate: string | null;
  statusInfoType: string | null;
  statusUpdatedBy: number | null;
  statusUpdatedAt: string | null;
  isActive: boolean;
  createdBy: number | null;
  updatedBy: number | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateAccountInput {
  name: string;
  accountType?: AccountType | undefined;
  ownerName?: string | undefined;
  industry?: string | undefined;
  website?: string | undefined;
  phone?: string | undefined;
  email?: string | undefined;
  linkedin?: string | undefined;
  registrationNumber?: string | undefined;
  numberOfEmployees?: number | undefined;
  annualRevenue?: number | undefined;
  description?: string | undefined;
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
  customerCategory?: CustomerCategory | undefined;
  customerClass?: CustomerClass | undefined;
  businessType?: BusinessType | undefined;
  resellerType?: string | undefined;
  tags?: string[] | undefined;
}

export type UpdateAccountInput = Partial<CreateAccountInput>;

export interface QueryAccountsInput {
  page?: number | undefined;
  limit?: number | undefined;
  order?: ("asc" | "desc") | undefined;
  search?: string | undefined;
  statusTag?: AccountStatusTag | undefined;
}

/** Mirrors legacy `StatusTagDialog`'s per-tag required companion field —
 * enforced server-side in `AccountsService.changeStatusTag`
 * (`assertStatusTagFieldsPresent`): `Not Interested` requires
 * `statusReason`; `Keep in Touch` and `Call Back` require `statusDate`;
 * `Send Info` requires `statusInfoType`. UI forms must replicate this so
 * the corresponding field is required inline before submit. */
export interface ChangeAccountStatusTagInput {
  statusTag: AccountStatusTag;
  statusReason?: string | undefined;
  statusDate?: string | undefined;
  statusInfoType?: string | undefined;
}
