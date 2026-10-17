"use client";

import { ImportExportBar } from "@/features/crm/bulk-import/components/ImportExportBar";
import type { Quotation } from "@texawave-erp/api-types";
import { ApiError, QUOTATION_STATUSES } from "@texawave-erp/core";
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
import { BackToDashboardButton } from "@/features/crm/legacy-ui/BackToDashboardButton";
import {
  DeleteConfirmDialog,
  EmptyState,
  QUOTATION_STATUS_STYLE,
  formatMoney,
} from "@/features/crm/legacy-ui/CrmCommon";
import { PaginationFooter } from "@/features/crm/legacy-ui/Pagination";
import { usePermission } from "@/hooks/usePermission";
import { Eye, Pencil, Plus, Receipt, Search, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useDeleteQuotation, useQuotations } from "../hooks";

const HEAD = "font-black text-sm uppercase tracking-wider text-white py-2.5";

/** Legacy Quotes.tsx: search across quotationNumber/subject/account name, a
 * status filter, pagination footer, View/Edit (same combined route) and an
 * admin-gated Delete behind a confirm dialog. Pagination is server-side. */
export function QuotationList() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const canDelete = usePermission("crm.quotation.delete");

  const query = useQuotations({
    page,
    limit: pageSize,
    q: search || undefined,
    status: statusFilter === "ALL" ? undefined : (statusFilter as never),
  });
  const deleteMutation = useDeleteQuotation();

  const rows = query.data?.data ?? [];
  const meta = query.data?.meta;

  async function handleDelete(quote: Quotation) {
    try {
      await deleteMutation.mutateAsync(quote.id);
    } catch (err) {
      throw new Error(
        err instanceof ApiError
          ? err.message
          : `Could not delete ${quote.quotationNumber}`,
      );
    }
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
            <CardTitle className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <Receipt className="h-4 w-4 text-brand-600" /> Quotes
            </CardTitle>
            <CardDescription className="text-sm text-slate-500">
              Every quote sent to a prospect — line items, totals, and status.
            </CardDescription>
          </div>
          <div className="relative flex items-center gap-2 flex-wrap">
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 rounded-xl w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                {QUOTATION_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search quotes…"
                className="pl-8 h-9 rounded-xl w-56 border-brand-300 shadow-[0_0_0_3px_rgba(77,159,75,0.12)] focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-brand-400 focus-visible:shadow-[0_0_0_3px_rgba(77,159,75,0.18)] transition-shadow"
              />
            </div>
            <ImportExportBar
              entity="quotations"
              moduleLabel="Quotes"
              fileBaseName="crm-quotes"
              search={search}
              exportOnly
            />
            <Button
              size="sm"
              className="rounded-xl gap-1.5 shrink-0"
              onClick={() => router.push("/crm/quotes/new")}
            >
              <Plus className="h-4 w-4" /> New Quote
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {query.isPending ? (
            <div className="text-center py-16 text-slate-400 text-xs">
              Loading Quotes…
            </div>
          ) : query.isError ? (
            query.error instanceof ApiError && query.error.isPermissionError ? (
              <EmptyState
                icon={Receipt}
                title="You don't have access to CRM quotes"
                description="Ask an administrator for the crm.quotation.read permission."
              />
            ) : (
              <div className="text-center py-16 text-xs text-red-500">
                Could not load quotes.{" "}
                <button
                  type="button"
                  className="underline"
                  onClick={() => void query.refetch()}
                >
                  Retry
                </button>
              </div>
            )
          ) : rows.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title={search ? `No quotes match "${search}"` : "No quotes yet"}
              description="Create a quote from here, or from a Deal's Quotes tab."
            />
          ) : (
            <div className="overflow-x-auto crm-tracker-scroll">
              <Table>
                <TableHeader
                  style={{
                    background:
                      "linear-gradient(90deg, #2454e8 0%, #1769f5 50%, #12cfe3 100%)",
                  }}
                >
                  <TableRow className="hover:bg-transparent border-b-0">
                    <TableHead className={HEAD}>Quote #</TableHead>
                    <TableHead className={HEAD}>Account</TableHead>
                    <TableHead className={HEAD}>Deal</TableHead>
                    <TableHead className={HEAD}>Status</TableHead>
                    <TableHead className={HEAD}>Valid Until</TableHead>
                    <TableHead className={HEAD}>Grand Total</TableHead>
                    <TableHead
                      className={`${HEAD} text-center w-[220px] whitespace-nowrap`}
                    >
                      Action
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="[&_tr:last-child]:border-b [&_tr:last-child]:border-brand-200">
                  {rows.map((quote) => (
                    <TableRow
                      key={quote.id}
                      className="border-b border-brand-200 last:border-b-0 cursor-pointer hover:bg-brand-50/40"
                      onClick={() => router.push(`/crm/quotes/${quote.id}`)}
                    >
                      <TableCell className="py-1">
                        <p className="font-semibold text-slate-800">
                          {quote.quotationNumber}
                        </p>
                        {quote.subject && (
                          <p className="text-sm text-slate-400">
                            {quote.subject}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="py-1 text-base text-slate-600">
                        <div className="flex items-center justify-center gap-1">
                          {quote.account.name}
                        </div>
                      </TableCell>
                      <TableCell className="py-1 text-base text-slate-600">
                        {quote.opportunity?.title || "—"}
                      </TableCell>
                      <TableCell className="py-1">
                        <Badge
                          variant="outline"
                          className={`border ${QUOTATION_STATUS_STYLE[quote.status] ?? ""}`}
                        >
                          {quote.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-1 text-base text-slate-600">
                        {quote.validUntil?.slice(0, 10) || "—"}
                      </TableCell>
                      <TableCell className="py-1 text-base font-bold text-slate-800">
                        {formatMoney(Number(quote.grandTotal), quote.currency)}
                      </TableCell>
                      <TableCell
                        className="py-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-center gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-2 gap-1 text-xs font-semibold text-blue-600 border-blue-200 bg-blue-50/50 hover:text-blue-700 hover:border-blue-400 hover:bg-blue-100 rounded-lg"
                            title="View quote"
                            onClick={() =>
                              router.push(`/crm/quotes/${quote.id}`)
                            }
                          >
                            <Eye className="h-3.5 w-3.5" /> View
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-2 gap-1 text-xs font-semibold text-brand-700 border-brand-200 bg-brand-50/50 hover:text-brand-800 hover:border-brand-400 hover:bg-brand-100 rounded-lg"
                            title="Edit quote"
                            onClick={() =>
                              router.push(`/crm/quotes/${quote.id}`)
                            }
                          >
                            <Pencil className="h-3.5 w-3.5" /> Edit
                          </Button>
                          {canDelete && (
                            <DeleteConfirmDialog
                              trigger={
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 px-2 gap-1 text-xs font-semibold text-red-700 border-red-200 bg-red-50/50 hover:text-red-800 hover:border-red-400 hover:bg-red-100 rounded-lg"
                                >
                                  <Trash2 className="h-3.5 w-3.5" /> Delete
                                </Button>
                              }
                              title={`Delete quote ${quote.quotationNumber}?`}
                              description="This quote and its line items will be moved to the CRM Recycle Bin."
                              onConfirm={() => handleDelete(quote)}
                            />
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <PaginationFooter
            page={meta?.page ?? page}
            setPage={setPage}
            pageSize={pageSize}
            setPageSize={(n) => {
              setPageSize(n);
              setPage(1);
            }}
            totalPages={meta?.totalPages ?? 1}
            total={meta?.total ?? 0}
          />
        </CardContent>
      </Card>
    </div>
  );
}
