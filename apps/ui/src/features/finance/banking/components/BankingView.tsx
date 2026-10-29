"use client";

import { useMemo, useState } from "react";
import type {
  FinanceBankAccount,
  FinanceBankAccountType,
  FinanceBankTransaction,
  FinanceBankTransactionType,
  QueryFinanceBankAccountsInput,
  QueryFinanceBankTransactionsInput,
} from "@texawave-erp/api-types";
import {
  ActionMenu,
  ConfirmDialog,
  DataTable,
  type DataTableColumn,
  EmptyState,
  ErrorState,
  Input,
  Pagination,
  SearchInput,
  Select,
  StatusBadge,
  useToast,
} from "@texawave-erp/ui-kit";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Building2,
  Check,
  Eye,
  Landmark,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Undo2,
} from "lucide-react";
import { useDebouncedValue } from "@/features/hr/employees/hooks";
import { usePermission } from "@/hooks/usePermission";
import { formatDate, formatMoney } from "../../shared/format";
import {
  useBankAccounts,
  useBankTransactions,
  useDeleteBankAccount,
  useUnreconcileBankTransaction,
} from "../hooks";
import { FINANCE_BANKING_READ, FINANCE_BANKING_WRITE } from "../permissions";
import { AddBankAccountDialog } from "./AddBankAccountDialog";
import { BankAccountDetailDialog } from "./BankAccountDetailDialog";
import { BankTransactionDetailDialog } from "./BankTransactionDetailDialog";
import { BankingSummaryCards } from "./BankingSummaryCards";
import { EditBankAccountDialog } from "./EditBankAccountDialog";
import { ReconcileTransactionModal } from "./ReconcileTransactionModal";
import { RecordTransactionDialog } from "./RecordTransactionDialog";

const PAGE_SIZE = 15;

export function BankingView() {
  const canRead = usePermission(FINANCE_BANKING_READ);
  const canWrite = usePermission(FINANCE_BANKING_WRITE);
  const { toast } = useToast();

  // Active subtab: "accounts" | "transactions"
  const [activeTab, setActiveTab] = useState<"accounts" | "transactions">(
    "accounts",
  );

  // Accounts Tab Filters
  const [accountsPage, setAccountsPage] = useState(1);
  const [accountSearch, setAccountSearch] = useState("");
  const debouncedAccountSearch = useDebouncedValue(accountSearch, 300);
  const [accountTypeFilter, setAccountTypeFilter] = useState<
    FinanceBankAccountType | "ALL"
  >("ALL");
  const [accountStatusFilter, setAccountStatusFilter] = useState<
    "ALL" | "ACTIVE" | "INACTIVE"
  >("ALL");

  // Transactions Tab Filters
  const [transactionsPage, setTransactionsPage] = useState(1);
  const [transactionSearch, setTransactionSearch] = useState("");
  const debouncedTransactionSearch = useDebouncedValue(transactionSearch, 300);
  const [filterBankAccountId, setFilterBankAccountId] = useState<number | "">(
    "",
  );
  const [transactionTypeFilter, setTransactionTypeFilter] = useState<
    FinanceBankTransactionType | "ALL"
  >("ALL");
  const [reconciliationFilter, setReconciliationFilter] = useState<
    "ALL" | "RECONCILED" | "UNRECONCILED"
  >("ALL");
  const [transactionMonth, setTransactionMonth] = useState("");

  // Dialogs State
  const [addAccountOpen, setAddAccountOpen] = useState(false);
  const [recordTxOpen, setRecordTxOpen] = useState(false);
  const [selectedBankAccountIdForTx, setSelectedBankAccountIdForTx] = useState<
    number | undefined
  >(undefined);
  const [detailAccount, setDetailAccount] = useState<FinanceBankAccount | null>(
    null,
  );
  const [editingAccount, setEditingAccount] =
    useState<FinanceBankAccount | null>(null);
  const [deletingAccount, setDeletingAccount] =
    useState<FinanceBankAccount | null>(null);
  const [reconcilingTx, setReconcilingTx] =
    useState<FinanceBankTransaction | null>(null);
  const [unreconcilingTx, setUnreconcilingTx] =
    useState<FinanceBankTransaction | null>(null);
  const [detailTx, setDetailTx] = useState<FinanceBankTransaction | null>(null);

  // Mutations
  const deleteAccountMutation = useDeleteBankAccount();
  const unreconcileMutation = useUnreconcileBankTransaction();

  // Build Accounts Query Params
  const accountsQueryParams = useMemo<QueryFinanceBankAccountsInput>(() => {
    const q: QueryFinanceBankAccountsInput = {
      page: accountsPage,
      limit: PAGE_SIZE,
    };
    if (debouncedAccountSearch.trim()) {
      q.search = debouncedAccountSearch.trim();
    }
    if (accountTypeFilter !== "ALL") {
      q.accountType = accountTypeFilter;
    }
    if (accountStatusFilter === "ACTIVE") {
      q.isActive = true;
    } else if (accountStatusFilter === "INACTIVE") {
      q.isActive = false;
    }
    return q;
  }, [
    accountsPage,
    debouncedAccountSearch,
    accountTypeFilter,
    accountStatusFilter,
  ]);

  const accountsQuery = useBankAccounts(accountsQueryParams);

  // Build Transactions Query Params
  const transactionsQueryParams =
    useMemo<QueryFinanceBankTransactionsInput>(() => {
      const q: QueryFinanceBankTransactionsInput = {
        page: transactionsPage,
        limit: PAGE_SIZE,
      };
      if (debouncedTransactionSearch.trim()) {
        q.search = debouncedTransactionSearch.trim();
      }
      if (filterBankAccountId) {
        q.bankAccountId = Number(filterBankAccountId);
      }
      if (transactionTypeFilter !== "ALL") {
        q.transactionType = transactionTypeFilter;
      }
      if (reconciliationFilter === "RECONCILED") {
        q.isReconciled = true;
      } else if (reconciliationFilter === "UNRECONCILED") {
        q.isReconciled = false;
      }
      if (transactionMonth) {
        const [year, month] = transactionMonth.split("-").map(Number);
        if (year && month) {
          const start = new Date(Date.UTC(year, month - 1, 1));
          const end = new Date(Date.UTC(year, month, 0));
          q.startDate = start.toISOString().slice(0, 10);
          q.endDate = end.toISOString().slice(0, 10);
        }
      }
      return q;
    }, [
      transactionsPage,
      debouncedTransactionSearch,
      filterBankAccountId,
      transactionTypeFilter,
      reconciliationFilter,
      transactionMonth,
    ]);

  const transactionsQuery = useBankTransactions(transactionsQueryParams);

  // Safe data arrays
  const rawAccounts = useMemo(() => {
    return accountsQuery.data?.data ?? [];
  }, [accountsQuery.data?.data]);

  const accountsMeta = accountsQuery.data?.meta;

  const rawTransactions = useMemo(() => {
    return transactionsQuery.data?.data ?? [];
  }, [transactionsQuery.data?.data]);

  const transactionsMeta = transactionsQuery.data?.meta;

  // Active accounts list for transaction recording modal & filter dropdown
  const activeBankAccounts = useMemo(() => {
    return rawAccounts.filter((a) => a.isActive);
  }, [rawAccounts]);

  // Handlers
  const handleDeleteAccount = async () => {
    if (!deletingAccount) return;
    try {
      await deleteAccountMutation.mutateAsync(deletingAccount.id);
      toast({
        title: `Bank account ${deletingAccount.accountName} archived`,
        variant: "success",
      });
      setDeletingAccount(null);
      void accountsQuery.refetch();
    } catch (err: unknown) {
      toast({
        title:
          err instanceof Error
            ? err.message
            : "Failed to delete bank account. Accounts with recorded transactions cannot be deleted.",
        variant: "error",
      });
    }
  };

  const handleUnreconcileTransaction = async () => {
    if (!unreconcilingTx) return;
    try {
      await unreconcileMutation.mutateAsync(unreconcilingTx.id);
      toast({
        title: `Transaction #${unreconcilingTx.id} unmarked from reconciliation`,
        variant: "success",
      });
      setUnreconcilingTx(null);
      void transactionsQuery.refetch();
    } catch (err: unknown) {
      toast({
        title:
          err instanceof Error
            ? err.message
            : "Failed to unreconcile transaction",
        variant: "error",
      });
    }
  };

  // Columns for Bank Accounts DataTable
  const accountColumns: DataTableColumn<FinanceBankAccount>[] = [
    {
      header: "ACCOUNT NAME",
      sortable: true,
      cell: (row) => (
        <div className="flex flex-col">
          <button
            type="button"
            onClick={() => setDetailAccount(row)}
            className="font-bold text-theme-sm text-[#1769F5] hover:text-[#0a3271] dark:text-sky-400 dark:hover:text-sky-300 hover:underline text-left cursor-pointer"
          >
            {row.accountName}
          </button>
          <span className="text-theme-xs text-gray-500 dark:text-gray-400">
            {row.bankName}
          </span>
        </div>
      ),
    },
    {
      header: "ACCOUNT NUMBER",
      cell: (row) => (
        <span className="font-semibold text-theme-sm text-gray-900 dark:text-white">
          {row.accountNumber}
        </span>
      ),
    },
    {
      header: "TYPE",
      cell: (row) => <StatusBadge label={row.accountType} colorToken="brand" />,
    },
    {
      header: "IFSC / BRANCH",
      cell: (row) => (
        <div className="flex flex-col text-theme-xs text-gray-600 dark:text-gray-300">
          <span className="font-medium text-gray-900 dark:text-white">
            {row.ifscCode}
          </span>
          <span>{row.branchName || "—"}</span>
        </div>
      ),
    },
    {
      header: "CURRENT BALANCE",
      sortable: true,
      cell: (row) => {
        const bal = Number(row.currentBalance || 0);
        return (
          <span
            className={`font-bold text-theme-sm ${
              bal < 0
                ? "text-rose-600 dark:text-rose-400"
                : "text-gray-900 dark:text-white"
            }`}
          >
            {formatMoney(row.currentBalance, row.currency)}
          </span>
        );
      },
    },
    {
      header: "LINKED GL ACCOUNT",
      cell: (row) =>
        row.glAccount ? (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-2 py-1 text-theme-xs font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-sky-300 border border-blue-200/50 dark:border-blue-900/40">
            [{row.glAccount.accountCode}] {row.glAccount.accountName}
          </span>
        ) : (
          <span className="text-theme-xs text-gray-400 dark:text-gray-500">
            Unlinked
          </span>
        ),
    },
    {
      header: "STATUS",
      cell: (row) => (
        <StatusBadge
          label={row.isActive ? "Active" : "Archived"}
          colorToken={row.isActive ? "success" : "gray"}
        />
      ),
    },
    {
      header: "",
      cell: (row) => {
        const actionItems = [
          {
            label: "View Account Details",
            icon: <Eye className="h-4 w-4" />,
            onClick: () => setDetailAccount(row),
          },
        ];

        if (canWrite) {
          actionItems.push({
            label: "Record Transaction",
            icon: <ArrowLeftRight className="h-4 w-4 text-[#1769F5]" />,
            onClick: () => {
              setSelectedBankAccountIdForTx(row.id);
              setRecordTxOpen(true);
            },
          });

          actionItems.push({
            label: "Edit Account",
            icon: <Pencil className="h-4 w-4 text-blue-600" />,
            onClick: () => setEditingAccount(row),
          });

          actionItems.push({
            label: "Archive / Delete",
            icon: <Trash2 className="h-4 w-4 text-rose-600" />,
            onClick: () => setDeletingAccount(row),
          });
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

  // Columns for Bank Transactions DataTable
  const transactionColumns: DataTableColumn<FinanceBankTransaction>[] = [
    {
      header: "DATE",
      sortable: true,
      cell: (row) => (
        <button
          type="button"
          onClick={() => setDetailTx(row)}
          className="font-bold text-theme-sm text-[#1769F5] hover:text-[#0a3271] dark:text-sky-400 dark:hover:text-sky-300 hover:underline text-left cursor-pointer"
        >
          {formatDate(row.transactionDate)}
        </button>
      ),
    },
    {
      header: "REF / UTR",
      cell: (row) => (
        <span className="font-semibold text-theme-xs text-gray-700 dark:text-gray-300">
          {row.referenceNumber || "—"}
        </span>
      ),
    },
    {
      header: "BANK ACCOUNT",
      cell: (row) => (
        <span className="font-medium text-theme-sm text-gray-900 dark:text-white">
          {row.bankAccount?.accountName ?? `Account #${row.bankAccountId}`}
        </span>
      ),
    },
    {
      header: "DIRECTION",
      cell: (row) =>
        row.transactionType === "CREDIT" ? (
          <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-0.5 text-theme-xs font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-900/40">
            <ArrowDownLeft className="h-3.5 w-3.5" />
            <span>Credit (Inflow)</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-0.5 text-theme-xs font-bold text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200/50 dark:border-amber-900/40">
            <ArrowUpRight className="h-3.5 w-3.5" />
            <span>Debit (Outflow)</span>
          </span>
        ),
    },
    {
      header: "DESCRIPTION",
      cell: (row) => (
        <span className="text-theme-sm text-gray-700 dark:text-gray-300 line-clamp-1">
          {row.description}
        </span>
      ),
    },
    {
      header: "AMOUNT",
      sortable: true,
      cell: (row) => {
        const isCredit = row.transactionType === "CREDIT";
        return (
          <span
            className={`font-bold text-theme-sm ${
              isCredit
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-amber-600 dark:text-amber-400"
            }`}
          >
            {isCredit ? "+" : "-"}
            {formatMoney(row.amount)}
          </span>
        );
      },
    },
    {
      header: "BALANCE AFTER",
      cell: (row) =>
        row.balanceAfter ? (
          <span className="text-theme-sm font-semibold text-gray-900 dark:text-white">
            {formatMoney(row.balanceAfter)}
          </span>
        ) : (
          <span className="text-theme-xs text-gray-400">—</span>
        ),
    },
    {
      header: "RECONCILIATION",
      cell: (row) => (
        <StatusBadge
          label={row.isReconciled ? "Reconciled" : "Unreconciled"}
          colorToken={row.isReconciled ? "success" : "gray"}
        />
      ),
    },
    {
      header: "",
      cell: (row) => {
        const actionItems = [
          {
            label: "View Transaction",
            icon: <Eye className="h-4 w-4" />,
            onClick: () => setDetailTx(row),
          },
        ];

        if (canWrite) {
          if (!row.isReconciled) {
            actionItems.push({
              label: "Reconcile",
              icon: <Check className="h-4 w-4 text-emerald-600" />,
              onClick: () => setReconcilingTx(row),
            });
          } else {
            actionItems.push({
              label: "Unmark Reconciled",
              icon: <Undo2 className="h-4 w-4 text-amber-600" />,
              onClick: () => setUnreconcilingTx(row),
            });
          }
        }

        return (
          <ActionMenu
            ariaLabel={`Actions for transaction #${row.id}`}
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
        description="You do not have permission to view Treasury & Banking data (finance.banking.read). Please contact your administrator."
      />
    );
  }

  return (
    <div className="flex flex-col gap-5 relative focus-within:z-30">
      {/* 1. Summary Cards */}
      <BankingSummaryCards
        accounts={rawAccounts}
        transactions={rawTransactions}
        totalServerAccounts={accountsMeta?.total}
      />

      {/* 2. Hero Header Card (TexaOne Prime Blue aesthetic) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl p-6 shadow-xs text-white bg-linear-to-r from-[#0a3271] via-[#1769F5] to-[#0284c7] dark:from-[#082352] dark:via-[#0e4cb8] dark:to-[#0369a1]">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-bold tracking-tight text-white">
            Treasury & Bank Accounts
          </h2>
          <p className="text-theme-sm text-sky-100 font-medium">
            Manage company bank accounts, monitor cash balances, record
            transactions & reconcile statements
          </p>
        </div>

        {canWrite && (
          <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => {
                setSelectedBankAccountIdForTx(undefined);
                setRecordTxOpen(true);
              }}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/15 hover:bg-white/25 px-4 py-2.5 text-theme-sm font-bold text-white transition-all shadow-xs cursor-pointer border border-white/20"
            >
              <ArrowLeftRight
                className="h-4 w-4 text-sky-200"
                aria-hidden="true"
              />
              <span>Record Transaction</span>
            </button>

            <button
              type="button"
              onClick={() => setAddAccountOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-theme-sm font-bold text-[#1769F5] hover:bg-sky-50 transition-all shadow-xs cursor-pointer"
            >
              <Plus className="h-4 w-4 text-[#1769F5]" aria-hidden="true" />
              <span>Add Bank Account</span>
            </button>
          </div>
        )}
      </div>

      {/* 3. Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200/80 pb-2 dark:border-gray-800">
        <button
          type="button"
          onClick={() => setActiveTab("accounts")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-theme-sm font-bold transition-all cursor-pointer ${
            activeTab === "accounts"
              ? "bg-blue-50 text-[#1769F5] dark:bg-blue-950/60 dark:text-sky-400 border border-blue-200/60 dark:border-blue-900/50 shadow-xs"
              : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          }`}
        >
          <Building2 className="h-4 w-4" />
          <span>Bank Accounts</span>
          {accountsMeta && (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-theme-xs font-semibold text-blue-700 dark:bg-blue-900/60 dark:text-sky-300">
              {accountsMeta.total}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("transactions")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-theme-sm font-bold transition-all cursor-pointer ${
            activeTab === "transactions"
              ? "bg-blue-50 text-[#1769F5] dark:bg-blue-950/60 dark:text-sky-400 border border-blue-200/60 dark:border-blue-900/50 shadow-xs"
              : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          }`}
        >
          <ArrowLeftRight className="h-4 w-4" />
          <span>Bank Transactions</span>
          {transactionsMeta && (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-theme-xs font-semibold text-blue-700 dark:bg-blue-900/60 dark:text-sky-300">
              {transactionsMeta.total}
            </span>
          )}
        </button>
      </div>

      {/* 4. Tab Content: Bank Accounts */}
      {activeTab === "accounts" && (
        <div className="flex flex-col gap-4">
          {/* Accounts Search & Filter Bar */}
          <div className="flex flex-col gap-3 rounded-2xl border border-gray-200/80 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900 relative focus-within:z-30">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-12 items-center">
              <div className="w-full md:col-span-6">
                <SearchInput
                  value={accountSearch}
                  onChange={(e) => {
                    setAccountSearch(e.target.value);
                    setAccountsPage(1);
                  }}
                  onClear={() => {
                    setAccountSearch("");
                    setAccountsPage(1);
                  }}
                  placeholder="Search by account name, bank, or account number..."
                />
              </div>

              <div className="w-full md:col-span-3">
                <Select
                  value={accountTypeFilter}
                  onChange={(e) => {
                    setAccountTypeFilter(
                      e.target.value as FinanceBankAccountType | "ALL",
                    );
                    setAccountsPage(1);
                  }}
                >
                  <option value="ALL">All Account Types</option>
                  <option value="CURRENT">Current Account</option>
                  <option value="SAVINGS">Savings Account</option>
                  <option value="OVERDRAFT">Overdraft</option>
                </Select>
              </div>

              <div className="w-full md:col-span-3">
                <Select
                  value={accountStatusFilter}
                  onChange={(e) => {
                    setAccountStatusFilter(
                      e.target.value as "ALL" | "ACTIVE" | "INACTIVE",
                    );
                    setAccountsPage(1);
                  }}
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ACTIVE">Active Only</option>
                  <option value="INACTIVE">Archived Only</option>
                </Select>
              </div>
            </div>
          </div>

          {/* Accounts Visual Cards Grid */}
          {rawAccounts.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {rawAccounts.map((account) => (
                <div
                  key={account.id}
                  className="flex flex-col justify-between rounded-2xl border border-gray-200/80 bg-white p-5 shadow-xs dark:border-gray-800 dark:bg-gray-900 hover:border-blue-300 dark:hover:border-blue-800 transition-all"
                >
                  <div className="flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/70 dark:text-sky-400 border border-blue-200/60 dark:border-blue-900/50">
                          <Landmark className="h-5 w-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-900 dark:text-white line-clamp-1">
                            {account.accountName}
                          </h4>
                          <span className="text-theme-xs text-gray-500 dark:text-gray-400">
                            {account.bankName}
                          </span>
                        </div>
                      </div>

                      <StatusBadge
                        label={account.isActive ? "Active" : "Archived"}
                        colorToken={account.isActive ? "success" : "gray"}
                      />
                    </div>

                    <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800/60">
                      <span className="text-theme-xs text-gray-500 dark:text-gray-400">
                        Account Number
                      </span>
                      <p className="font-bold text-theme-sm text-gray-900 dark:text-white">
                        {account.accountNumber}
                      </p>
                      <div className="flex items-center justify-between pt-1 text-theme-xs text-gray-500 dark:text-gray-400">
                        <span>{account.ifscCode}</span>
                        <StatusBadge
                          label={account.accountType}
                          colorToken="brand"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3 dark:border-gray-800">
                    <div className="flex flex-col">
                      <span className="text-theme-xs text-gray-500 dark:text-gray-400">
                        Current Balance
                      </span>
                      <span className="text-lg font-black text-gray-900 dark:text-white">
                        {formatMoney(account.currentBalance, account.currency)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      {canWrite && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedBankAccountIdForTx(account.id);
                            setRecordTxOpen(true);
                          }}
                          title="Record transaction for this account"
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 cursor-pointer"
                        >
                          <ArrowLeftRight className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setDetailAccount(account)}
                        title="View account overview"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 cursor-pointer"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Accounts Table */}
          <div className="rounded-2xl border border-gray-200/80 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800 mb-3">
              <h3 className="font-bold text-gray-900 dark:text-white text-theme-base">
                Registered Bank Accounts Ledger
              </h3>
              <span className="text-theme-xs text-gray-500 dark:text-gray-400">
                {accountsMeta?.total ?? rawAccounts.length} total registered
              </span>
            </div>

            {accountsQuery.isPending ? (
              <div className="flex items-center justify-center py-12 text-gray-500">
                <RefreshCw className="h-6 w-6 animate-spin mr-2 text-blue-600" />
                <span>Loading company bank accounts...</span>
              </div>
            ) : accountsQuery.isError ? (
              <ErrorState
                title="Failed to Load Accounts"
                description={
                  accountsQuery.error instanceof Error
                    ? accountsQuery.error.message
                    : "Unable to retrieve bank accounts."
                }
              />
            ) : rawAccounts.length === 0 ? (
              <EmptyState
                title="No Bank Accounts Found"
                description={
                  accountSearch || accountTypeFilter !== "ALL"
                    ? "No bank accounts match your search filters."
                    : "No bank accounts registered yet. Onboard your primary operating account to start tracking cash flow."
                }
              />
            ) : (
              <>
                <DataTable
                  columns={accountColumns}
                  rows={rawAccounts}
                  getRowKey={(row) => String(row.id)}
                />
                {accountsMeta && accountsMeta.totalPages > 1 && (
                  <div className="pt-4 border-t border-gray-100 dark:border-gray-800 flex justify-end">
                    <Pagination
                      page={accountsPage}
                      totalPages={accountsMeta.totalPages}
                      onPageChange={setAccountsPage}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* 5. Tab Content: Bank Transactions */}
      {activeTab === "transactions" && (
        <div className="flex flex-col gap-4">
          {/* Transactions Search & Filter Bar */}
          <div className="flex flex-col gap-3 rounded-2xl border border-gray-200/80 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900 relative focus-within:z-30">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-12 items-center">
              <div className="w-full md:col-span-4">
                <SearchInput
                  value={transactionSearch}
                  onChange={(e) => {
                    setTransactionSearch(e.target.value);
                    setTransactionsPage(1);
                  }}
                  onClear={() => {
                    setTransactionSearch("");
                    setTransactionsPage(1);
                  }}
                  placeholder="Search by description, reference, or UTR..."
                />
              </div>

              <div className="w-full md:col-span-3">
                <Select
                  value={filterBankAccountId}
                  onChange={(e) => {
                    setFilterBankAccountId(
                      e.target.value ? Number(e.target.value) : "",
                    );
                    setTransactionsPage(1);
                  }}
                >
                  <option value="">All Bank Accounts</option>
                  {rawAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.accountName} ({acc.bankName})
                    </option>
                  ))}
                </Select>
              </div>

              <div className="w-full md:col-span-2">
                <Select
                  value={transactionTypeFilter}
                  onChange={(e) => {
                    setTransactionTypeFilter(
                      e.target.value as FinanceBankTransactionType | "ALL",
                    );
                    setTransactionsPage(1);
                  }}
                >
                  <option value="ALL">All Types</option>
                  <option value="CREDIT">Credits (Inflows)</option>
                  <option value="DEBIT">Debits (Outflows)</option>
                </Select>
              </div>

              <div className="w-full md:col-span-2">
                <Select
                  value={reconciliationFilter}
                  onChange={(e) => {
                    setReconciliationFilter(
                      e.target.value as "ALL" | "RECONCILED" | "UNRECONCILED",
                    );
                    setTransactionsPage(1);
                  }}
                >
                  <option value="ALL">All Reconciled</option>
                  <option value="RECONCILED">Reconciled</option>
                  <option value="UNRECONCILED">Unreconciled</option>
                </Select>
              </div>

              <div className="w-full md:col-span-1">
                <Input
                  type="month"
                  value={transactionMonth}
                  onChange={(e) => {
                    setTransactionMonth(e.target.value);
                    setTransactionsPage(1);
                  }}
                  title="Filter by Month"
                />
              </div>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="rounded-2xl border border-gray-200/80 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800 mb-3">
              <h3 className="font-bold text-gray-900 dark:text-white text-theme-base">
                Bank Statement & Transaction Ledger
              </h3>
              <span className="text-theme-xs text-gray-500 dark:text-gray-400">
                {transactionsMeta?.total ?? rawTransactions.length} recorded
                movements
              </span>
            </div>

            {transactionsQuery.isPending ? (
              <div className="flex items-center justify-center py-12 text-gray-500">
                <RefreshCw className="h-6 w-6 animate-spin mr-2 text-blue-600" />
                <span>Loading bank transactions...</span>
              </div>
            ) : transactionsQuery.isError ? (
              <ErrorState
                title="Failed to Load Transactions"
                description={
                  transactionsQuery.error instanceof Error
                    ? transactionsQuery.error.message
                    : "Unable to retrieve bank transactions."
                }
              />
            ) : rawTransactions.length === 0 ? (
              <EmptyState
                title="No Transactions Recorded"
                description={
                  transactionSearch ||
                  filterBankAccountId ||
                  transactionTypeFilter !== "ALL"
                    ? "No transactions match your search criteria."
                    : "No bank transactions recorded yet. Click 'Record Transaction' to add a deposit or withdrawal."
                }
              />
            ) : (
              <>
                <DataTable
                  columns={transactionColumns}
                  rows={rawTransactions}
                  getRowKey={(row) => String(row.id)}
                />
                {transactionsMeta && transactionsMeta.totalPages > 1 && (
                  <div className="pt-4 border-t border-gray-100 dark:border-gray-800 flex justify-end">
                    <Pagination
                      page={transactionsPage}
                      totalPages={transactionsMeta.totalPages}
                      onPageChange={setTransactionsPage}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* 6. Modals & Dialogs */}
      <AddBankAccountDialog
        open={addAccountOpen}
        onClose={() => setAddAccountOpen(false)}
        onSuccess={() => void accountsQuery.refetch()}
      />

      <EditBankAccountDialog
        open={Boolean(editingAccount)}
        account={editingAccount}
        onClose={() => setEditingAccount(null)}
        onSuccess={() => void accountsQuery.refetch()}
      />

      <RecordTransactionDialog
        open={recordTxOpen}
        bankAccounts={activeBankAccounts}
        defaultBankAccountId={selectedBankAccountIdForTx}
        onClose={() => setRecordTxOpen(false)}
        onSuccess={() => {
          void transactionsQuery.refetch();
          void accountsQuery.refetch();
        }}
      />

      <BankAccountDetailDialog
        open={Boolean(detailAccount)}
        account={detailAccount}
        onClose={() => setDetailAccount(null)}
        onEdit={(account) => setEditingAccount(account)}
      />

      {/* Delete Bank Account Confirm Dialog */}
      <ConfirmDialog
        open={Boolean(deletingAccount)}
        onClose={() => setDeletingAccount(null)}
        onConfirm={handleDeleteAccount}
        title="Archive Bank Account"
        itemName={deletingAccount?.accountName}
        description={
          <span>
            Are you sure you want to archive bank account{" "}
            <strong>{deletingAccount?.accountName}</strong> (
            {deletingAccount?.accountNumber})? Note: Accounts with existing
            transactions cannot be deleted to preserve financial audit trails.
          </span>
        }
        confirmText="Archive Account"
        variant="destructive"
      />

      {/* Dedicated Reconcile Transaction Modal */}
      <ReconcileTransactionModal
        open={Boolean(reconcilingTx)}
        transaction={reconcilingTx}
        onClose={() => setReconcilingTx(null)}
        onSuccess={() => {
          void transactionsQuery.refetch();
          void accountsQuery.refetch();
        }}
      />

      {/* Transaction Detail Dialog */}
      <BankTransactionDetailDialog
        open={Boolean(detailTx)}
        transaction={detailTx}
        canWrite={canWrite}
        onClose={() => setDetailTx(null)}
        onReconcile={(tx) => setReconcilingTx(tx)}
        onUnreconcile={(tx) => setUnreconcilingTx(tx)}
      />

      {/* Unreconcile Transaction Confirm Dialog */}
      <ConfirmDialog
        open={Boolean(unreconcilingTx)}
        onClose={() => setUnreconcilingTx(null)}
        onConfirm={handleUnreconcileTransaction}
        title="Remove Transaction Reconciliation"
        itemName={`Tx #${unreconcilingTx?.id}`}
        description={
          <span>
            Are you sure you want to revert reconciliation for transaction{" "}
            <strong>#{unreconcilingTx?.id}</strong>?
          </span>
        }
        confirmText="Unmark Reconciled"
        variant="destructive"
      />
    </div>
  );
}
