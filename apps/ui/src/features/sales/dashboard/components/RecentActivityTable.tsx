"use client";

import { useRouter } from "next/navigation";
import {
  DataTable,
  EmptyState,
  SectionCard,
  StatusBadge,
  type DataTableColumn,
  type StatusColorToken,
} from "@texawave-erp/ui-kit";
import { formatDate, formatInr } from "../../shared/format";
import type { SalesDashboard } from "../types";

type Row = SalesDashboard["recentActivity"][number];

const TYPE_LABEL: Record<string, string> = {
  QUOTATION: "Quotation",
  PROFORMA_INVOICE: "Proforma invoice",
  TAX_INVOICE: "Tax invoice",
};

/** Raw `status` is a quotation (OPEN/CONVERTED) or an invoice status. */
const STATUS: Record<string, { label: string; tone: StatusColorToken }> = {
  OPEN: { label: "Open", tone: "brand" },
  CONVERTED: { label: "Converted", tone: "gray" },
  UNPAID: { label: "Unpaid", tone: "error" },
  PARTIALLY_PAID: { label: "Partially paid", tone: "warning" },
  PAID: { label: "Paid", tone: "success" },
};

const hrefOf = (r: Row) =>
  r.documentType === "QUOTATION"
    ? `/sales/quotations/${r.documentId}`
    : `/sales/invoices/${r.documentId}`;

const COLUMNS: ReadonlyArray<DataTableColumn<Row>> = [
  {
    header: "Document",
    cell: (r) => (
      <div className="flex flex-col">
        <span className="font-medium text-gray-900 dark:text-white/90">
          {r.documentNumber}
        </span>
        <span className="text-theme-xs text-gray-500 dark:text-gray-400">
          {TYPE_LABEL[r.documentType] ?? r.documentType}
        </span>
      </div>
    ),
  },
  { header: "Customer", cell: (r) => r.customerName },
  { header: "Date", cell: (r) => formatDate(r.date) },
  {
    header: "Status",
    cell: (r) => {
      const s = STATUS[r.status] ?? { label: r.status, tone: "gray" as const };
      return <StatusBadge label={s.label} colorToken={s.tone} />;
    },
  },
  { header: "Amount", align: "right", cell: (r) => formatInr(r.amount) },
];

export function RecentActivityTable({ rows }: { rows: Row[] }) {
  const router = useRouter();
  return (
    <SectionCard
      title="Recent activity"
      description="Latest quotations and invoices"
    >
      <DataTable
        caption="Recent documents"
        columns={COLUMNS}
        rows={rows}
        getRowKey={(r) => `${r.documentType}-${r.documentId}`}
        density="compact"
        onRowClick={(r) => router.push(hrefOf(r))}
        emptyState={<EmptyState title="No documents yet" />}
      />
    </SectionCard>
  );
}
