import Link from "next/link";
import { FileText } from "lucide-react";
import { StatusBadge } from "@texawave-erp/ui-kit";
import { formatDate, formatInr } from "../../shared/format";
import type { Payment } from "../types";

/** Small cell pieces for the payments list; only this table uses them. */

/** The invoice number as a pill with a document icon, linking to the invoice. */
export function InvoiceRefPill({ p }: { p: Payment }) {
  return (
    <Link
      href={`/sales/invoices/${p.invoice.id}`}
      title="Open the invoice"
      className="inline-flex items-center gap-1.5 rounded-full border border-success-200 bg-success-50 px-3 py-1 text-theme-xs font-semibold text-success-700 transition-colors hover:bg-success-100 dark:border-emerald-700/40 dark:bg-emerald-950/50 dark:text-emerald-300"
    >
      <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {p.invoice.invoiceNumber}
    </Link>
  );
}

/** The payment date in a small bordered box. */
export function DateBox({ value }: { value: string }) {
  return (
    <span className="inline-block rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-theme-xs font-medium text-slate-800 shadow-theme-xsdark:border-gray-700 dark:bg-gray-dark dark:text-white/90">
      {formatDate(value)}
    </span>
  );
}

/** Due date; red with an "Overdue" pill underneath while it is past due. */
export function DueCell({ p }: { p: Payment }) {
  if (!p.effectiveDueDate) return <>—</>;
  return (
    <div className="flex flex-col items-center gap-1">
      <span
        className={
          p.overdueDays
            ? "font-semibold text-error-700 dark:text-error-400"
            : "font-semibold"
        }
      >
        {formatDate(p.effectiveDueDate)}
      </span>
      {p.overdueDays ? (
        <StatusBadge label={`Overdue (${p.overdueDays}d)`} colorToken="error" />
      ) : null}
    </div>
  );
}

export function BalanceBadge({ p }: { p: Payment }) {
  const balance = Number(p.invoice.balance);
  return balance <= 0 ? (
    <StatusBadge label={`${formatInr(0)} (Paid)`} colorToken="success" />
  ) : (
    <StatusBadge
      label={formatInr(p.invoice.balance)}
      colorToken={p.overdueDays ? "error" : "warning"}
    />
  );
}
