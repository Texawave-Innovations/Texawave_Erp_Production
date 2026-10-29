"use client";

import { useMemo, useState } from "react";
import type {
  CreateFinancePaymentReceivedInput,
  FinancePaymentReceived,
  FinancePaymentReceivedStatus,
} from "@texawave-erp/api-types";
import { FINANCE_PAYMENT_RECEIVED_STATUSES } from "@texawave-erp/api-types";
import { ApiError } from "@texawave-erp/core";
import {
  ActionMenu,
  Button,
  ConfirmDialog,
  DataTable,
  type DataTableColumn,
  EmptyState,
  ErrorState,
  Input,
  Pagination,
  SearchInput,
  Select,
  useToast,
} from "@texawave-erp/ui-kit";
import {
  Ban,
  Check,
  Eye,
  FileText,
  Pencil,
  Plus,
  Printer,
  Trash2,
} from "lucide-react";
import { useDebouncedValue } from "@/features/hr/employees/hooks";
import { usePermission } from "@/hooks/usePermission";
import { formatDate, formatMoney } from "../../shared/format";
import {
  useConfirmPaymentReceived,
  useDeletePaymentReceived,
  usePaymentsReceived,
  useVoidPaymentReceived,
} from "../hooks";
import {
  FINANCE_PAYMENT_RECEIVED_READ,
  FINANCE_PAYMENT_RECEIVED_WRITE,
} from "../permissions";
import { printPaymentReceipt } from "../print/printPaymentReceipt";
import { AdvanceCreditBanner } from "./AdvanceCreditBanner";
import { EditPaymentReceivedDialog } from "./EditPaymentReceivedDialog";
import { PaymentReceivedDetailDialog } from "./PaymentReceivedDetailDialog";
import { PaymentReceivedStatusBadge } from "./PaymentReceivedStatusBadge";
import { RecordPaymentReceivedDialog } from "./RecordPaymentReceivedDialog";

const PAGE_SIZE = 15;

export function PaymentsReceivedView() {
  const canRead = usePermission(FINANCE_PAYMENT_RECEIVED_READ);
  const canWrite = usePermission(FINANCE_PAYMENT_RECEIVED_WRITE);

  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebouncedValue(searchTerm, 300);

  const [statusFilter, setStatusFilter] = useState<
    FinancePaymentReceivedStatus | "ALL"
  >("ALL");
  const [paymentMonth, setPaymentMonth] = useState("");
  const [filterUnallocatedOnly, setFilterUnallocatedOnly] = useState(false);

  // Dialogs State
  const [createOpen, setCreateOpen] = useState(false);
  const [editingPayment, setEditingPayment] =
    useState<FinancePaymentReceived | null>(null);
  const [selectedPayment, setSelectedPayment] =
    useState<FinancePaymentReceived | null>(null);
  const [confirmingPayment, setConfirmingPayment] =
    useState<FinancePaymentReceived | null>(null);
  const [voidingPayment, setVoidingPayment] =
    useState<FinancePaymentReceived | null>(null);
  const [deletingPayment, setDeletingPayment] =
    useState<FinancePaymentReceived | null>(null);

  const { toast } = useToast();

  // Convert paymentMonth (YYYY-MM) to server-supported startDate and endDate
  const dateRange = useMemo(() => {
    if (!paymentMonth) return {};
    const [year, month] = paymentMonth.split("-").map(Number);
    if (!year || !month) return {};
    const start = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const end = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    return { startDate: start, endDate: end };
  }, [paymentMonth]);

  const queryParams = useMemo(() => {
    return {
      page,
      limit: PAGE_SIZE,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
      ...(dateRange.startDate ? { startDate: dateRange.startDate } : {}),
      ...(dateRange.endDate ? { endDate: dateRange.endDate } : {}),
    };
  }, [page, debouncedSearch, statusFilter, dateRange]);

  const paymentsQuery = usePaymentsReceived(queryParams);
  const confirmMutation = useConfirmPaymentReceived();
  const voidMutation = useVoidPaymentReceived();
  const deleteMutation = useDeletePaymentReceived();

  const rawPayments = useMemo(
    () => paymentsQuery.data?.data ?? [],
    [paymentsQuery.data?.data],
  );
  const meta = paymentsQuery.data?.meta;

  // Unallocated advance credit metrics
  const { unallocatedCount, unallocatedAmount } = useMemo(() => {
    let count = 0;
    let amount = 0;
    for (const p of rawPayments) {
      const unalloc = Number(p.unallocatedAmount || 0);
      if (unalloc > 0) {
        count += 1;
        amount += unalloc;
      }
    }
    return {
      unallocatedCount: count,
      unallocatedAmount: Math.round(amount * 100) / 100,
    };
  }, [rawPayments]);

  // Optional in-page filter for unallocated advance credit
  const displayedPayments = useMemo(() => {
    if (!filterUnallocatedOnly) return rawPayments;
    return rawPayments.filter((p) => Number(p.unallocatedAmount || 0) > 0);
  }, [rawPayments, filterUnallocatedOnly]);

  // Handlers
  const handleCreateSubmit = async (
    values: CreateFinancePaymentReceivedInput,
  ) => {
    try {
      const { createPaymentReceived } = await import("../api");
      await createPaymentReceived(values);
      toast({
        title:
          values.status === "CONFIRMED"
            ? "Payment receipt recorded & posted to General Ledger"
            : "Payment receipt saved as draft",
        variant: "success",
      });
      void paymentsQuery.refetch();
    } catch (err: unknown) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Failed to record payment receipt. Please check values and try again.";
      toast({
        title: msg,
        variant: "error",
      });
      throw err;
    }
  };

  const handleConfirmAction = async () => {
    if (!confirmingPayment) return;
    try {
      await confirmMutation.mutateAsync(confirmingPayment.id);
      toast({
        title: `Receipt ${confirmingPayment.paymentNumber} confirmed & posted to GL`,
        variant: "success",
      });
      setConfirmingPayment(null);
      if (selectedPayment?.id === confirmingPayment.id) {
        setSelectedPayment(null);
      }
      void paymentsQuery.refetch();
    } catch (err: unknown) {
      toast({
        title: err instanceof Error ? err.message : "Failed to confirm receipt",
        variant: "error",
      });
    }
  };

  const handleVoidAction = async () => {
    if (!voidingPayment) return;
    try {
      await voidMutation.mutateAsync(voidingPayment.id);
      toast({
        title: `Receipt ${voidingPayment.paymentNumber} voided and GL reversal posted`,
        variant: "success",
      });
      setVoidingPayment(null);
      if (selectedPayment?.id === voidingPayment.id) {
        setSelectedPayment(null);
      }
      void paymentsQuery.refetch();
    } catch (err: unknown) {
      toast({
        title: err instanceof Error ? err.message : "Failed to void receipt",
        variant: "error",
      });
    }
  };

  const handleDeleteAction = async () => {
    if (!deletingPayment) return;
    try {
      await deleteMutation.mutateAsync(deletingPayment.id);
      toast({
        title: `Receipt ${deletingPayment.paymentNumber} deleted`,
        variant: "success",
      });
      setDeletingPayment(null);
      void paymentsQuery.refetch();
    } catch (err: unknown) {
      toast({
        title: err instanceof Error ? err.message : "Failed to delete receipt",
        variant: "error",
      });
    }
  };

  const handlePrintAction = async (payment: FinancePaymentReceived) => {
    try {
      const success = await printPaymentReceipt(payment);
      if (!success) {
        toast({
          title:
            "Pop-up blocked. Please allow pop-ups to print payment receipt.",
          variant: "error",
        });
      }
    } catch {
      toast({
        title: "Failed to generate print document",
        variant: "error",
      });
    }
  };

  // DataTable columns
  const columns: DataTableColumn<FinancePaymentReceived>[] = [
    {
      header: "PAYMENT NO",
      sortable: true,
      cell: (row) => (
        <button
          type="button"
          onClick={() => setSelectedPayment(row)}
          className="font-bold text-theme-sm text-blue-600 hover:text-blue-800 dark:text-sky-400 dark:hover:text-sky-300 hover:underline text-left"
        >
          {row.paymentNumber}
        </button>
      ),
    },
    {
      header: "CUSTOMER",
      cell: (row) => (
        <div className="flex flex-col min-w-0 max-w-[180px]">
          <span className="font-semibold text-theme-sm text-gray-900 dark:text-white truncate">
            {row.customerName}
          </span>
          {row.customer?.name && row.customer.name !== row.customerName && (
            <span className="text-theme-xs text-gray-500 dark:text-gray-400 truncate">
              {row.customer.name}
            </span>
          )}
        </div>
      ),
    },
    {
      header: "INVOICE REF",
      cell: (row) => {
        const primaryRef =
          row.invoiceReference ||
          (row.allocations && row.allocations.length > 0
            ? row.allocations[0]!.invoiceReference
            : null);

        if (!primaryRef) {
          return <span className="text-gray-400">—</span>;
        }

        const moreCount = (row.allocations?.length ?? 0) - 1;

        return (
          <div className="inline-flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-theme-xs font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60">
              <FileText className="h-3 w-3 shrink-0" />
              <span>{primaryRef}</span>
            </span>
            {moreCount > 0 && (
              <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                +{moreCount}
              </span>
            )}
          </div>
        );
      },
    },
    {
      header: "PAYMENT DATE",
      cell: (row) => (
        <span className="text-theme-sm text-gray-700 dark:text-gray-300">
          {formatDate(row.paymentDate)}
        </span>
      ),
    },
    {
      header: "TOTAL RECEIVED",
      align: "right",
      cell: (row) => (
        <span className="font-bold text-theme-sm text-gray-900 dark:text-white">
          {formatMoney(row.amount)}
        </span>
      ),
    },
    {
      header: "ALLOCATED AMOUNT",
      align: "right",
      cell: (row) => (
        <span className="font-semibold text-theme-sm text-gray-700 dark:text-gray-300">
          {formatMoney(row.allocatedAmount)}
        </span>
      ),
    },
    {
      header: "UNALLOCATED ADVANCE CREDIT",
      align: "right",
      cell: (row) => {
        const unallocated = Number(row.unallocatedAmount || 0);
        if (unallocated <= 0) {
          return (
            <span className="text-theme-xs text-gray-400 font-medium">
              Fully Allocated
            </span>
          );
        }
        return (
          <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-theme-xs font-semibold text-blue-700 border border-blue-200/70 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-900/60">
            {formatMoney(unallocated)}
          </span>
        );
      },
    },
    {
      header: "MODE",
      cell: (row) => (
        <span className="text-theme-sm text-gray-700 dark:text-gray-300">
          {row.paymentMode?.value ?? "—"}
        </span>
      ),
    },
    {
      header: "REFERENCE",
      cell: (row) => (
        <span className="text-theme-sm text-gray-600 dark:text-gray-400 truncate max-w-[120px]">
          {row.referenceNumber ?? "—"}
        </span>
      ),
    },
    {
      header: "STATUS",
      cell: (row) => <PaymentReceivedStatusBadge status={row.status} />,
    },
    {
      header: "ACTIONS",
      align: "right",
      cell: (row) => {
        const actionItems = [
          {
            label: "View Details",
            icon: <Eye className="h-4 w-4" />,
            onClick: () => setSelectedPayment(row),
          },
          {
            label: "Print Receipt",
            icon: <Printer className="h-4 w-4" />,
            onClick: () => handlePrintAction(row),
          },
        ];

        if (row.status === "DRAFT" && canWrite) {
          actionItems.push({
            label: "Edit Draft",
            icon: <Pencil className="h-4 w-4 text-blue-600" />,
            onClick: () => setEditingPayment(row),
          });

          actionItems.push({
            label: "Confirm & Post GL",
            icon: <Check className="h-4 w-4 text-emerald-600" />,
            onClick: () => setConfirmingPayment(row),
          });
        }

        if (row.status === "CONFIRMED" && canWrite) {
          actionItems.push({
            label: "Void Receipt",
            icon: <Ban className="h-4 w-4 text-rose-600" />,
            onClick: () => setVoidingPayment(row),
          });
        }

        if ((row.status === "DRAFT" || row.status === "VOID") && canWrite) {
          actionItems.push({
            label: "Delete",
            icon: <Trash2 className="h-4 w-4 text-rose-600" />,
            onClick: () => setDeletingPayment(row),
          });
        }

        return (
          <ActionMenu
            ariaLabel={`Actions for ${row.paymentNumber}`}
            items={actionItems}
          />
        );
      },
    },
  ];

  if (!canRead) {
    return (
      <ErrorState
        title="Access Restricted"
        description="You do not have permission to view customer payments received (finance.payment_received.read). Please contact your administrator."
      />
    );
  }

  return (
    <div className="flex flex-col gap-5 relative focus-within:z-30">
      {/* 1. Advance Credit Summary Banner */}
      <AdvanceCreditBanner
        unallocatedCount={unallocatedCount}
        unallocatedAmount={unallocatedAmount}
        isFilterActive={filterUnallocatedOnly}
        onToggleFilter={() => setFilterUnallocatedOnly((prev) => !prev)}
      />

      {/* 2. Hero Header Card (TexaOne Prime Blue aesthetic) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl p-6 shadow-xs text-white bg-linear-to-r from-[#0a3271] via-[#1769F5] to-[#0284c7] dark:from-[#082352] dark:via-[#0e4cb8] dark:to-[#0369a1]">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-bold tracking-tight text-white">
            Payments Received
          </h2>
          <p className="text-theme-sm text-sky-100 font-medium">
            Record and track customer payments, multi-invoice allocations &
            receipts
          </p>
        </div>

        {canWrite && (
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-theme-sm font-bold text-[#1769F5] hover:bg-sky-50 transition-all shadow-xs self-start sm:self-auto cursor-pointer"
          >
            <Plus className="h-4 w-4 text-[#1769F5]" aria-hidden="true" />
            <span>Record Payment</span>
          </button>
        )}
      </div>

      {/* 3. Search and Filters Toolbar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-gray-200/80 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900 relative focus-within:z-30">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-12 items-center">
          <div className="w-full md:col-span-6">
            <SearchInput
              placeholder="Search by Payment No, Customer, Invoice, Ref..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              onClear={() => setSearchTerm("")}
            />
          </div>

          <div className="w-full md:col-span-3 flex items-center gap-2">
            <label className="text-theme-xs font-semibold text-gray-500 whitespace-nowrap">
              Payment Month:
            </label>
            <Input
              type="month"
              value={paymentMonth}
              onChange={(e) => {
                setPaymentMonth(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div className="w-full md:col-span-3">
            <Select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(
                  e.target.value as FinancePaymentReceivedStatus | "ALL",
                );
                setPage(1);
              }}
            >
              <option value="ALL">All Statuses</option>
              {FINANCE_PAYMENT_RECEIVED_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {/* Counter & Reset */}
        <div className="flex items-center justify-between text-theme-xs text-gray-500 dark:text-gray-400 pt-1">
          <span>
            Showing {displayedPayments.length} of{" "}
            {meta?.total ?? rawPayments.length} payments
          </span>
          {(paymentMonth ||
            filterUnallocatedOnly ||
            statusFilter !== "ALL" ||
            searchTerm) && (
            <button
              type="button"
              onClick={() => {
                setPaymentMonth("");
                setFilterUnallocatedOnly(false);
                setStatusFilter("ALL");
                setSearchTerm("");
              }}
              className="font-semibold text-blue-600 hover:text-blue-800 dark:text-sky-400 hover:underline"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* 4. Main Data Table */}
      <div className="relative focus-within:z-30">
        {paymentsQuery.isError ? (
          <div className="rounded-2xl border border-gray-200/80 bg-white p-8 dark:border-gray-800 dark:bg-gray-900">
            <ErrorState
              title="Failed to load payments received"
              description="Could not fetch customer payment receipts from the server."
              onRetry={() => void paymentsQuery.refetch()}
            />
          </div>
        ) : displayedPayments.length === 0 ? (
          <div className="rounded-2xl border border-gray-200/80 bg-white p-8 dark:border-gray-800 dark:bg-gray-900">
            <EmptyState
              title="No payment receipts found"
              description={
                debouncedSearch ||
                paymentMonth ||
                filterUnallocatedOnly ||
                statusFilter !== "ALL"
                  ? "No customer payments match your current search and filters."
                  : "No customer payment receipts recorded yet. Click 'Record Payment' to record your first customer payment."
              }
              action={
                canWrite && !debouncedSearch ? (
                  <Button onClick={() => setCreateOpen(true)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    <span>Record Payment</span>
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <DataTable
            columns={columns}
            rows={displayedPayments}
            getRowKey={(row) => String(row.id)}
          />
        )}
      </div>

      {/* 5. Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex justify-end pt-2">
          <Pagination
            page={page}
            totalPages={meta.totalPages}
            onPageChange={setPage}
          />
        </div>
      )}

      {/* 6. Modals */}
      <RecordPaymentReceivedDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreateSubmit}
      />

      <EditPaymentReceivedDialog
        open={Boolean(editingPayment)}
        onClose={() => setEditingPayment(null)}
        payment={editingPayment}
        onSuccess={() => void paymentsQuery.refetch()}
      />

      <PaymentReceivedDetailDialog
        open={Boolean(selectedPayment)}
        onClose={() => setSelectedPayment(null)}
        payment={selectedPayment}
        canWrite={canWrite}
        onConfirmClick={(payment) => setConfirmingPayment(payment)}
        onVoidClick={(payment) => setVoidingPayment(payment)}
        onRefetch={() => void paymentsQuery.refetch()}
      />

      {/* Confirm & Post GL Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(confirmingPayment)}
        onClose={() => setConfirmingPayment(null)}
        onConfirm={handleConfirmAction}
        title="Confirm Receipt & Post to GL"
        itemName={confirmingPayment?.paymentNumber}
        description={
          <span>
            Are you sure you want to confirm receipt{" "}
            <strong>{confirmingPayment?.paymentNumber}</strong>? This will
            atomically create and post a double-entry General Ledger voucher
            (Debit Bank/Cash, Credit Accounts Receivable).
          </span>
        }
        confirmText="Confirm & Post"
      />

      {/* Void Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(voidingPayment)}
        onClose={() => setVoidingPayment(null)}
        onConfirm={handleVoidAction}
        title="Void Payment Receipt"
        itemName={voidingPayment?.paymentNumber}
        description={
          <span>
            Are you sure you want to void receipt{" "}
            <strong>{voidingPayment?.paymentNumber}</strong>? Voiding will
            atomically create a GL reversal voucher (REV-) and invert account
            ledger balances. This cannot be undone.
          </span>
        }
        confirmText="Void Receipt"
        variant="destructive"
      />

      {/* Delete Draft Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(deletingPayment)}
        onClose={() => setDeletingPayment(null)}
        onConfirm={handleDeleteAction}
        title="Delete Payment Receipt"
        itemName={deletingPayment?.paymentNumber}
        description={
          <span>
            Are you sure you want to delete receipt{" "}
            <strong>{deletingPayment?.paymentNumber}</strong>?
          </span>
        }
        confirmText="Delete"
        variant="destructive"
      />
    </div>
  );
}
