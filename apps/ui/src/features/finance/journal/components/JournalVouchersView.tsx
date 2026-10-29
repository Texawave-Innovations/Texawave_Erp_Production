"use client";

import { useMemo, useState } from "react";
import type {
  CreateFinanceJournalEntryInput,
  FinanceAccount,
  FinanceJournalEntry,
  FinanceJournalEntryStatus,
  FinanceJournalEntryType,
} from "@texawave-erp/api-types";
import {
  FINANCE_JOURNAL_ENTRY_STATUSES,
  FINANCE_JOURNAL_ENTRY_TYPES,
} from "@texawave-erp/api-types";
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
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  TableSkeleton,
  useToast,
} from "@texawave-erp/ui-kit";
import { Check, Eye, Plus, RotateCcw, Scale, Trash2 } from "lucide-react";
import { useDebouncedValue } from "@/features/hr/employees/hooks";
import { usePermission } from "@/hooks/usePermission";
import { formatDate, formatMoney } from "../../shared/format";
import { useAccounts } from "../../../finance/coa/hooks";
import {
  useDeleteJournalEntry,
  useJournalEntries,
  usePostJournalEntry,
  useReverseJournalEntry,
} from "../hooks";
import {
  FINANCE_JOURNAL_POST,
  FINANCE_JOURNAL_READ,
  FINANCE_JOURNAL_WRITE,
} from "../permissions";
import { CreateJournalDialog } from "./CreateJournalDialog";
import { JournalDetailDialog } from "./JournalDetailDialog";
import { JournalEntryStatusBadge } from "./JournalEntryStatusBadge";
import { JournalEntryTypeBadge } from "./JournalEntryTypeBadge";
import { ReverseJournalDialog } from "./ReverseJournalDialog";

const PAGE_SIZE = 15;

export interface JournalVouchersViewProps {
  hideHeader?: boolean;
}

export function JournalVouchersView({
  hideHeader = false,
}: JournalVouchersViewProps = {}) {
  const canRead = usePermission(FINANCE_JOURNAL_READ);
  const canWrite = usePermission(FINANCE_JOURNAL_WRITE);
  const canPost = usePermission(FINANCE_JOURNAL_POST);

  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebouncedValue(searchTerm, 300);
  const [statusFilter, setStatusFilter] = useState<
    FinanceJournalEntryStatus | "ALL"
  >("ALL");
  const [typeFilter, setTypeFilter] = useState<FinanceJournalEntryType | "ALL">(
    "ALL",
  );
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Modals state
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] =
    useState<FinanceJournalEntry | null>(null);
  const [postingEntry, setPostingEntry] = useState<FinanceJournalEntry | null>(
    null,
  );
  const [reversingEntry, setReversingEntry] =
    useState<FinanceJournalEntry | null>(null);
  const [deletingEntry, setDeletingEntry] =
    useState<FinanceJournalEntry | null>(null);

  const { toast } = useToast();

  const queryParams = useMemo(() => {
    return {
      page,
      limit: PAGE_SIZE,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
      ...(typeFilter !== "ALL" ? { entryType: typeFilter } : {}),
      ...(startDate ? { startDate } : {}),
      ...(endDate ? { endDate } : {}),
    };
  }, [page, debouncedSearch, statusFilter, typeFilter, startDate, endDate]);

  const journalQuery = useJournalEntries(queryParams);
  const accountsQuery = useAccounts({ limit: 100, isActive: true });

  const postMutation = usePostJournalEntry();
  const reverseMutation = useReverseJournalEntry();
  const deleteMutation = useDeleteJournalEntry();

  const rawEntries = useMemo(
    () => journalQuery.data?.data ?? [],
    [journalQuery.data?.data],
  );
  const meta = journalQuery.data?.meta;

  const accountsList: FinanceAccount[] = useMemo(
    () => accountsQuery.data?.data ?? [],
    [accountsQuery.data?.data],
  );

  const handleCreateSubmit = async (values: CreateFinanceJournalEntryInput) => {
    try {
      const { createJournalEntry } = await import("../api");
      await createJournalEntry(values);
      toast({
        title: "Journal voucher created as draft",
        variant: "success",
      });
      void journalQuery.refetch();
    } catch (err: unknown) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Could not create journal voucher. Please verify balances and try again.";
      toast({
        title: msg,
        variant: "error",
      });
      throw err;
    }
  };

  const handlePostConfirm = async () => {
    if (!postingEntry) return;
    try {
      await postMutation.mutateAsync(postingEntry.id);
      toast({
        title: `Voucher ${postingEntry.entryNumber} posted to General Ledger`,
        variant: "success",
      });
      setPostingEntry(null);
      if (selectedEntry?.id === postingEntry.id) {
        setSelectedEntry(null);
      }
      void journalQuery.refetch();
    } catch (err: unknown) {
      toast({
        title:
          err instanceof Error
            ? err.message
            : "Failed to post voucher to ledger",
        variant: "error",
      });
    }
  };

  const handleReverseConfirm = async (payload: {
    reversalDate?: string | undefined;
    reason: string;
  }) => {
    if (!reversingEntry) return;
    try {
      await reverseMutation.mutateAsync({
        id: reversingEntry.id,
        input: payload,
      });
      toast({
        title: `Voucher ${reversingEntry.entryNumber} reversed successfully`,
        variant: "success",
      });
      setReversingEntry(null);
      if (selectedEntry?.id === reversingEntry.id) {
        setSelectedEntry(null);
      }
      void journalQuery.refetch();
    } catch (err: unknown) {
      toast({
        title: err instanceof Error ? err.message : "Failed to reverse voucher",
        variant: "error",
      });
      throw err;
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingEntry) return;
    try {
      await deleteMutation.mutateAsync(deletingEntry.id);
      toast({
        title: `Draft voucher ${deletingEntry.entryNumber} deleted`,
        variant: "success",
      });
      setDeletingEntry(null);
      void journalQuery.refetch();
    } catch (err: unknown) {
      toast({
        title: err instanceof Error ? err.message : "Failed to delete voucher",
        variant: "error",
      });
    }
  };

  const columns: DataTableColumn<FinanceJournalEntry>[] = [
    {
      header: "Voucher #",
      sortable: true,
      cell: (row) => (
        <button
          type="button"
          onClick={() => setSelectedEntry(row)}
          className="font-semibold text-theme-sm text-blue-600 hover:text-blue-800 dark:text-sky-400 dark:hover:text-sky-300 hover:underline text-left"
        >
          {row.entryNumber}
        </button>
      ),
    },
    {
      header: "Date",
      cell: (row) => (
        <span className="text-theme-sm text-gray-700 dark:text-gray-300">
          {formatDate(row.entryDate)}
        </span>
      ),
    },
    {
      header: "Type",
      cell: (row) => <JournalEntryTypeBadge type={row.entryType} />,
    },
    {
      header: "Narration & Reference",
      cell: (row) => (
        <div className="flex flex-col min-w-0 max-w-sm">
          <span className="font-medium text-theme-sm text-gray-900 dark:text-white truncate">
            {row.narration}
          </span>
          {row.referenceNumber ? (
            <span className="text-theme-xs text-gray-500 dark:text-gray-400 truncate">
              Ref: {row.referenceNumber}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      header: "Debit",
      align: "right",
      cell: (row) => (
        <span className="font-semibold text-theme-sm text-gray-900 dark:text-white">
          {formatMoney(row.totalDebit)}
        </span>
      ),
    },
    {
      header: "Credit",
      align: "right",
      cell: (row) => (
        <span className="font-semibold text-theme-sm text-gray-900 dark:text-white">
          {formatMoney(row.totalCredit)}
        </span>
      ),
    },
    {
      header: "Status",
      cell: (row) => <JournalEntryStatusBadge status={row.status} />,
    },
    {
      header: "Actions",
      align: "right",
      cell: (row) => {
        const actionItems = [
          {
            label: "View Details",
            icon: <Eye className="h-4 w-4" />,
            onClick: () => setSelectedEntry(row),
          },
        ];

        if (row.status === "DRAFT" && canPost) {
          actionItems.push({
            label: "Post Voucher",
            icon: <Check className="h-4 w-4 text-emerald-600" />,
            onClick: () => setPostingEntry(row),
          });
        }

        if (row.status === "POSTED" && canPost) {
          actionItems.push({
            label: "Reverse Voucher",
            icon: <RotateCcw className="h-4 w-4 text-amber-600" />,
            onClick: () => setReversingEntry(row),
          });
        }

        if (row.status === "DRAFT" && canWrite) {
          actionItems.push({
            label: "Delete Draft",
            icon: <Trash2 className="h-4 w-4 text-rose-600" />,
            onClick: () => setDeletingEntry(row),
          });
        }

        return (
          <ActionMenu
            ariaLabel={`Actions for ${row.entryNumber}`}
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
        description="You do not have permission to view journal entries (finance.journal.read). Please contact your administrator for access."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      {!hideHeader && (
        <PageHeader
          title="Journal Entries"
          description="Sequential double-entry vouchers, audit trails, and posting workflows."
          badge={
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 text-theme-xs font-semibold">
              <Scale className="h-3.5 w-3.5" />
              <span>Double-Entry Vouchers</span>
            </div>
          }
          action={
            canWrite ? (
              <Button
                onClick={() => setCreateOpen(true)}
                className="gap-2"
                aria-label="New Journal Voucher"
              >
                <Plus className="h-4 w-4" />
                <span>New Journal Voucher</span>
              </Button>
            ) : undefined
          }
        />
      )}

      {/* Toolbar & Filters */}
      <div className="flex flex-col gap-3 rounded-2xl border border-gray-200/80 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-5 items-center">
          <div className="w-full">
            <SearchInput
              placeholder="Search voucher #, narration, ref..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              onClear={() => setSearchTerm("")}
            />
          </div>

          <div className="w-full">
            <Select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(
                  e.target.value as FinanceJournalEntryStatus | "ALL",
                );
                setPage(1);
              }}
            >
              <option value="ALL">All Statuses</option>
              {FINANCE_JOURNAL_ENTRY_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </Select>
          </div>

          <div className="w-full">
            <Select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(
                  e.target.value as FinanceJournalEntryType | "ALL",
                );
                setPage(1);
              }}
            >
              <option value="ALL">All Entry Types</option>
              {FINANCE_JOURNAL_ENTRY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>
          </div>

          <div className="w-full">
            <Input
              type="date"
              placeholder="Start Date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div className="w-full">
            <Input
              type="date"
              placeholder="End Date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
      </div>

      {/* Table Area */}
      <div className="flex flex-col gap-4">
        <div className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-xs dark:border-gray-800 dark:bg-gray-900">
          {journalQuery.isPending ? (
            <TableSkeleton columnsCount={8} rowsCount={6} />
          ) : journalQuery.isError ? (
            <div className="p-8">
              <ErrorState
                title="Failed to load journal entries"
                description="Unable to fetch journal voucher records from the server."
                onRetry={() => void journalQuery.refetch()}
              />
            </div>
          ) : rawEntries.length === 0 ? (
            <div className="p-8">
              <EmptyState
                title="No journal vouchers found"
                description={
                  debouncedSearch ||
                  statusFilter !== "ALL" ||
                  typeFilter !== "ALL" ||
                  startDate ||
                  endDate
                    ? "No vouchers match your current filters. Try resetting search or date ranges."
                    : "No journal vouchers recorded yet. Record your first balanced voucher entry."
                }
                action={
                  canWrite &&
                  !debouncedSearch &&
                  statusFilter === "ALL" &&
                  typeFilter === "ALL" &&
                  !startDate &&
                  !endDate ? (
                    <Button
                      onClick={() => setCreateOpen(true)}
                      className="gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Create Voucher</span>
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <DataTable
              columns={columns}
              rows={rawEntries}
              getRowKey={(row) => String(row.id)}
            />
          )}
        </div>

        {meta && meta.totalPages > 1 ? (
          <div className="flex justify-end">
            <Pagination
              page={page}
              totalPages={meta.totalPages}
              onPageChange={setPage}
            />
          </div>
        ) : null}
      </div>

      {/* Create Journal Voucher Dialog */}
      <CreateJournalDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        accounts={accountsList}
        onSubmit={handleCreateSubmit}
      />

      {/* Voucher Detail Dialog */}
      <JournalDetailDialog
        open={Boolean(selectedEntry)}
        onClose={() => setSelectedEntry(null)}
        entry={selectedEntry}
        canPost={canPost}
        onPostClick={(entry) => setPostingEntry(entry)}
        onReverseClick={(entry) => setReversingEntry(entry)}
      />

      {/* Post Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(postingEntry)}
        onClose={() => setPostingEntry(null)}
        onConfirm={handlePostConfirm}
        title="Post Voucher to General Ledger"
        itemName={postingEntry?.entryNumber}
        description={
          <span>
            Are you sure you want to post voucher{" "}
            <strong>{postingEntry?.entryNumber}</strong>? Posting permanently
            synchronizes line amounts to respective account ledger balances.
            This action is immutable and can only be undone via formal reversal.
          </span>
        }
        confirmText="Post Voucher"
        variant="primary"
        loading={postMutation.isPending}
      />

      {/* Reverse Voucher Dialog */}
      <ReverseJournalDialog
        open={Boolean(reversingEntry)}
        onClose={() => setReversingEntry(null)}
        entry={reversingEntry}
        onConfirm={handleReverseConfirm}
        loading={reverseMutation.isPending}
      />

      {/* Delete Draft Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(deletingEntry)}
        onClose={() => setDeletingEntry(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Draft Voucher"
        itemName={deletingEntry?.entryNumber}
        description={
          <span>
            Are you sure you want to delete draft voucher{" "}
            <strong>{deletingEntry?.entryNumber}</strong>? This will permanently
            remove the unposted draft.
          </span>
        }
        confirmText="Delete Draft"
        variant="destructive"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
