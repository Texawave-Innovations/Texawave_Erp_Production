"use client";

import type { CrmMiningRow } from "@texawave-erp/api-types";
import { ApiError } from "@texawave-erp/core";
import {
  ArrowUpRight,
  Eye,
  Pencil,
  Plus,
  Search as SearchIcon,
  Settings2,
  Trash2,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/legacy-ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/legacy-ui/card";
import { Checkbox } from "@/components/legacy-ui/checkbox";
import { Input } from "@/components/legacy-ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/legacy-ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/legacy-ui/table";
import { useCustomFields } from "@/features/crm/bulk-import/hooks";
import { ImportExportBar } from "@/features/crm/bulk-import/components/ImportExportBar";
import { celebrateCrm } from "@/features/crm/celebration";
import { BackToDashboardButton } from "@/features/crm/legacy-ui/BackToDashboardButton";
import { DeleteConfirmDialog } from "@/features/crm/legacy-ui/CrmCommon";
import { PaginationFooter } from "@/features/crm/legacy-ui/Pagination";
import { useDebouncedValue } from "@/features/hr/employees/hooks";
import { usePermission } from "@/hooks/usePermission";
import {
  useCreateMiningRow,
  useDeleteMiningRow,
  useMiningRows,
  usePromoteMiningRow,
  useUpdateMiningRow,
} from "../hooks";
import {
  MINING_COLUMNS,
  type MiningColumnKey,
  type MiningFormValues,
} from "../sections";
import { MiningRowPanel } from "./MiningRowPanel";

type Mode =
  | { kind: "list" }
  | { kind: "new" }
  | { kind: "view"; row: CrmMiningRow }
  | { kind: "edit"; row: CrmMiningRow };

const HEAD =
  "text-center font-black text-sm uppercase tracking-wider text-white py-2.5 px-3";

/** Legacy AccountsMiningSheet.tsx: gradient header card (Import/Export bar,
 * Columns popover, Add), gradient table (Company / Decision Maker / Contact
 * Number / Follow-up Status + custom columns, View / Edit / Promote to Lead /
 * Delete), and the full-page view/edit boxes. */
export function MiningRowsList() {
  const canWrite = usePermission("crm.miningrow.write");
  const canDelete = usePermission("crm.miningrow.delete");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const searchParams = useSearchParams();
  // `?q=` deep link from CRM Search results.
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const [mode, setMode] = useState<Mode>({ kind: "list" });
  const [visible, setVisible] = useState<Set<MiningColumnKey>>(
    new Set(MINING_COLUMNS.map((c) => c.key)),
  );
  // Disables the Promote button immediately on first click (the row only flips
  // to "Promoted" once the refetch lands) so a double click can't race two
  // promotions.
  const [promotingIds, setPromotingIds] = useState<Set<number>>(new Set());

  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const query = useMiningRows({
    page,
    limit: pageSize,
    order: "asc",
    search: debouncedSearch || undefined,
  });
  const customDefs = useCustomFields("accountsMining").data ?? [];
  const createRow = useCreateMiningRow();
  const updateRow = useUpdateMiningRow();
  const promote = usePromoteMiningRow();
  const deleteRow = useDeleteMiningRow();

  const rows = query.data?.data ?? [];
  const total = query.data?.meta.total ?? 0;
  const totalPages = Math.max(1, query.data?.meta.totalPages ?? 1);

  function toggleColumn(key: MiningColumnKey) {
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleSave(
    values: MiningFormValues,
    customFields: Record<string, string>,
  ) {
    if (mode.kind === "edit") {
      await updateRow.mutateAsync({
        id: mode.row.id,
        input: { ...values, customFields },
      });
    } else {
      await createRow.mutateAsync({ ...values, customFields });
      celebrateCrm("mining.recordCreated");
    }
    toast.success("Record saved");
    setMode({ kind: "list" });
  }

  async function handlePromote(row: CrmMiningRow) {
    if (row.promotedToLeadId !== null || promotingIds.has(row.id)) return;
    setPromotingIds((prev) => new Set(prev).add(row.id));
    try {
      await promote.mutateAsync(row.id);
      toast.success("Promoted to Lead", {
        description: `"${row.companyName}" is now in the Leads tab.`,
      });
      celebrateCrm("mining.promoted");
    } catch (err) {
      toast.error("Failed to promote to Lead", {
        description: err instanceof ApiError ? err.message : undefined,
      });
    } finally {
      setPromotingIds((prev) => {
        const next = new Set(prev);
        next.delete(row.id);
        return next;
      });
    }
  }

  async function handleDelete(row: CrmMiningRow) {
    try {
      await deleteRow.mutateAsync(row.id);
      toast.success("Record deleted");
    } catch (err) {
      throw new Error(
        err instanceof ApiError ? err.message : "Failed to delete record",
      );
    }
  }

  if (mode.kind !== "list") {
    return (
      <MiningRowPanel
        key={mode.kind === "new" ? "new" : mode.row.id}
        row={mode.kind === "new" ? undefined : mode.row}
        readOnly={mode.kind === "view"}
        onBack={() => setMode({ kind: "list" })}
        onSave={handleSave}
      />
    );
  }

  const visibleColumnCount =
    MINING_COLUMNS.filter((c) => visible.has(c.key)).length + customDefs.length;
  // Actions needs a guaranteed pixel width; data columns share the rest.
  const actionsColWidth = visibleColumnCount === 0 ? "100%" : "400px";
  const dataColWidthStyle =
    visibleColumnCount === 0
      ? "0"
      : `calc((100% - 400px) / ${visibleColumnCount})`;

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
              Accounts Mining Sheet
            </CardTitle>
            <CardDescription className="text-sm text-slate-500">
              Track mined accounts and decision-maker contact details. Click
              Edit to view and update full details.
            </CardDescription>
          </div>
          <div className="relative flex items-center gap-2 flex-wrap">
            <ImportExportBar
              entity="mining-rows"
              moduleLabel="Accounts Mining Sheet"
              fileBaseName="crm-accounts-mining-sheet"
              search={debouncedSearch || undefined}
              customModule="accountsMining"
            />
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl gap-1.5 h-9 shrink-0"
                >
                  <Settings2 className="h-3.5 w-3.5" /> Columns
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-56 rounded-2xl">
                <p className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-2">
                  Show / Hide Columns
                </p>
                <div className="space-y-2">
                  {MINING_COLUMNS.map((col) => (
                    <label
                      key={col.key}
                      className="flex items-center gap-2 text-sm cursor-pointer"
                    >
                      <Checkbox
                        checked={visible.has(col.key)}
                        onCheckedChange={() => toggleColumn(col.key)}
                      />
                      {col.label}
                    </label>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            {canWrite && (
              <Button
                size="sm"
                className="rounded-xl gap-1.5 shrink-0"
                onClick={() => setMode({ kind: "new" })}
              >
                <Plus className="h-4 w-4" />
                Add
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
              placeholder="Search company, decision maker, email, status…"
              className="rounded-xl h-9 pl-8 text-sm"
            />
          </div>
        </div>

        <CardContent className="p-0">
          {query.isPending ? (
            <div className="text-center py-16 text-slate-400 text-sm">
              Loading Accounts Mining Sheet…
            </div>
          ) : query.isError ? (
            <div className="text-center py-16 text-sm text-red-600">
              {query.error instanceof ApiError && query.error.isPermissionError
                ? "You don't have access to the Accounts Mining Sheet."
                : "Could not load the Accounts Mining Sheet."}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto crm-tracker-scroll">
                <Table className="table-fixed w-full min-w-[1080px]">
                  <TableHeader
                    style={{
                      background:
                        "linear-gradient(135deg, #2454e8 0%, #1769f5 50%, #12cfe3 100%)",
                    }}
                    className="text-white"
                  >
                    <TableRow className="hover:bg-transparent border-none">
                      {MINING_COLUMNS.filter((c) => visible.has(c.key)).map(
                        (c) => (
                          <TableHead
                            key={c.key}
                            style={{ width: dataColWidthStyle }}
                            className={HEAD}
                          >
                            {c.label}
                          </TableHead>
                        ),
                      )}
                      {customDefs.map((d) => (
                        <TableHead
                          key={d.key}
                          style={{ width: dataColWidthStyle }}
                          className={HEAD}
                        >
                          {d.label}
                        </TableHead>
                      ))}
                      <TableHead
                        style={{ width: actionsColWidth }}
                        className={HEAD}
                      >
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="[&_tr:last-child]:border-b [&_tr:last-child]:border-brand-200">
                    {rows.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={visibleColumnCount + 1}
                          className="text-center py-10 text-slate-400 text-sm"
                        >
                          {debouncedSearch
                            ? "No rows match your search."
                            : 'No rows yet. Click "+ Add" to get started.'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      rows.map((row) => (
                        <TableRow
                          key={row.id}
                          className="border-b border-brand-200 last:border-b-0 hover:bg-emerald-50/40"
                        >
                          {visible.has("company") && (
                            <TableCell className="px-3 py-1 align-middle text-center">
                              <p className="text-sm font-semibold text-slate-800 truncate">
                                {row.companyName || "—"}
                              </p>
                              <p className="text-sm text-slate-400 truncate">
                                {row.domain}
                              </p>
                            </TableCell>
                          )}
                          {visible.has("decisionMaker") && (
                            <TableCell className="px-3 py-1 align-middle text-center text-base text-slate-600 truncate">
                              {row.keyDecisionMakers || "—"}
                            </TableCell>
                          )}
                          {visible.has("contactNumber") && (
                            <TableCell className="px-3 py-1 align-middle text-center text-base text-slate-600 truncate">
                              {row.contactNumber || "—"}
                            </TableCell>
                          )}
                          {visible.has("followUpStatus") && (
                            <TableCell className="px-3 py-1 align-middle text-center text-base text-slate-600 truncate">
                              {row.followUpStatus || "—"}
                            </TableCell>
                          )}
                          {customDefs.map((d) => (
                            <TableCell
                              key={d.key}
                              className="px-3 py-1 align-middle text-center text-base text-slate-600 truncate"
                            >
                              {row.customFields?.[d.key] || "—"}
                            </TableCell>
                          ))}
                          <TableCell
                            style={{ width: actionsColWidth }}
                            className="px-3 py-1 align-middle text-center overflow-hidden"
                          >
                            <div className="grid grid-cols-[64px_64px_132px_96px] items-center justify-items-center gap-0 mx-auto w-fit">
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-lg gap-1 h-8 text-xs shrink-0 justify-self-end border-blue-200 text-blue-600 bg-blue-50/50 hover:text-blue-700 hover:border-blue-400 hover:bg-blue-100"
                                onClick={() => setMode({ kind: "view", row })}
                              >
                                <Eye className="h-3.5 w-3.5" /> View
                              </Button>
                              {canWrite ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="rounded-lg gap-1 h-8 text-xs shrink-0 justify-self-end"
                                  onClick={() => setMode({ kind: "edit", row })}
                                >
                                  <Pencil className="h-3.5 w-3.5" /> Edit
                                </Button>
                              ) : (
                                <span />
                              )}
                              <div className="flex items-center justify-center">
                                {row.promotedToLeadId !== null ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="rounded-lg gap-1 h-8 text-xs shrink-0 text-slate-600 border-slate-300 bg-slate-50"
                                    disabled
                                    title="Already promoted to a Lead"
                                  >
                                    <ArrowUpRight className="h-3.5 w-3.5" />{" "}
                                    Promoted
                                  </Button>
                                ) : (
                                  canWrite && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="rounded-lg gap-1 h-8 text-xs shrink-0 text-brand-700 border-brand-200 bg-brand-50/50 hover:bg-brand-100"
                                      disabled={promotingIds.has(row.id)}
                                      onClick={() => void handlePromote(row)}
                                    >
                                      <ArrowUpRight className="h-3.5 w-3.5" />{" "}
                                      {promotingIds.has(row.id)
                                        ? "Promoting…"
                                        : "Promote to Lead"}
                                    </Button>
                                  )
                                )}
                              </div>
                              <div className="flex items-center justify-center -ml-8">
                                {canDelete && (
                                  <DeleteConfirmDialog
                                    trigger={
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="rounded-lg gap-1 h-8 text-xs shrink-0 border-red-200 text-red-600 bg-red-50/50 hover:text-red-700 hover:border-red-400 hover:bg-red-100"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />{" "}
                                        Delete
                                      </Button>
                                    }
                                    title="Delete this record?"
                                    description={`"${row.companyName || "This record"}" will be moved to the CRM Recycle Bin.`}
                                    onConfirm={() => handleDelete(row)}
                                  />
                                )}
                              </div>
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
    </div>
  );
}
