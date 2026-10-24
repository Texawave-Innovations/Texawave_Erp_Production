import type { FinanceAccountType } from "@texawave-erp/api-types";

export type StatusColorToken =
  "brand" | "success" | "warning" | "error" | "gray";

/** Formats financial amounts into regional Indian currency format (e.g. ₹1,25,000.00). */
export function formatMoney(
  value: string | number | null | undefined,
  currency = "INR",
  maximumFractionDigits = 2,
): string {
  const n = Number(value ?? 0);
  const code = /^[A-Z]{3}$/.test(currency) ? currency : "INR";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: code,
    maximumFractionDigits,
  }).format(Number.isFinite(n) ? n : 0);
}

/** Formats ISO dates into regional human readable medium string (e.g. 23 Oct 2026). */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(date);
}

/** Formats ISO date-time into regional human readable medium string with time. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

/** Converts account type enum into clean human title case. */
export function formatAccountType(type: FinanceAccountType | string): string {
  switch (type) {
    case "ASSET":
      return "Asset";
    case "LIABILITY":
      return "Liability";
    case "EQUITY":
      return "Equity";
    case "REVENUE":
      return "Revenue";
    case "EXPENSE":
      return "Expense";
    default:
      return type;
  }
}

/** Resolves UI Kit StatusBadge color tokens for account types. No violet/purple/indigo. */
export function accountTypeColorToken(
  type: FinanceAccountType | string,
): StatusColorToken {
  switch (type) {
    case "ASSET":
      return "brand";
    case "LIABILITY":
      return "warning";
    case "EQUITY":
      return "gray";
    case "REVENUE":
      return "success";
    case "EXPENSE":
      return "error";
    default:
      return "gray";
  }
}
