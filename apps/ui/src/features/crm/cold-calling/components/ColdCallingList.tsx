"use client";

import type { CrmColdCallingEntry } from "@texawave-erp/api-types";
import {
  ApiError,
  type ChangeAccountStatusTagFormValues,
} from "@texawave-erp/core";
import {
  useAccounts,
  useChangeAccountStatusTag,
  useCreateAccount,
} from "@/features/crm/accounts/hooks";
import { StatusTagDialog } from "@/features/crm/accounts/components/StatusTagDialog";
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
import {
  useColdCallingEntries,
  useCreateColdCallingEntry,
  useDeleteColdCallingEntry,
  useLinkColdCallingEntryAccount,
  useRecordColdCallingDisposition,
  useUpdateColdCallingEntry,
} from "../hooks";
import { ColdCallingEntryDialog } from "./ColdCallingEntryDialog";

const PAGE_SIZE = 20;

/** Phase 1B — Cold Calling Status. Logs raw cold-calling outcomes exactly
 * as they come out of the source spreadsheet, isolated from the
 * Account.statusTag queues until a person explicitly links a row to an
 * Account and routes a disposition (reuses the same `StatusTagDialog` /
 * `changeAccountStatusTag` the Accounts list and Account-360 page already
 * use). Mirrors legacy TexaWave_ERP/src/modules/crm/ColdCallingStatus.tsx —
 * bulk import/export and ad-hoc custom fields from legacy are NOT
 * reproduced here (documented gap, Docs/CRM_FULL_LEGACY_PARITY.md §10). */
export function ColdCallingList() {
  const router = useRouter();
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<CrmColdCallingEntry | null>(null);
  const [routing, setRouting] = useState<CrmColdCallingEntry | null>(null);
  const [linkingId, setLinkingId] = useState<number | null>(null);

  const query = useColdCallingEntries({
    page,
    limit: PAGE_SIZE,
    search: search || undefined,
  });
  // Bulk account lookup for resolving a linked row's Account name/link —
  // same bounded-fetch-plus-client-map approach as
  // AccountStatusQueueList/YetToHappenList.
  const accountsQuery = useAccounts({ limit: 200 });
  const accountNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const a of accountsQuery.data?.data ?? []) map.set(a.id, a.name);
    return map;
  }, [accountsQuery.data]);

  const createEntry = useCreateColdCallingEntry();
  const updateEntry = useUpdateColdCallingEntry();
  const deleteEntry = useDeleteColdCallingEntry();
  const linkAccount = useLinkColdCallingEntryAccount();
  const recordDisposition = useRecordColdCallingDisposition();
  const createAccount = useCreateAccount();
  const changeStatusTag = useChangeAccountStatusTag();

  async function handleLink(entry: CrmColdCallingEntry) {
    const companyName = entry.companyName.trim();
    if (!companyName) return;
    setLinkingId(entry.id);
    try {
      const existing = (accountsQuery.data?.data ?? []).find(
        (a) => a.name.trim().toLowerCase() === companyName.toLowerCase(),
      );
      const accountId = existing
        ? existing.id
        : (await createAccount.mutateAsync({ name: companyName })).id;
      await linkAccount.mutateAsync({ id: entry.id, input: { accountId } });
      toast({
        title: existing
          ? "Linked to existing account"
          : "Account created and linked",
        variant: "success",
      });
    } catch {
      toast({ title: "Failed to link account", variant: "error" });
    } finally {
      setLinkingId(null);
    }
  }

  async function handleRouteStatus(values: ChangeAccountStatusTagFormValues) {
    if (!routing?.linkedAccountId) return;
    await changeStatusTag.mutateAsync({
      id: routing.linkedAccountId,
      input: values,
    });
    await recordDisposition.mutateAsync({
      id: routing.id,
      input: { dispositionTag: values.statusTag },
    });
    toast({ title: "Status routed", variant: "success" });
  }

  async function handleDelete(entry: CrmColdCallingEntry) {
    try {
      await deleteEntry.mutateAsync(entry.id);
      toast({ title: `Deleted "${entry.companyName}"`, variant: "success" });
    } catch {
      toast({
        title: `Could not delete "${entry.companyName}"`,
        variant: "error",
      });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-theme-xl font-semibold text-gray-900 dark:text-white/90">
            Cold Calling Status
          </h1>
          <p className="text-theme-sm text-gray-500 dark:text-gray-400">
            Raw cold-calling outcomes, logged as-is. Link a row to its Account,
            then route it into the Interested / Not Interested / Keep in Touch /
            Call Back / Send Info queues.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>Add Entry</Button>
      </div>

      <Input
        placeholder="Search by company, prospect, or status..."
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
        className="max-w-sm"
      />

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
            title="You don't have access to Cold Calling Status"
          >
            Ask an administrator for the <code>crm.coldcalling.read</code>{" "}
            permission.
          </Alert>
        ) : (
          <ErrorState onRetry={() => void query.refetch()} />
        )
      ) : query.data.data.length === 0 ? (
        <Card>
          <EmptyState
            title="No rows yet"
            description='Click "Add Entry" to log your first cold-calling outcome.'
          />
        </Card>
      ) : (
        <>
          <DataTable<CrmColdCallingEntry>
            columns={[
              {
                header: "Date",
                cell: (e) =>
                  e.callDate ? new Date(e.callDate).toLocaleDateString() : "—",
              },
              { header: "Company", cell: (e) => e.companyName },
              { header: "Prospect", cell: (e) => e.prospectName ?? "—" },
              { header: "Designation", cell: (e) => e.designation ?? "—" },
              { header: "Status", cell: (e) => e.status ?? "—" },
              {
                header: "Disposition",
                cell: (e) =>
                  e.dispositionTag ? (
                    <StatusBadge label={e.dispositionTag} colorToken="brand" />
                  ) : (
                    <span className="text-gray-400">Not routed</span>
                  ),
              },
              {
                header: "",
                headerClassName: "sr-only",
                className: "text-right",
                cell: (e) => (
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditing(e)}
                    >
                      Edit
                    </Button>
                    {e.linkedAccountId ? (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            router.push(`/crm/accounts/${e.linkedAccountId}`)
                          }
                        >
                          {accountNameById.get(e.linkedAccountId) ??
                            "View account"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setRouting(e)}
                        >
                          Route Status
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={linkingId === e.id}
                        onClick={() => void handleLink(e)}
                      >
                        {linkingId === e.id ? "Linking…" : "Link Account"}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleDelete(e)}
                    >
                      Delete
                    </Button>
                  </div>
                ),
              },
            ]}
            rows={query.data.data}
            getRowKey={(e) => String(e.id)}
          />
          <Pagination
            page={query.data.meta.page}
            totalPages={query.data.meta.totalPages}
            onPageChange={setPage}
          />
        </>
      )}

      <ColdCallingEntryDialog
        open={creating}
        onClose={() => setCreating(false)}
        title="Add Cold Calling Entry"
        submitLabel="Add"
        onSubmit={async (values) => {
          await createEntry.mutateAsync(values);
          toast({ title: "Entry added", variant: "success" });
        }}
      />

      <ColdCallingEntryDialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title="Edit Cold Calling Entry"
        submitLabel="Save"
        initialValues={
          editing
            ? {
                serialNo: editing.serialNo ?? "",
                callDate: editing.callDate?.slice(0, 10) ?? "",
                companyName: editing.companyName,
                prospectName: editing.prospectName ?? "",
                designation: editing.designation ?? "",
                status: editing.status ?? "",
              }
            : undefined
        }
        onSubmit={async (values) => {
          if (!editing) return;
          await updateEntry.mutateAsync({ id: editing.id, input: values });
          toast({ title: "Entry updated", variant: "success" });
        }}
      />

      <StatusTagDialog
        open={routing !== null}
        onClose={() => setRouting(null)}
        onSubmit={handleRouteStatus}
      />
    </div>
  );
}
