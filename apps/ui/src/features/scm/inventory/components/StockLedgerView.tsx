"use client";

import type {
  LedgerEntry,
  LedgerTransactionType,
} from "@texawave-erp/api-types";
import { LEDGER_TRANSACTION_TYPES } from "@texawave-erp/api-types";
import {
  Button,
  ConfirmDialog,
  Input,
  Select,
  StatusBadge,
  useToast,
} from "@texawave-erp/ui-kit";
import { ScrollText, Undo2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import {
  formatDateTime,
  formatMoney,
  formatQty,
  formatStatusLabel,
} from "../../shared/format";
import { WarehouseSelect } from "../../shared/masters";
import { ScmListView } from "../../shared/ScmListView";
import { usePermission } from "@/hooks/usePermission";
import { errorText, useListControls } from "../../shared/use-list-controls";
import { useLedger, useReverseLedgerEntry } from "../hooks";

const IN_TYPES = new Set([
  "OPENING_BALANCE",
  "PURCHASE_RECEIPT",
  "SALES_RETURN",
  "TRANSFER_IN",
  "ADJUSTMENT_IN",
  "QC_RELEASE",
]);

/** Legacy `ScmStockLedgerPage`: the authoritative, append-only history of
 * every stock movement. */
export function StockLedgerView() {
  const c = useListControls(15);
  const [type, setType] = useState<LedgerTransactionType | "">("");
  const [warehouseId, setWarehouseId] = useState<number | "">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [reversing, setReversing] = useState<LedgerEntry | null>(null);
  const { toast } = useToast();
  const canWrite = usePermission("scm.inventory.write");
  const reverse = useReverseLedgerEntry();

  const query = useLedger({
    q: c.q,
    page: c.page,
    limit: c.pageSize,
    transactionType: type === "" ? undefined : type,
    warehouseId: warehouseId === "" ? undefined : warehouseId,
    from: from ? new Date(from).toISOString() : undefined,
    to: to ? new Date(`${to}T23:59:59`).toISOString() : undefined,
  });

  return (
    <ScmListView<LedgerEntry>
      title="Stock Ledger"
      description="Authoritative, append-only history of every stock movement. Corrections are new offsetting entries."
      icon={ScrollText}
      noun="ledger entries"
      readPermission="scm.inventory.read"
      query={query}
      page={c.page}
      pageSize={c.pageSize}
      onPageChange={c.setPage}
      getRowKey={(e) => String(e.id)}
      search={{
        value: c.search,
        onChange: c.setSearch,
        placeholder: "Search by product, reference or notes...",
      }}
      filters={
        <div className="flex w-full flex-col gap-2 lg:w-auto lg:flex-row">
          <div className="w-full lg:w-48">
            <Select
              aria-label="Filter by transaction type"
              value={type}
              onChange={(e) => {
                setType(e.target.value as LedgerTransactionType | "");
                c.setPage(1);
              }}
            >
              <option value="">All types</option>
              {LEDGER_TRANSACTION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {formatStatusLabel(t)}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-full lg:w-48">
            <WarehouseSelect
              aria-label="Filter by warehouse"
              placeholder="All warehouses"
              value={warehouseId}
              onChange={(v) => {
                setWarehouseId(v);
                c.setPage(1);
              }}
            />
          </div>
          <Input
            aria-label="From date"
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              c.setPage(1);
            }}
          />
          <Input
            aria-label="To date"
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              c.setPage(1);
            }}
          />
        </div>
      }
      hasActiveFilters={Boolean(
        c.search || type || warehouseId !== "" || from || to,
      )}
      onResetFilters={() => {
        c.setSearch("");
        setType("");
        setWarehouseId("");
        setFrom("");
        setTo("");
      }}
      emptyTitle="No stock movements yet"
      emptyDescription="Post an opening balance, receive a GRN or approve a transfer/adjustment to create ledger entries."
      columns={[
        { header: "Date", cell: (e) => formatDateTime(e.transactionDate) },
        {
          header: "Reference",
          cell: (e) => (
            <div className="flex flex-col">
              <span className="font-mono text-theme-xs">
                {e.referenceNumber ?? "—"}
              </span>
              <span className="text-theme-xs text-gray-500">
                {formatStatusLabel(e.referenceType)}
              </span>
            </div>
          ),
        },
        {
          header: "Product",
          cell: (e) =>
            e.product ? (
              <Link
                href={`/scm/inventory/overview/${e.product.id}`}
                className="text-brand-700 hover:underline dark:text-brand-300"
              >
                {e.product.name}
              </Link>
            ) : (
              "—"
            ),
        },
        { header: "Warehouse", cell: (e) => e.warehouse?.name ?? "—" },
        {
          header: "Type",
          cell: (e) => (
            <StatusBadge
              label={formatStatusLabel(e.transactionType)}
              colorToken={
                IN_TYPES.has(e.transactionType) ? "success" : "warning"
              }
            />
          ),
        },
        {
          header: "In",
          align: "right",
          cell: (e) =>
            Number(e.quantityIn) > 0 ? formatQty(e.quantityIn) : "—",
        },
        {
          header: "Out",
          align: "right",
          cell: (e) =>
            Number(e.quantityOut) > 0 ? formatQty(e.quantityOut) : "—",
        },
        {
          header: "Unit Cost",
          align: "right",
          cell: (e) => (e.unitCost ? formatMoney(e.unitCost) : "—"),
        },
        {
          header: "Actions",
          headerClassName: "text-right",
          className: "text-right",
          cell: (e) =>
            canWrite && e.referenceType !== "LEDGER_REVERSAL" ? (
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  title="Reverse entry"
                  aria-label="Reverse ledger entry"
                  onClick={() => setReversing(e)}
                >
                  <Undo2 className="h-4 w-4 text-error-600" />
                </Button>
              </div>
            ) : null,
        },
      ]}
    >
      <ConfirmDialog
        open={Boolean(reversing)}
        onClose={() => setReversing(null)}
        title="Reverse ledger entry?"
        description={`Reverse this ${reversing ? formatStatusLabel(reversing.transactionType) : ""} entry for ${reversing?.product?.name ?? ""}? The ledger is the stock source of truth and is append-only, so an offsetting entry is posted and the stock balance is adjusted back by the same quantity. This cannot be undone.`}
        confirmText="Reverse entry"
        variant="destructive"
        onConfirm={async () => {
          if (!reversing) return;
          try {
            await reverse.mutateAsync(reversing.id);
            toast({
              title: "Entry reversed and stock balance adjusted",
              variant: "success",
            });
          } catch (err) {
            toast({
              title: errorText(err, "Failed to reverse ledger entry"),
              variant: "error",
            });
          }
          setReversing(null);
        }}
      />
    </ScmListView>
  );
}
