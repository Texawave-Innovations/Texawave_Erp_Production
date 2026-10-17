"use client";

import type { CrmColdCallingEntry } from "@texawave-erp/api-types";
import {
  ApiError,
  type ChangeAccountStatusTagFormValues,
} from "@texawave-erp/core";
import {
  Eye,
  ExternalLink,
  Link2,
  Pencil,
  Plus,
  Search as SearchIcon,
  Trash2,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/legacy-ui/badge";
import { Button } from "@/components/legacy-ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/legacy-ui/card";
import { Input } from "@/components/legacy-ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/legacy-ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/legacy-ui/table";
import {
  StatusTagDialog,
  STATUS_TAG_STYLE,
} from "@/features/crm/accounts/components/StatusTagDialog";
import {
  useAccounts,
  useChangeAccountStatusTag,
  useCreateAccount,
} from "@/features/crm/accounts/hooks";
import { ImportExportBar } from "@/features/crm/bulk-import/components/ImportExportBar";
import { BackToDashboardButton } from "@/features/crm/legacy-ui/BackToDashboardButton";
import { DeleteConfirmDialog } from "@/features/crm/legacy-ui/CrmCommon";
import { PaginationFooter } from "@/features/crm/legacy-ui/Pagination";
import { useDebouncedValue } from "@/features/hr/employees/hooks";
import { usePermission } from "@/hooks/usePermission";
import {
  useColdCallingEntries,
  useColdCallingStatuses,
  useDeleteColdCallingEntry,
  useLinkColdCallingEntryAccount,
  useRecordColdCallingDisposition,
} from "../hooks";
import { ColdCallingRecordPage } from "./ColdCallingRecordPage";

const HEAD =
  "text-center font-black text-sm uppercase tracking-wider text-white py-2.5 px-3";

type PageState =
  | { kind: "list" }
  | { kind: "view"; entry: CrmColdCallingEntry }
  | { kind: "edit"; entry: CrmColdCallingEntry | null };

/** Legacy ColdCallingStatus.tsx: gradient header card (Import/Export bar +
 * Add), search / status / date-range filters, gradient table with View / Edit /
 * Link Account (-> Account button + Route Status) / Delete, and full-page
 * view + edit forms. Routing a disposition reuses `StatusTagDialog` /
 * `changeAccountStatusTag` and records it on the row. */
export function ColdCallingList() {
  const router = useRouter();
  const canWrite = usePermission("crm.coldcalling.write");
  const canDelete = usePermission("crm.coldcalling.delete");

  const [pageState, setPageState] = useState<PageState>({ kind: "list" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const searchParams = useSearchParams();
  // `?q=` deep link from CRM Search results.
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [routing, setRouting] = useState<CrmColdCallingEntry | null>(null);
  const [linkingId, setLinkingId] = useState<number | null>(null);

  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const query = useColdCallingEntries({
    page,
    limit: pageSize,
    order: "asc",
    search: debouncedSearch || undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });
  const statusesQuery = useColdCallingStatuses();
  const accountsQuery = useAccounts({ limit: 100 });
  const accountNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const a of accountsQuery.data?.data ?? []) map.set(a.id, a.name);
    return map;
  }, [accountsQuery.data]);

  const deleteEntry = useDeleteColdCallingEntry();
  const linkAccount = useLinkColdCallingEntryAccount();
  const recordDisposition = useRecordColdCallingDisposition();
  const createAccount = useCreateAccount();
  const changeStatusTag = useChangeAccountStatusTag();

  const rows = query.data?.data ?? [];
  const total = query.data?.meta.total ?? 0;
  const totalPages = Math.max(1, query.data?.meta.totalPages ?? 1);
  const hasFilters = Boolean(
    search || statusFilter !== "all" || dateFrom || dateTo,
  );

  async function handleLink(entry: CrmColdCallingEntry) {
    const companyName = entry.companyName.trim();
    if (!companyName) {
      toast.error("Add a company name first");
      return;
    }
    setLinkingId(entry.id);
    try {
      const existing = (accountsQuery.data?.data ?? []).find(
        (a) => a.name.trim().toLowerCase() === companyName.toLowerCase(),
      );
      const accountId = existing
        ? existing.id
        : (await createAccount.mutateAsync({ name: companyName })).id;
      await linkAccount.mutateAsync({ id: entry.id, input: { accountId } });
      toast.success(
        existing ? "Linked to existing Account" : "Account created and linked",
      );
    } catch (err) {
      toast.error("Failed to link Account", {
        description: err instanceof ApiError ? err.message : undefined,
      });
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
    toast.success(`Status set to ${values.statusTag}`);
  }

  async function handleDelete(entry: CrmColdCallingEntry) {
    try {
      await deleteEntry.mutateAsync(entry.id);
      toast.success("Record deleted");
    } catch (err) {
      throw new Error(
        err instanceof ApiError ? err.message : "Failed to delete record",
      );
    }
  }

  if (pageState.kind !== "list") {
    return (
      <ColdCallingRecordPage
        mode={pageState.kind}
        entry={pageState.entry}
        onClose={() => setPageState({ kind: "list" })}
      />
    );
  }

  return (
    <div className="space-y-6">
      <BackToDashboardButton />
      <Card className="crm-panel-frame rounded-3xl overflow-hidden bg-white">
        <CardHeader className="crm-panel-header relative overflow-hidden p-5 border-b border-brand-200/50 bg-gradient-to-br from-white via-brand-100/70 to-blue-100/50 flex flex-row items-center justify-between gap-4 flex-wrap">
          <span
            aria-hidden
            className="pointer-events-none absolute -left-16 -top-20 h-48 w-48 rounded-full bg-brand-300/40 blur-3xl"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute right-10 -bottom-20 h-48 w-48 rounded-full bg-blue-300/35 blur-3xl"
          />
          <div className="relative">
            <CardTitle className="text-lg font-extrabold text-slate-900">
              Cold Calling Status
            </CardTitle>
            <CardDescription className="text-sm text-slate-500">
              Raw cold-calling outcomes, logged as-is. Link a row to its
              Account, then route it into the existing status queues when ready.
            </CardDescription>
          </div>
          <div className="relative flex items-center gap-2 flex-wrap">
            <ImportExportBar
              entity="cold-calling"
              moduleLabel="Cold Calling Status"
              fileBaseName="crm-cold-calling-status"
              search={debouncedSearch || undefined}
              customModule="coldCalling"
            />
            {canWrite && (
              <Button
                size="sm"
                className="rounded-xl gap-1.5 shrink-0"
                onClick={() => setPageState({ kind: "edit", entry: null })}
              >
                <Plus className="h-4 w-4" /> Add
              </Button>
            )}
          </div>
        </CardHeader>

        <div className="flex flex-wrap items-center gap-2 p-4 border-b border-slate-100 bg-slate-50/40">
          <div className="relative flex-1 min-w-[220px]">
            <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search company, prospect, designation, status…"
              className="rounded-xl h-9 pl-8 text-sm"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="rounded-xl h-9 w-[220px] text-sm">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {(statusesQuery.data ?? []).map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            className="rounded-xl h-9 w-[150px] text-sm"
            title="From date"
          />
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            className="rounded-xl h-9 w-[150px] text-sm"
            title="To date"
          />
          {hasFilters && (
            <Button
              size="sm"
              variant="ghost"
              className="rounded-xl h-9 text-xs"
              onClick={() => {
                setSearch("");
                setStatusFilter("all");
                setDateFrom("");
                setDateTo("");
                setPage(1);
              }}
            >
              Clear filters
            </Button>
          )}
        </div>

        <CardContent className="p-0">
          {query.isPending ? (
            <div className="text-center py-16 text-slate-400 text-sm">
              Loading Cold Calling Status…
            </div>
          ) : query.isError ? (
            <div className="text-center py-16 text-sm text-red-600">
              {query.error instanceof ApiError && query.error.isPermissionError
                ? "You don't have access to Cold Calling Status."
                : "Could not load Cold Calling Status."}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto crm-tracker-scroll">
                <Table className="table-fixed w-full min-w-[1280px]">
                  <TableHeader
                    style={{
                      background:
                        "linear-gradient(135deg, #2454e8 0%, #1769f5 50%, #12cfe3 100%)",
                    }}
                    className="text-white"
                  >
                    <TableRow className="hover:bg-transparent border-none">
                      <TableHead className={`${HEAD} w-[110px]`}>
                        Date
                      </TableHead>
                      <TableHead className={HEAD}>Company</TableHead>
                      <TableHead className={HEAD}>Prospect</TableHead>
                      <TableHead className={`${HEAD} w-[140px]`}>
                        Designation
                      </TableHead>
                      <TableHead className={HEAD}>
                        Cold Calling Status
                      </TableHead>
                      <TableHead className={`${HEAD} w-[150px]`}>
                        CRM Disposition
                      </TableHead>
                      <TableHead className={`${HEAD} w-[480px]`}>
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="[&_tr:last-child]:border-b [&_tr:last-child]:border-brand-200">
                    {rows.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="text-center py-10 text-slate-400 text-sm"
                        >
                          {hasFilters
                            ? "No rows match the current filters."
                            : 'No rows yet. Click "+ Add" to get started.'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      rows.map((row) => (
                        <TableRow
                          key={row.id}
                          className="border-b border-brand-200 last:border-b-0 hover:bg-emerald-50/40"
                        >
                          <TableCell className="px-3 py-1 align-middle text-center text-sm text-slate-600">
                            {row.callDate ? row.callDate.slice(0, 10) : "—"}
                          </TableCell>
                          <TableCell className="px-3 py-1 align-middle text-center text-sm font-semibold text-slate-800 truncate">
                            {row.companyName || "—"}
                          </TableCell>
                          <TableCell className="px-3 py-1 align-middle text-center text-sm text-slate-600 truncate">
                            {row.prospectName || "—"}
                          </TableCell>
                          <TableCell className="px-3 py-1 align-middle text-center text-sm text-slate-600 truncate">
                            {row.designation || "—"}
                          </TableCell>
                          <TableCell
                            className="px-3 py-1 align-middle text-center text-sm text-slate-600"
                            title={row.status ?? undefined}
                          >
                            <span className="line-clamp-2">
                              {row.status || "—"}
                            </span>
                          </TableCell>
                          <TableCell className="px-3 py-1 align-middle text-center">
                            {row.dispositionTag ? (
                              <Badge
                                variant="outline"
                                className={`text-xs ${STATUS_TAG_STYLE[row.dispositionTag] || "bg-slate-50 text-slate-600 border-slate-200"}`}
                              >
                                {row.dispositionTag}
                              </Badge>
                            ) : (
                              <span className="text-xs text-slate-400">
                                Not routed
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="px-3 py-1 align-middle text-center">
                            <div className="flex flex-nowrap items-center justify-center gap-1.5 whitespace-nowrap">
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-lg gap-1 h-8 text-xs shrink-0 border-blue-200 text-blue-600 bg-blue-50/50 hover:text-blue-700 hover:border-blue-400 hover:bg-blue-100"
                                onClick={() =>
                                  setPageState({ kind: "view", entry: row })
                                }
                              >
                                <Eye className="h-3.5 w-3.5" /> View
                              </Button>
                              {canWrite && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="rounded-lg gap-1 h-8 text-xs shrink-0"
                                  onClick={() =>
                                    setPageState({ kind: "edit", entry: row })
                                  }
                                >
                                  <Pencil className="h-3.5 w-3.5" /> Edit
                                </Button>
                              )}
                              {!row.linkedAccountId ? (
                                canWrite && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="rounded-lg gap-1 h-8 text-xs shrink-0 text-brand-700 border-brand-200 bg-brand-50/50 hover:bg-brand-100"
                                    disabled={linkingId === row.id}
                                    onClick={() => void handleLink(row)}
                                  >
                                    <Link2 className="h-3.5 w-3.5" />{" "}
                                    {linkingId === row.id
                                      ? "Linking…"
                                      : "Link Account"}
                                  </Button>
                                )
                              ) : (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="rounded-lg gap-1 h-8 text-xs shrink-0"
                                    onClick={() =>
                                      router.push(
                                        `/crm/accounts/${row.linkedAccountId}`,
                                      )
                                    }
                                  >
                                    <ExternalLink className="h-3.5 w-3.5" />{" "}
                                    {accountNameById.get(row.linkedAccountId) ??
                                      "Account"}
                                  </Button>
                                  {canWrite && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="rounded-lg gap-1 h-8 text-xs shrink-0"
                                      onClick={() => setRouting(row)}
                                    >
                                      Route Status
                                    </Button>
                                  )}
                                </>
                              )}
                              {canDelete && (
                                <DeleteConfirmDialog
                                  trigger={
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="rounded-lg gap-1 h-8 text-xs shrink-0 border-red-200 text-red-600 bg-red-50/50 hover:text-red-700 hover:border-red-400 hover:bg-red-100"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" /> Delete
                                    </Button>
                                  }
                                  title="Delete this record?"
                                  description={`"${row.companyName || "This record"}" will be moved to the CRM Recycle Bin.`}
                                  onConfirm={() => handleDelete(row)}
                                />
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              <PaginationFooter
                page={Math.min(page, totalPages)}
                setPage={(updater) => setPage((p) => updater(p))}
                pageSize={pageSize}
                setPageSize={(n) => {
                  setPageSize(n);
                  setPage(1);
                }}
                totalPages={totalPages}
                total={total}
              />
            </>
          )}
        </CardContent>
      </Card>

      <StatusTagDialog
        open={routing !== null}
        onClose={() => setRouting(null)}
        onSubmit={handleRouteStatus}
        accountName={routing?.companyName}
      />
    </div>
  );
}
