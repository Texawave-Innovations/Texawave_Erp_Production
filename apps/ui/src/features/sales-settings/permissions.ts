/**
 * UI visibility only. The API guards every route and is authoritative
 * (`@RequirePermission()` on each controller method,
 * Docs/SALES_SETTINGS_FOUNDATION.md "Permissions"). Sales Settings is
 * org-wide configuration, `@OrgScoped()` + `@RequirePermission()` only — no
 * `.own/.team/.all` suffixes (Docs/CODING_STANDARDS.md §10a), unlike HR data.
 */
export const COMPANY_DETAIL_READ = "sales_settings.company_detail.read";
export const COMPANY_DETAIL_WRITE = "sales_settings.company_detail.write";

export const DOCUMENT_NUMBERING_READ = "sales_settings.document_numbering.read";
export const DOCUMENT_NUMBERING_WRITE =
  "sales_settings.document_numbering.write";

export const BANK_ACCOUNT_READ = "sales_settings.bank_account.read";
export const BANK_ACCOUNT_WRITE = "sales_settings.bank_account.write";

export const AUTHORIZED_SIGNATORY_READ =
  "sales_settings.authorized_signatory.read";
export const AUTHORIZED_SIGNATORY_WRITE =
  "sales_settings.authorized_signatory.write";

export const SALESPERSON_READ = "sales_settings.salesperson.read";
export const SALESPERSON_WRITE = "sales_settings.salesperson.write";

/** Covers both masterlists (company seals + authorized signatures). */
export const SEAL_SIGNATURE_READ = "sales_settings.seal_signature.read";
export const SEAL_SIGNATURE_WRITE = "sales_settings.seal_signature.write";

/** Covers all 8 Terms & Inventory categories. */
export const MASTER_LIST_ITEM_READ = "sales_settings.master_list_item.read";
export const MASTER_LIST_ITEM_WRITE = "sales_settings.master_list_item.write";
