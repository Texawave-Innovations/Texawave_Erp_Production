"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import {
  Button,
  DataTable,
  DateRangePicker,
  type DateRangeValue,
  Dialog,
  EmptyState,
  ErrorState,
  Skeleton,
} from "@texawave-erp/ui-kit";
import { downloadWorkbook } from "@/lib/spreadsheet";
import { formatDate, formatInr } from "../../shared/format";
import { useCustomerStatement } from "../hooks";
import type { StatementEntry } from "../types";

function isoDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Default period: the last three months. */
function defaultRange(): DateRangeValue {
  const to = new Date();
  const from = new Date(to);
  from.setMonth(from.getMonth() - 3);
  return { from: isoDay(from), to: isoDay(to) };
}

function Total({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className={`rounded-xl p-4 text-center ${tone}`}>
      <p className="text-theme-sm text-gray-600 dark:text-gray-300">{label}</p>
      <p className="mt-1 text-xl font-bold">{formatInr(value)}</p>
    </div>
  );
}

export function CustomerStatementDialog({
  customer,
  onClose,
}: {
  /** null = closed. */
  customer: { id: number; companyName: string } | null;
  onClose: () => void;
}) {
  const [range, setRange] = useState<DateRangeValue>(defaultRange);
  const valid = range.from !== "" && range.to !== "" && range.from <= range.to;
  const query = useCustomerStatement(
    customer && valid ? customer.id : null,
    range,
  );
  const s = query.data;

  function exportCsv() {
    if (!s || !customer) return;
    void downloadWorkbook(
      `statement-${customer.companyName.replace(/[^A-Za-z0-9]+/g, "-")}-${range.from}-to-${range.to}`,
      [
        {
          name: "Statement",
          rows: s.entries,
          columns: [
            { header: "Date", value: (e: StatementEntry) => e.date },
            {
              header: "Type",
              value: (e: StatementEntry) =>
                e.type === "INVOICE" ? "Invoice" : "Payment",
            },
            { header: "Number", value: (e: StatementEntry) => e.number },
            {
              header: "Description",
              value: (e: StatementEntry) => e.description,
            },
            {
              header: "Debit",
              value: (e: StatementEntry) => e.debit,
              type: "amount",
            },
            {
              header: "Credit",
              value: (e: StatementEntry) => e.credit,
              type: "amount",
            },
            {
              header: "Balance",
              value: (e: StatementEntry) => e.balance,
              type: "amount",
              total: false,
            },
          ],
        },
      ],
    );
  }

  return (
    <Dialog
      open={customer !== null}
      onClose={onClose}
      title="Customer statement"
      subtitle={customer?.companyName ?? ""}
      size="4xl"
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <DateRangePicker
            variant="inputs"
            value={range}
            onChange={setRange}
            fromAriaLabel="Statement from"
            toAriaLabel="Statement to"
          />
          <Button
            variant="secondary"
            disabled={!s || s.entries.length === 0}
            onClick={exportCsv}
          >
            <Download className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Export CSV
          </Button>
        </div>

        {!valid ? (
          <p className="text-theme-sm text-error-600" role="alert">
            Pick a start date on or before the end date.
          </p>
        ) : query.isPending ? (
          <Skeleton className="h-64 w-full" />
        ) : query.isError ? (
          <ErrorState onRetry={() => void query.refetch()} />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Total
                label="Total invoiced"
                value={query.data.totalInvoiced}
                tone="bg-error-50 text-error-700 dark:bg-error-500/10"
              />
              <Total
                label="Total received"
                value={query.data.totalReceived}
                tone="bg-success-50 text-success-700 dark:bg-success-500/10"
              />
              <Total
                label="Outstanding"
                value={query.data.closingBalance}
                tone="bg-brand-50 text-brand-700 dark:bg-brand-500/10"
              />
            </div>
            {query.data.entries.length === 0 ? (
              <EmptyState
                title="No transactions in this period"
                description="Tax invoices and payments for this customer appear here."
              />
            ) : (
              <DataTable<StatementEntry>
                caption="Customer statement"
                rows={query.data.entries}
                getRowKey={(e) => `${e.type}-${e.number}-${e.date}`}
                columns={[
                  { header: "Date", cell: (e) => formatDate(e.date) },
                  {
                    header: "Type",
                    cell: (e) => (e.type === "INVOICE" ? "Invoice" : "Payment"),
                  },
                  { header: "Number", cell: (e) => e.number },
                  { header: "Description", cell: (e) => e.description },
                  {
                    header: "Debit",
                    align: "right",
                    cell: (e) => (Number(e.debit) ? formatInr(e.debit) : "—"),
                  },
                  {
                    header: "Credit",
                    align: "right",
                    cell: (e) => (Number(e.credit) ? formatInr(e.credit) : "—"),
                  },
                  {
                    header: "Balance",
                    align: "right",
                    cell: (e) => (
                      <span className="font-semibold">
                        {formatInr(e.balance)}
                      </span>
                    ),
                  },
                ]}
              />
            )}
          </>
        )}
      </div>
    </Dialog>
  );
}
