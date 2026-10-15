"use client";

import type { Account, AccountStatusTag } from "@texawave-erp/api-types";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  Input,
  Pagination,
  Skeleton,
  StatusBadge,
  useToast,
} from "@texawave-erp/ui-kit";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useAccounts, useChangeAccountStatusTag } from "../hooks";
import { StatusTagDialog } from "./StatusTagDialog";

const PAGE_SIZE = 20;
/** Large enough to cover a queue's full population in one request per tag —
 * these are operational queues (a filtered slice of Accounts), not the full
 * Accounts list, so a bounded single-page fetch per tag plus client-side
 * search/pagination is simpler than threading server-side pagination
 * through a merge of up to two tag-filtered queries (the `statusTag` filter
 * on `GET /crm/accounts` only accepts one tag — see
 * apps/api/src/modules/crm/accounts/dto/account.dto.ts `QueryAccountDto`). */
const FETCH_LIMIT = 100; // API caps `limit` at MAX_PAGE_SIZE (100); more → 400 validation error

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

function statusDetail(a: Account): string {
  if (a.statusTag === "Not Interested") return a.statusReason || "—";
  if (a.statusTag === "Keep in Touch" || a.statusTag === "Call Back") {
    return a.statusDate ? new Date(a.statusDate).toLocaleString() : "—";
  }
  if (a.statusTag === "Send Info") return a.statusInfoType || "—";
  return "—";
}

export interface AccountStatusQueueListProps {
  /** One or two `AccountStatusTag`s this queue shows — e.g. `["Interested"]`
   * or `["Call Back", "Send Info"]` for the combined Call Back/Send Info
   * queue. Mirrors legacy `AccountStatusQueue` (TexaWave_ERP/src/modules/
   * crm/domain/AccountStatusQueue.tsx) — a filtered, live view over the
   * same `Account.statusTag` field the Accounts list and Account-360 page
   * already write; no separate dataset, so changing status anywhere moves
   * the account between queues automatically. */
  tags:
    readonly [AccountStatusTag] | readonly [AccountStatusTag, AccountStatusTag];
  title: string;
  description: string;
}

export function AccountStatusQueueList({
  tags,
  title,
  description,
}: AccountStatusQueueListProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusTagTarget, setStatusTagTarget] = useState<Account | null>(null);

  const primaryTag = tags[0];
  const secondaryTag = tags[1];
  const isCombined = secondaryTag !== undefined;

  // Rules-of-hooks requires a fixed number of hook calls — always call both,
  // and simply ignore the second result when this queue only has one tag.
  const queryA = useAccounts({
    statusTag: primaryTag,
    page: 1,
    limit: FETCH_LIMIT,
  });
  const queryB = useAccounts({
    statusTag: secondaryTag ?? primaryTag,
    page: 1,
    limit: FETCH_LIMIT,
  });

  const changeStatusTag = useChangeAccountStatusTag();

  const loading = queryA.isPending || (isCombined && queryB.isPending);
  const isError = queryA.isError || (isCombined && queryB.isError);
  const firstError = queryA.error ?? queryB.error;

  const merged = useMemo(() => {
    const rowsA = queryA.data?.data ?? [];
    const rowsB = isCombined ? (queryB.data?.data ?? []) : [];
    const byId = new Map<number, Account>();
    for (const a of [...rowsA, ...rowsB]) byId.set(a.id, a);
    return Array.from(byId.values());
  }, [queryA.data, queryB.data, isCombined]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return merged;
    return merged.filter((a) =>
      [a.name, a.ownerName, a.statusReason, a.statusInfoType]
        .filter((f): f is string => Boolean(f))
        .some((f) => f.toLowerCase().includes(q)),
    );
  }, [merged, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-theme-xl font-semibold text-gray-900 dark:text-white/90">
          {title}
        </h1>
        <p className="text-theme-sm text-gray-500 dark:text-gray-400">
          {description}
        </p>
      </div>

      <Input
        placeholder="Search by name or owner..."
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
        className="max-w-sm"
      />

      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : isError ? (
        firstError instanceof ApiError && firstError.isPermissionError ? (
          <Alert
            variant="warning"
            title="You don't have access to CRM accounts"
          >
            Ask an administrator for the <code>crm.account.read</code>{" "}
            permission.
          </Alert>
        ) : (
          <ErrorState
            onRetry={() => {
              void queryA.refetch();
              if (isCombined) void queryB.refetch();
            }}
          />
        )
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            title={
              search
                ? `No accounts match "${search}"`
                : `No accounts in ${title}`
            }
            description="Accounts appear here automatically when their status is changed from the Account page or the Accounts list — nothing is entered separately here."
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
              { header: "Owner", cell: (a) => a.ownerName ?? "—" },
              ...(isCombined
                ? [
                    {
                      header: "Type",
                      cell: (a: Account) =>
                        a.statusTag ? (
                          <StatusBadge
                            label={a.statusTag}
                            colorToken={STATUS_COLOR[a.statusTag] ?? "gray"}
                          />
                        ) : (
                          "—"
                        ),
                    },
                  ]
                : []),
              { header: "Detail", cell: (a) => statusDetail(a) },
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
                      Change Status
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/crm/accounts/${a.id}`)}
                      aria-label={`View ${a.name}`}
                    >
                      View
                    </Button>
                  </div>
                ),
              },
            ]}
            rows={paged}
            getRowKey={(a) => String(a.id)}
          />
          <Pagination
            page={page}
            totalPages={totalPages}
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
