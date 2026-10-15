"use client";

import type { Account } from "@texawave-erp/api-types";
import { ACCOUNT_STATUS_TAGS, ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  Input,
  Pagination,
  Select,
  Skeleton,
  StatusBadge,
  useToast,
} from "@texawave-erp/ui-kit";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  useAccounts,
  useChangeAccountStatusTag,
  useDeleteAccount,
} from "../hooks";
import { StatusTagDialog } from "./StatusTagDialog";

const PAGE_SIZE = 20;

const STATUS_COLOR: Record<
  string,
  "brand" | "gray" | "success" | "warning" | "error"
> = {
  Interested: "success",
  "Not Interested": "error",
  "Keep in Touch": "brand",
  "Call Back": "warning",
  "Send Info": "gray",
};

/** Account-360 Accounts list — search by name, filter by status tag,
 * pagination, create action, row click -> detail page, row actions
 * (status-tag change, delete). Mirrors
 * apps/ui/src/features/crm/quotations/components/QuotationList.tsx. */
export function AccountList() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [statusTagTarget, setStatusTagTarget] = useState<Account | null>(null);
  const { toast } = useToast();

  const query = useAccounts({
    page,
    limit: PAGE_SIZE,
    search: search || undefined,
    statusTag: (statusFilter as never) || undefined,
  });
  const changeStatusTag = useChangeAccountStatusTag();
  const deleteMutation = useDeleteAccount();

  async function handleDelete(account: Account) {
    try {
      await deleteMutation.mutateAsync(account.id);
      toast({ title: `Deleted "${account.name}"`, variant: "success" });
    } catch {
      toast({ title: `Could not delete "${account.name}"`, variant: "error" });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-theme-xl font-semibold text-gray-900 dark:text-white/90">
          Accounts
        </h1>
        <Button onClick={() => router.push("/crm/accounts/new")}>
          Add Account
        </Button>
      </div>

      <div className="flex gap-4">
        <Input
          placeholder="Search by name..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="max-w-sm"
        />
        <div className="w-56">
          <Select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            {ACCOUNT_STATUS_TAGS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {query.isPending ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : query.isError ? (
        query.error instanceof ApiError && query.error.isPermissionError ? (
          <Alert
            variant="warning"
            title="You don't have access to CRM accounts"
          >
            Ask an administrator for the <code>crm.account.read</code>{" "}
            permission.
          </Alert>
        ) : (
          <ErrorState onRetry={() => void query.refetch()} />
        )
      ) : query.data.data.length === 0 ? (
        <Card>
          <EmptyState
            title="No accounts yet"
            description="Create your first account to see it here."
          />
        </Card>
      ) : (
        <>
          <DataTable<Account>
            columns={[
              {
                header: "Name",
                cell: (a) => (
                  <button
                    type="button"
                    className="text-left text-brand-600 hover:underline dark:text-brand-400"
                    onClick={() => router.push(`/crm/accounts/${a.id}`)}
                  >
                    {a.name}
                  </button>
                ),
              },
              { header: "Type", cell: (a) => a.accountType ?? "—" },
              { header: "Owner", cell: (a) => a.ownerName ?? "—" },
              { header: "Industry", cell: (a) => a.industry ?? "—" },
              {
                header: "Status",
                cell: (a) =>
                  a.statusTag ? (
                    <StatusBadge
                      label={a.statusTag}
                      colorToken={STATUS_COLOR[a.statusTag] ?? "gray"}
                    />
                  ) : (
                    "—"
                  ),
              },
              {
                header: "",
                headerClassName: "sr-only",
                className: "text-right",
                cell: (a) => (
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setStatusTagTarget(a)}
                      aria-label={`Change status for ${a.name}`}
                    >
                      Status
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/crm/accounts/${a.id}`)}
                      aria-label={`View ${a.name}`}
                    >
                      View
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleDelete(a)}
                      aria-label={`Delete ${a.name}`}
                    >
                      Delete
                    </Button>
                  </div>
                ),
              },
            ]}
            rows={query.data.data}
            getRowKey={(a) => String(a.id)}
          />
          <Pagination
            page={query.data.meta.page}
            totalPages={query.data.meta.totalPages}
            onPageChange={setPage}
          />
        </>
      )}

      <StatusTagDialog
        open={statusTagTarget !== null}
        onClose={() => setStatusTagTarget(null)}
        currentStatusTag={statusTagTarget?.statusTag}
        onSubmit={async (values) => {
          if (!statusTagTarget) return;
          await changeStatusTag.mutateAsync({
            id: statusTagTarget.id,
            input: values,
          });
          toast({ title: "Status tag updated", variant: "success" });
        }}
      />
    </div>
  );
}
