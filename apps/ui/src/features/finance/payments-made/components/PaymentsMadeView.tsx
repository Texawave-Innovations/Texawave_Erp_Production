"use client";

import { useMemo, useState } from "react";
import type {
  CreateFinancePaymentMadeInput,
  FinancePaymentMade,
  FinancePaymentMadeStatus,
} from "@texawave-erp/api-types";
import { FINANCE_PAYMENT_MADE_STATUSES } from "@texawave-erp/api-types";
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
  ExternalLink,
  Eye,
  FileText,
  Pencil,
  Plus,
  Printer,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useDebouncedValue } from "@/features/hr/employees/hooks";
import { usePermission } from "@/hooks/usePermission";
import { formatDate, formatMoney } from "../../shared/format";
import {
  useConfirmPaymentMade,
  useDeletePaymentMade,
  usePaymentsMade,
  useVoidPaymentMade,
} from "../hooks";
import {
  FINANCE_PAYMENT_MADE_READ,
  FINANCE_PAYMENT_MADE_WRITE,
} from "../permissions";
import { printPaymentDisbursement } from "../print/printPaymentDisbursement";
import { DisbursementsSummaryBanner } from "./DisbursementsSummaryBanner";
import { EditPaymentMadeDialog } from "./EditPaymentMadeDialog";
import { PaymentMadeDetailDialog } from "./PaymentMadeDetailDialog";
import { PaymentMadeStatusBadge } from "./PaymentMadeStatusBadge";
import { RecordPaymentMadeDialog } from "./RecordPaymentMadeDialog";

const PAGE_SIZE = 15;

export function PaymentsMadeView() {
  const canRead = usePermission(FINANCE_PAYMENT_MADE_READ);
  const canWrite = usePermission(FINANCE_PAYMENT_MADE_WRITE);

  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebouncedValue(searchTerm, 300);

  const [statusFilter, setStatusFilter] = useState<
    FinancePaymentMadeStatus | "ALL"
  >("ALL");
  const [paymentMonth, setPaymentMonth] = useState("");

  // Dialogs State
  const [createOpen, setCreateOpen] = useState(false);
  const [editingPayment, setEditingPayment] =
    useState<FinancePaymentMade | null>(null);
  const [selectedPayment, setSelectedPayment] =
    useState<FinancePaymentMade | null>(null);
  const [confirmingPayment, setConfirmingPayment] =
    useState<FinancePaymentMade | null>(null);
  const [voidingPayment, setVoidingPayment] =
    useState<FinancePaymentMade | null>(null);
  const [deletingPayment, setDeletingPayment] =
    useState<FinancePaymentMade | null>(null);

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

  const paymentsQuery = usePaymentsMade(queryParams);
  const confirmMutation = useConfirmPaymentMade();
  const voidMutation = useVoidPaymentMade();
  const deleteMutation = useDeletePaymentMade();

  const rawPayments = useMemo(
    () => paymentsQuery.data?.data ?? [],
    [paymentsQuery.data?.data],
  );
  const meta = paymentsQuery.data?.meta;

  // Handlers
  const handleCreateSubmit = async (values: CreateFinancePaymentMadeInput) => {
    try {
      const { createPaymentMade } = await import("../api");
      await createPaymentMade(values);
      toast({
        title:
          values.status === "CONFIRMED"
            ? "Supplier payment recorded & posted to General Ledger"
            : "Supplier payment saved as draft",
        variant: "success",
      });
      void paymentsQuery.refetch();
    } catch (err: unknown) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Failed to record payment. Please check values and try again.";
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
        title: `Payment ${confirmingPayment.paymentNumber} confirmed & posted to GL`,
        variant: "success",
      });
      setConfirmingPayment(null);
      if (selectedPayment?.id === confirmingPayment.id) {
        setSelectedPayment(null);
      }
      void paymentsQuery.refetch();
    } catch (err: unknown) {
      toast({
        title: err instanceof Error ? err.message : "Failed to confirm payment",
        variant: "error",
      });
    }
  };

  const handleVoidAction = async () => {
    if (!voidingPayment) return;
    try {
      await voidMutation.mutateAsync(voidingPayment.id);
      toast({
        title: `Payment ${voidingPayment.paymentNumber} voided and GL reversal posted`,
        variant: "success",
      });
      setVoidingPayment(null);
      if (selectedPayment?.id === voidingPayment.id) {
        setSelectedPayment(null);
      }
      void paymentsQuery.refetch();
    } catch (err: unknown) {
      toast({
        title: err instanceof Error ? err.message : "Failed to void payment",
        variant: "error",
      });
    }
  };

  const handleDeleteAction = async () => {
    if (!deletingPayment) return;
    try {
      await deleteMutation.mutateAsync(deletingPayment.id);
      toast({
        title: `Payment ${deletingPayment.paymentNumber} deleted`,
        variant: "success",
      });
      setDeletingPayment(null);
      void paymentsQuery.refetch();
    } catch (err: unknown) {
      toast({
        title: err instanceof Error ? err.message : "Failed to delete payment",
        variant: "error",
      });
    }
  };

  const handlePrintAction = async (payment: FinancePaymentMade) => {
    const success = await printPaymentDisbursement(payment);
    if (!success) {
      toast({
        title:
          "Pop-up blocked. Please allow pop-ups to print disbursement voucher.",
        variant: "error",
      });
    }
  };

  // DataTable columns
  const columns: DataTableColumn<FinancePaymentMade>[] = [
    {
      header: "PAYMENT NO",
      sortable: true,
      cell: (row) => (
        <button
          type="button"
          onClick={() => setSelectedPayment(row)}
          className="font-bold text-theme-sm text-blue-600 hover:text-blue-800 dark:text-sky-400 dark:hover:text-sky-300 hover:underline text-left cursor-pointer"
        >
          {row.paymentNumber}
        </button>
      ),
    },
    {
      header: "VENDOR",
      cell: (row) => (
        <div className="flex flex-col min-w-0 max-w-[200px]">
          <span className="font-semibold text-theme-sm text-gray-900 dark:text-white truncate">
            {row.vendorName}
          </span>
          {row.scmSupplierPaymentId && (
            <span className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
              SCM Pay Ref #{row.scmSupplierPaymentId}
            </span>
          )}
        </div>
      ),
    },
    {
      header: "BILL / PO REF",
      cell: (row) => {
        if (!row.billReference) {
          return <span className="text-gray-400">—</span>;
        }

        return (
          <div className="inline-flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-theme-xs font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60">
              <FileText className="h-3 w-3 shrink-0" />
              <span>{row.billReference}</span>
            </span>
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
      header: "AMOUNT PAID",
      align: "right",
      cell: (row) => (
        <span className="font-bold text-theme-sm text-gray-900 dark:text-white">
          {formatMoney(row.amount)}
        </span>
      ),
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
      header: "ACCOUNT / REF",
      cell: (row) => {
        const bank = row.bankAccount;
        const ref = row.referenceNumber;

        if (!bank && !ref) {
          return <span className="text-gray-400">—</span>;
        }

        return (
          <div className="flex flex-col min-w-0 max-w-[170px]">
            {bank && (
              <span className="text-theme-xs font-semibold text-gray-800 dark:text-gray-200 truncate">
                {bank.accountName}
              </span>
            )}
            {ref ? (
              <span className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                Ref: {ref}
              </span>
            ) : bank ? (
              <span className="text-[11px] text-gray-400 truncate">
                Acc: {bank.accountNumber}
              </span>
            ) : null}
          </div>
        );
      },
    },
    {
      header: "GL VOUCHER",
      cell: (row) => {
        if (!row.journalEntry) {
          return (
            <span className="text-theme-xs text-gray-400 font-medium italic">
              {row.status === "DRAFT" ? "Pending Posting" : "—"}
            </span>
          );
        }

        return (
          <Link
            href={`/finance/journal-entries?search=${encodeURIComponent(row.journalEntry.entryNumber)}`}
            className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-0.5 text-theme-xs font-semibold text-sky-700 border border-sky-200/70 hover:bg-sky-100 hover:text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-900/60"
            title="View linked General Ledger journal voucher"
          >
            <span>{row.journalEntry.entryNumber}</span>
            <ExternalLink className="h-3 w-3 shrink-0" />
          </Link>
        );
      },
    },
    {
      header: "STATUS",
      cell: (row) => <PaymentMadeStatusBadge status={row.status} />,
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
            label: "Print Voucher",
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

        if (
          (row.status === "CONFIRMED" || row.status === "RECONCILED") &&
          canWrite
        ) {
          actionItems.push({
            label: "Void Disbursement",
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
        description="You do not have permission to view vendor payments made (finance.payment_made.read). Please contact your administrator."
      />
    );
  }

  return (
    <div className="flex flex-col gap-5 relative focus-within:z-30">
      {/* 1. Disbursements Metric Breakdown Banner */}
      <DisbursementsSummaryBanner
        payments={rawPayments}
        totalServerCount={meta?.total}
      />

      {/* 2. Hero Header Card (TexaOne Prime Blue aesthetic) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl p-6 shadow-xs text-white bg-linear-to-r from-[#0a3271] via-[#1769F5] to-[#0284c7] dark:from-[#082352] dark:via-[#0e4cb8] dark:to-[#0369a1]">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-bold tracking-tight text-white">
            Payments Made
          </h2>
          <p className="text-theme-sm text-sky-100 font-medium">
            Manage and track vendor disbursements, banking outflows & GL
            vouchers
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
              placeholder="Search by Payment No, Vendor, Bill/PO Ref, Reference..."
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
                  e.target.value as FinancePaymentMadeStatus | "ALL",
                );
                setPage(1);
              }}
            >
              <option value="ALL">All Statuses</option>
              {FINANCE_PAYMENT_MADE_STATUSES.map((status) => (
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
            Showing {rawPayments.length} of {meta?.total ?? rawPayments.length}{" "}
            disbursements
          </span>
          {(paymentMonth || statusFilter !== "ALL" || searchTerm) && (
            <button
              type="button"
              onClick={() => {
                setPaymentMonth("");
                setStatusFilter("ALL");
                setSearchTerm("");
              }}
              className="font-semibold text-blue-600 hover:text-blue-800 dark:text-sky-400 hover:underline cursor-pointer"
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
              title="Failed to load payments made"
              description="Could not fetch vendor payment disbursements from the server."
              onRetry={() => void paymentsQuery.refetch()}
            />
          </div>
        ) : rawPayments.length === 0 ? (
          <div className="rounded-2xl border border-gray-200/80 bg-white p-8 dark:border-gray-800 dark:bg-gray-900">
            <EmptyState
              title="No disbursements found"
              description={
                debouncedSearch || paymentMonth || statusFilter !== "ALL"
                  ? "No vendor disbursements match your current search and filters."
                  : "No vendor payments recorded yet. Click 'Record Payment' to disburse your first vendor payment."
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
            rows={rawPayments}
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
      <RecordPaymentMadeDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreateSubmit}
      />

      <EditPaymentMadeDialog
        open={Boolean(editingPayment)}
        onClose={() => setEditingPayment(null)}
        payment={editingPayment}
        onSuccess={() => void paymentsQuery.refetch()}
      />

      <PaymentMadeDetailDialog
        open={Boolean(selectedPayment)}
        onClose={() => setSelectedPayment(null)}
        payment={selectedPayment}
        canWrite={canWrite}
        onConfirmClick={(payment) => setConfirmingPayment(payment)}
        onVoidClick={(payment) => setVoidingPayment(payment)}
        onPrintClick={(payment) => handlePrintAction(payment)}
      />

      {/* Confirm & Post GL Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(confirmingPayment)}
        onClose={() => setConfirmingPayment(null)}
        onConfirm={handleConfirmAction}
        title="Confirm Payment & Post to GL"
        itemName={confirmingPayment?.paymentNumber}
        description={
          <span>
            Are you sure you want to confirm disbursement{" "}
            <strong>{confirmingPayment?.paymentNumber}</strong>? This will
            atomically create and post a double-entry General Ledger voucher
            (Debit Accounts Payable, Credit Bank/Cash account) and deduct the
            balance.
          </span>
        }
        confirmText="Confirm & Post"
      />

      {/* Void Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(voidingPayment)}
        onClose={() => setVoidingPayment(null)}
        onConfirm={handleVoidAction}
        title="Void Disbursement"
        itemName={voidingPayment?.paymentNumber}
        description={
          <span>
            Are you sure you want to void disbursement{" "}
            <strong>{voidingPayment?.paymentNumber}</strong>? Voiding will
            atomically create a GL reversal voucher (REV-) and restore the bank
            balance. This cannot be undone.
          </span>
        }
        confirmText="Void Disbursement"
        variant="destructive"
      />

      {/* Delete Draft Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(deletingPayment)}
        onClose={() => setDeletingPayment(null)}
        onConfirm={handleDeleteAction}
        title="Delete Payment Disbursement"
        itemName={deletingPayment?.paymentNumber}
        description={
          <span>
            Are you sure you want to delete disbursement{" "}
            <strong>{deletingPayment?.paymentNumber}</strong>?
          </span>
        }
        confirmText="Delete"
        variant="destructive"
      />
    </div>
  );
}
