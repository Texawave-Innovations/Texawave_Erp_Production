"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  FinanceAccount,
  FinanceAccountType,
} from "@texawave-erp/api-types";
import { FINANCE_ACCOUNT_TYPES } from "@texawave-erp/api-types";
import { ApiError } from "@texawave-erp/core";
import {
  ActionMenu,
  type ActionMenuItem,
  Button,
  ConfirmDialog,
  DataTable,
  type DataTableColumn,
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  StatusBadge,
  TableSkeleton,
  useToast,
} from "@texawave-erp/ui-kit";
import {
  BookOpen,
  FolderTree,
  Landmark,
  List,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useDebouncedValue } from "@/features/hr/employees/hooks";
import { usePermission } from "@/hooks/usePermission";
import { formatMoney } from "../../shared/format";
import {
  useAccounts,
  useAccountTree,
  useCreateAccount,
  useDeleteAccount,
  useUpdateAccount,
} from "../hooks";
import { FINANCE_COA_READ, FINANCE_COA_WRITE } from "../permissions";
import { AccountBadge } from "./AccountBadge";
import { AccountDialog } from "./AccountDialog";
import { AccountTree } from "./AccountTree";
import type {
  CreateFinanceAccountFormValues,
  UpdateFinanceAccountFormValues,
} from "../schema";

const PAGE_SIZE = 15;

export interface AccountsViewProps {
  hideHeader?: boolean;
}

export function AccountsView({ hideHeader = false }: AccountsViewProps = {}) {
  const router = useRouter();
  const canRead = usePermission(FINANCE_COA_READ);
  const canWrite = usePermission(FINANCE_COA_WRITE);

  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebouncedValue(searchTerm, 300);
  const [accountTypeFilter, setAccountTypeFilter] = useState<
    FinanceAccountType | "ALL"
  >("ALL");
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "ACTIVE" | "INACTIVE"
  >("ALL");
  const [viewMode, setViewMode] = useState<"table" | "tree">("table");

  // Dialog states
  const [createOpen, setCreateOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<FinanceAccount | null>(
    null,
  );
  const [deletingAccount, setDeletingAccount] = useState<FinanceAccount | null>(
    null,
  );
  const [presetParent, setPresetParent] = useState<FinanceAccount | null>(null);

  const { toast } = useToast();

  const queryParams = useMemo(() => {
    return {
      page,
      limit: PAGE_SIZE,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      ...(accountTypeFilter !== "ALL"
        ? { accountType: accountTypeFilter }
        : {}),
      ...(statusFilter === "ACTIVE"
        ? { isActive: true }
        : statusFilter === "INACTIVE"
          ? { isActive: false }
          : {}),
    };
  }, [page, debouncedSearch, accountTypeFilter, statusFilter]);

  const accountsQuery = useAccounts(queryParams);
  const treeQuery = useAccountTree();

  const createMutation = useCreateAccount();
  const updateMutation = useUpdateAccount();
  const deleteMutation = useDeleteAccount();

  const rawAccounts = useMemo(
    () => accountsQuery.data?.data ?? [],
    [accountsQuery.data?.data],
  );
  const meta = accountsQuery.data?.meta;

  const allParentCandidates = useMemo(() => {
    return rawAccounts;
  }, [rawAccounts]);

  const handleOpenCreateChild = (parent: FinanceAccount) => {
    setPresetParent(parent);
    setCreateOpen(true);
  };

  const handleCreateSubmit = async (
    values: CreateFinanceAccountFormValues | UpdateFinanceAccountFormValues,
  ) => {
    const val = values as CreateFinanceAccountFormValues;
    try {
      await createMutation.mutateAsync({
        accountCode: val.accountCode,
        accountName: val.accountName,
        accountType: val.accountType,
        parentAccountId: val.parentAccountId ?? null,
        currency: val.currency ?? "INR",
        description: val.description ?? null,
      });
      toast({
        title: "Account created successfully",
        variant: "success",
      });
      setPresetParent(null);
      void accountsQuery.refetch();
      void treeQuery.refetch();
    } catch (err: unknown) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Could not create account. Please verify input and try again.";
      toast({
        title: msg,
        variant: "error",
      });
      throw err;
    }
  };

  const handleUpdateSubmit = async (
    values: CreateFinanceAccountFormValues | UpdateFinanceAccountFormValues,
  ) => {
    if (!editingAccount) return;
    const val = values as UpdateFinanceAccountFormValues;
    try {
      await updateMutation.mutateAsync({
        id: editingAccount.id,
        input: {
          accountCode: val.accountCode,
          accountName: val.accountName,
          parentAccountId: val.parentAccountId ?? null,
          currency: val.currency,
          description: val.description ?? null,
          isActive: val.isActive,
        },
      });
      toast({
        title: "Account updated successfully",
        variant: "success",
      });
      setEditingAccount(null);
      void accountsQuery.refetch();
      void treeQuery.refetch();
    } catch (err: unknown) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Could not update account. Please try again.";
      toast({
        title: msg,
        variant: "error",
      });
      throw err;
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingAccount) return;
    try {
      await deleteMutation.mutateAsync(deletingAccount.id);
      toast({
        title: `Account ${deletingAccount.accountCode} deactivated`,
        variant: "success",
      });
      setDeletingAccount(null);
      void accountsQuery.refetch();
      void treeQuery.refetch();
    } catch (err: unknown) {
      toast({
        title:
          err instanceof Error ? err.message : "Could not deactivate account",
        variant: "error",
      });
    }
  };

  const columns: DataTableColumn<FinanceAccount>[] = [
    {
      header: "Account Code",
      sortable: true,
      cell: (row) => (
        <span className="font-semibold text-theme-sm text-gray-900 dark:text-white">
          {row.accountCode}
        </span>
      ),
    },
    {
      header: "Account Name",
      cell: (row) => (
        <div className="flex flex-col min-w-0 max-w-xs">
          <span className="font-medium text-theme-sm text-gray-900 dark:text-white truncate">
            {row.accountName}
          </span>
          {row.description ? (
            <span className="text-theme-xs text-gray-500 dark:text-gray-400 truncate">
              {row.description}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      header: "Classification",
      cell: (row) => <AccountBadge type={row.accountType} />,
    },
    {
      header: "Parent Account",
      cell: (row) => (
        <span className="text-theme-sm text-gray-600 dark:text-gray-300">
          {row.parentAccount
            ? `${row.parentAccount.accountCode} — ${row.parentAccount.accountName}`
            : "—"}
        </span>
      ),
    },
    {
      header: "Balance",
      align: "right",
      cell: (row) => (
        <span className="font-semibold text-theme-sm text-gray-900 dark:text-white">
          {formatMoney(row.currentBalance, row.currency)}
        </span>
      ),
    },
    {
      header: "Status",
      cell: (row) => (
        <StatusBadge
          label={row.isActive ? "Active" : "Inactive"}
          colorToken={row.isActive ? "success" : "gray"}
        />
      ),
    },
    {
      header: "Actions",
      align: "right",
      cell: (row) => {
        const actionItems: ActionMenuItem[] = [
          {
            label: "View Ledger",
            icon: <BookOpen className="h-4 w-4" />,
            onClick: () =>
              router.push(`/finance/general-ledger?accountId=${row.id}`),
          },
        ];

        if (canWrite) {
          actionItems.push(
            {
              label: "Edit Account",
              icon: <Pencil className="h-4 w-4" />,
              onClick: () => setEditingAccount(row),
            },
            {
              label: "Add Child Account",
              icon: <Plus className="h-4 w-4" />,
              onClick: () => handleOpenCreateChild(row),
            },
            {
              label: "Deactivate",
              variant: "destructive",
              icon: <Trash2 className="h-4 w-4" />,
              onClick: () => setDeletingAccount(row),
            },
          );
        }

        return (
          <ActionMenu
            ariaLabel={`Actions for ${row.accountName}`}
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
        description="You do not have permission to view the Chart of Accounts (finance.coa.read). Please contact your administrator for access."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      {!hideHeader && (
        <PageHeader
          title="Chart of Accounts"
          description="Master ledger classifications, account numbering, hierarchical structures, and live balances."
          badge={
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 text-theme-xs font-semibold">
              <Landmark className="h-3.5 w-3.5" />
              <span>General Ledger</span>
            </div>
          }
          action={
            canWrite ? (
              <Button
                onClick={() => {
                  setPresetParent(null);
                  setCreateOpen(true);
                }}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                <span>Add Account</span>
              </Button>
            ) : undefined
          }
        />
      )}

      {/* Toolbar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-gray-200/80 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="w-full sm:w-72">
            <SearchInput
              placeholder="Search code or account name..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              onClear={() => setSearchTerm("")}
            />
          </div>

          <div className="w-full sm:w-52">
            <Select
              value={accountTypeFilter}
              onChange={(e) => {
                setAccountTypeFilter(
                  e.target.value as FinanceAccountType | "ALL",
                );
                setPage(1);
              }}
            >
              <option value="ALL">All Classifications</option>
              {FINANCE_ACCOUNT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>
          </div>

          <div className="w-full sm:w-40">
            <Select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(
                  e.target.value as "ALL" | "ACTIVE" | "INACTIVE",
                );
                setPage(1);
              }}
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </Select>
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1.5 self-end sm:self-auto border border-gray-200 dark:border-gray-800 rounded-xl p-1 bg-gray-50/80 dark:bg-gray-950/50">
          <button
            type="button"
            onClick={() => setViewMode("table")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-theme-xs font-semibold transition-colors ${
              viewMode === "table"
                ? "bg-white text-blue-600 shadow-xs dark:bg-gray-800 dark:text-sky-400"
                : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            }`}
          >
            <List className="h-3.5 w-3.5" />
            <span>Table</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("tree")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-theme-xs font-semibold transition-colors ${
              viewMode === "tree"
                ? "bg-white text-blue-600 shadow-xs dark:bg-gray-800 dark:text-sky-400"
                : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            }`}
          >
            <FolderTree className="h-3.5 w-3.5" />
            <span>Hierarchy Tree</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {viewMode === "table" ? (
        <div className="flex flex-col gap-4">
          <div className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-xs dark:border-gray-800 dark:bg-gray-900">
            {accountsQuery.isPending ? (
              <TableSkeleton columnsCount={7} rowsCount={6} />
            ) : accountsQuery.isError ? (
              <div className="p-8">
                <ErrorState
                  title="Failed to load accounts"
                  description="We were unable to load the Chart of Accounts list from the server."
                  onRetry={() => void accountsQuery.refetch()}
                />
              </div>
            ) : rawAccounts.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  title="No accounts found"
                  description={
                    debouncedSearch ||
                    accountTypeFilter !== "ALL" ||
                    statusFilter !== "ALL"
                      ? "No ledger accounts match your current filters. Try resetting search or filter options."
                      : "No ledger accounts have been configured yet. Create your first Chart of Accounts entry."
                  }
                  action={
                    canWrite &&
                    !debouncedSearch &&
                    accountTypeFilter === "ALL" &&
                    statusFilter === "ALL" ? (
                      <Button
                        onClick={() => {
                          setPresetParent(null);
                          setCreateOpen(true);
                        }}
                        className="gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        <span>Add Account</span>
                      </Button>
                    ) : undefined
                  }
                />
              </div>
            ) : (
              <DataTable
                columns={columns}
                rows={rawAccounts}
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
      ) : (
        <div className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-xs dark:border-gray-800 dark:bg-gray-900">
          {treeQuery.isPending ? (
            <TableSkeleton columnsCount={4} rowsCount={6} />
          ) : treeQuery.isError ? (
            <ErrorState
              title="Failed to load account hierarchy"
              description="Unable to fetch the hierarchical tree structure."
              onRetry={() => void treeQuery.refetch()}
            />
          ) : (
            <AccountTree
              nodes={treeQuery.data ?? []}
              canWrite={canWrite}
              onEdit={(account) => setEditingAccount(account)}
              onDelete={(account) => setDeletingAccount(account)}
              onAddChild={(parent) => handleOpenCreateChild(parent)}
            />
          )}
        </div>
      )}

      {/* Create Account Dialog */}
      <AccountDialog
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          setPresetParent(null);
        }}
        parentAccounts={allParentCandidates}
        defaultParentId={presetParent ? presetParent.id : null}
        defaultType={presetParent ? presetParent.accountType : "ASSET"}
        onSubmit={handleCreateSubmit}
      />

      {/* Edit Account Dialog */}
      <AccountDialog
        open={Boolean(editingAccount)}
        onClose={() => setEditingAccount(null)}
        account={editingAccount}
        parentAccounts={allParentCandidates}
        onSubmit={handleUpdateSubmit}
      />

      {/* Delete / Deactivate Confirm Dialog */}
      <ConfirmDialog
        open={Boolean(deletingAccount)}
        onClose={() => setDeletingAccount(null)}
        onConfirm={handleDeleteConfirm}
        title="Deactivate Account"
        itemName={deletingAccount?.accountName}
        description={
          <span>
            Are you sure you want to deactivate account{" "}
            <strong>
              {deletingAccount?.accountCode} — {deletingAccount?.accountName}
            </strong>
            ? Deactivating prevents this account from being selected for new
            journal entries. Existing ledger transactions and audit logs are
            preserved.
          </span>
        }
        confirmText="Deactivate Account"
        variant="destructive"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
