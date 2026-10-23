"use client";

import type { Lead, QueryLeadsInput } from "@texawave-erp/api-types";
import { ApiError } from "@texawave-erp/core";
import {
  ArrowRightCircle,
  ArrowUpRight,
  Eye,
  Pencil,
  Plus,
  Search,
  Settings2,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
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
import { Checkbox } from "@/components/legacy-ui/checkbox";
import { Input } from "@/components/legacy-ui/input";
import { Label } from "@/components/legacy-ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/legacy-ui/popover";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/legacy-ui/tabs";
import { ImportExportBar } from "@/features/crm/bulk-import/components/ImportExportBar";
import { BackToDashboardButton } from "@/features/crm/legacy-ui/BackToDashboardButton";
import { DeleteConfirmDialog } from "@/features/crm/legacy-ui/CrmCommon";
import { PaginationFooter } from "@/features/crm/legacy-ui/Pagination";
import { useDebouncedValue } from "@/features/hr/employees/hooks";
import { usePermission } from "@/hooks/usePermission";
import { useCustomFields } from "@/features/crm/bulk-import/hooks";
import { DatePicker } from "@/features/crm/legacy-ui/DatePicker";
import { useDeleteLead, useLeadFacets, useLeads } from "../hooks";
import { LEAD_STATUS_OPTIONS, LEAD_STATUS_STYLE } from "../sections";
import { LeadConvertDialog } from "./ConvertLeadDialog";
import { LeadEditPage } from "./LeadEditPage";

type OptionalColumnKey =
  | "title"
  | "mobile"
  | "industry"
  | "annualRevenue"
  | "rating"
  | "priority"
  | "meetingStatus"
  | "month"
  | "createdBy"
  | "createdDate"
  | "lastActivity";

const OPTIONAL_COLUMN_META: { key: OptionalColumnKey; label: string }[] = [
  { key: "title", label: "Title" },
  { key: "mobile", label: "Mobile" },
  { key: "industry", label: "Industry" },
  { key: "annualRevenue", label: "Annual Revenue" },
  { key: "rating", label: "Rating" },
  { key: "priority", label: "Priority" },
  { key: "meetingStatus", label: "Meeting Status" },
  { key: "month", label: "Month" },
  { key: "createdBy", label: "Created By" },
  { key: "createdDate", label: "Created Date" },
  { key: "lastActivity", label: "Last Activity" },
];

const RATING_STYLE: Record<string, string> = {
  Hot: "bg-red-100 text-red-700 border-red-200",
  Warm: "bg-amber-100 text-amber-700 border-amber-200",
  Cold: "bg-sky-100 text-sky-700 border-sky-200",
};

const DEFAULT_VISIBLE_OPTIONAL: OptionalColumnKey[] = ["rating", "createdDate"];

type SortKey = "createdAsc" | "createdDesc" | "companyAsc" | "companyDesc";

interface LeadFilters {
  status: string;
  owner: string;
  source: string;
  industry: string;
  city: string;
  country: string;
  converted: string;
  rating: string;
  touched: string;
  createdBy: string;
  createdFrom: string;
  createdTo: string;
  minAnnualRevenue: string;
}

const DEFAULT_FILTERS: LeadFilters = {
  status: "ALL",
  owner: "ALL",
  source: "ALL",
  industry: "ALL",
  city: "ALL",
  country: "ALL",
  converted: "ALL",
  rating: "ALL",
  touched: "ALL",
  createdBy: "ALL",
  createdFrom: "",
  createdTo: "",
  minAnnualRevenue: "",
};

const SORT_QUERY: Record<SortKey, Pick<QueryLeadsInput, "sortBy" | "order">> = {
  createdAsc: { sortBy: "createdAt", order: "asc" },
  createdDesc: { sortBy: "createdAt", order: "desc" },
  companyAsc: { sortBy: "companyName", order: "asc" },
  companyDesc: { sortBy: "companyName", order: "desc" },
};

const HEAD_CLASS =
  "text-center font-black text-sm uppercase tracking-wider text-white py-2.5 px-3";

function formatShortDate(value?: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function filtersToQuery(f: LeadFilters): QueryLeadsInput {
  const q: QueryLeadsInput = {};
  if (f.status !== "ALL")
    q.leadStatus = f.status as NonNullable<QueryLeadsInput["leadStatus"]>;
  if (f.owner !== "ALL") q.assignedTo = f.owner;
  if (f.source !== "ALL") q.leadSource = f.source;
  if (f.industry !== "ALL") q.industry = f.industry;
  if (f.city !== "ALL") q.city = f.city;
  if (f.country !== "ALL") q.country = f.country;
  if (f.converted === "CONVERTED" || f.converted === "NOT_CONVERTED")
    q.converted = f.converted;
  if (f.rating !== "ALL") q.rating = f.rating;
  if (f.touched === "TOUCHED" || f.touched === "UNTOUCHED")
    q.touched = f.touched;
  if (f.createdBy !== "ALL") q.createdBy = Number(f.createdBy);
  if (f.createdFrom) q.createdFrom = f.createdFrom;
  if (f.createdTo) q.createdTo = f.createdTo;
  if (f.minAnnualRevenue && Number.isFinite(Number(f.minAnnualRevenue)))
    q.minAnnualRevenue = Number(f.minAnnualRevenue);
  return q;
}

/** Legacy Leads.tsx: gradient header card (title, Import/Export bar, Add Row),
 * search + Filters + sort + optional-columns toolbar, All / Converted / Not
 * Converted tabs, gradient table (View / Edit / Convert|View Account /
 * Delete), pagination, full-page edit form and the Convert dialog. View state
 * is mirrored into the URL so "Back to Leads" restores it. */
export function LeadList() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const canWrite = usePermission([
    "crm.lead.write.own",
    "crm.lead.write.team",
    "crm.lead.write.all",
  ]);

  const [editing, setEditing] = useState<Lead | "new" | null>(null);
  const [convertLead, setConvertLead] = useState<Lead | null>(null);

  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const [filters, setFilters] = useState<LeadFilters>(() => {
    const fromUrl = { ...DEFAULT_FILTERS };
    (Object.keys(DEFAULT_FILTERS) as (keyof LeadFilters)[]).forEach((key) => {
      const v = searchParams.get(key);
      if (v !== null) fromUrl[key] = v;
    });
    return fromUrl;
  });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [visibleOptional, setVisibleOptional] = useState<
    Set<OptionalColumnKey>
  >(new Set(DEFAULT_VISIBLE_OPTIONAL));
  const [sortKey, setSortKey] = useState<SortKey>(
    () => (searchParams.get("sort") as SortKey | null) ?? "createdAsc",
  );
  const [page, setPage] = useState(() => Number(searchParams.get("page")) || 1);
  const [pageSize, setPageSize] = useState(
    () => Number(searchParams.get("pageSize")) || 10,
  );

  const debouncedSearch = useDebouncedValue(search.trim(), 300);

  // Mirror view state into the URL (replace, not push) so Back-to-Leads
  // restores tab/filter/search/sort/page.
  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    (Object.keys(filters) as (keyof LeadFilters)[]).forEach((key) => {
      if (filters[key] !== DEFAULT_FILTERS[key]) params.set(key, filters[key]);
    });
    if (sortKey !== "createdAsc") params.set("sort", sortKey);
    if (page !== 1) params.set("page", String(page));
    if (pageSize !== 10) params.set("pageSize", String(pageSize));
    const next = params.toString();
    if (next !== searchParams.toString())
      router.replace(next ? `${pathname}?${next}` : pathname, {
        scroll: false,
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally keyed on view state only (router/pathname are stable)
  }, [search, filters, sortKey, page, pageSize]);

  // Restore / remember the scroll offset across a visit to a Lead.
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("crm-leads-scroll");
      if (saved)
        requestAnimationFrame(() => window.scrollTo(0, Number(saved) || 0));
    } catch {
      /* storage unavailable */
    }
    return () => {
      try {
        sessionStorage.setItem("crm-leads-scroll", String(window.scrollY));
      } catch {
        /* storage unavailable */
      }
    };
  }, []);

  const query = useLeads({
    page,
    limit: pageSize,
    q: debouncedSearch || undefined,
    ...filtersToQuery(filters),
    ...SORT_QUERY[sortKey],
  });
  const facets = useLeadFacets();
  const customDefs = useCustomFields("leads").data ?? [];
  const allCount = useLeads({ limit: 1 });
  const convertedCount = useLeads({ limit: 1, converted: "CONVERTED" });
  const deleteMutation = useDeleteLead();

  const rows = query.data?.data ?? [];
  const total = query.data?.meta.total ?? 0;
  const totalPages = Math.max(1, query.data?.meta.totalPages ?? 1);
  const clampedPage = Math.min(page, totalPages);

  const conversionCounts = {
    all: allCount.data?.meta.total ?? 0,
    converted: convertedCount.data?.meta.total ?? 0,
    notConverted:
      (allCount.data?.meta.total ?? 0) - (convertedCount.data?.meta.total ?? 0),
  };

  const activeFilterCount = useMemo(
    () =>
      (Object.keys(filters) as (keyof LeadFilters)[]).filter(
        (k) => filters[k] !== DEFAULT_FILTERS[k],
      ).length,
    [filters],
  );

  function updateFilters(patch: Partial<LeadFilters>) {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  }

  const leadsFrom = useMemo(() => {
    const qs = searchParams.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }, [pathname, searchParams]);
  const openLead = (id: number) =>
    router.push(`/crm/leads/${id}?back=${encodeURIComponent(leadsFrom)}`);
  const openAccount = (id: number) => router.push(`/crm/accounts/${id}`);

  async function handleDelete(lead: Lead) {
    try {
      await deleteMutation.mutateAsync(lead.id);
      toast.success("Lead deleted");
    } catch (err) {
      throw new Error(
        err instanceof ApiError ? err.message : "Failed to delete lead",
      );
    }
  }

  function toggleOptionalColumn(key: OptionalColumnKey) {
    setVisibleOptional((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function renderOptionalCell(key: OptionalColumnKey, row: Lead): ReactNode {
    switch (key) {
      case "title":
        return row.title || "—";
      case "mobile":
        return row.mobile || "—";
      case "industry":
        return row.industry || "—";
      case "annualRevenue":
        return row.annualRevenue || "—";
      case "rating":
        return row.rating ? (
          <Badge
            className={`border pointer-events-none ${RATING_STYLE[row.rating] ?? ""}`}
          >
            {row.rating}
          </Badge>
        ) : (
          <span className="text-slate-300">—</span>
        );
      case "priority":
        return row.priority || "—";
      case "month":
        return row.month || "—";
      case "createdBy":
        return row.createdByName || "—";
      case "lastActivity":
        return formatShortDate(row.lastActivityAt);
      case "meetingStatus":
        return row.meetingStatus || "—";
      case "createdDate":
        return formatShortDate(row.createdAt);
      default:
        return "—";
    }
  }

  if (editing) {
    return (
      <LeadEditPage
        lead={editing === "new" ? null : editing}
        onClose={() => setEditing(null)}
      />
    );
  }

  const visibleColumns = OPTIONAL_COLUMN_META.filter((c) =>
    visibleOptional.has(c.key),
  );

  return (
    <div className="space-y-6">
      <BackToDashboardButton />
      <Card className="crm-panel-frame rounded-3xl overflow-hidden bg-white">
        <CardHeader className="crm-panel-header relative overflow-hidden p-5 border-b border-brand-200/50 bg-gradient-to-br from-white via-brand-100/70 to-blue-100/50 flex flex-col gap-4">
          <span
            aria-hidden
            className="pointer-events-none absolute -left-16 -top-20 h-48 w-48 rounded-full bg-brand-300/40 blur-3xl"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute right-10 -bottom-20 h-48 w-48 rounded-full bg-blue-300/35 blur-3xl"
          />
          <div className="relative flex flex-row items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="text-lg font-extrabold text-slate-900">
                Leads
              </CardTitle>
              <CardDescription className="text-sm text-slate-500">
                Track leads and meeting details. Click Edit to view and update
                full details.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <ImportExportBar
                entity="leads"
                moduleLabel="Leads"
                fileBaseName="crm-leads"
                search={debouncedSearch || undefined}
                customModule="leads"
              />
              {canWrite && (
                <Button
                  size="sm"
                  className="rounded-xl gap-1.5 shrink-0"
                  onClick={() => setEditing("new")}
                >
                  <Plus className="h-4 w-4" />
                  Add Row
                </Button>
              )}
            </div>
          </div>

          {/* Search + Filters + Columns toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search company, name, email, phone…"
                className="h-9 rounded-xl pl-9 bg-white border-brand-300 shadow-[0_0_0_3px_rgba(77,159,75,0.12)] focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-brand-400 focus-visible:shadow-[0_0_0_3px_rgba(77,159,75,0.18)] transition-shadow"
              />
            </div>
            <Button
              size="sm"
              variant={filtersOpen ? "default" : "outline"}
              className="rounded-xl gap-1.5 h-9"
              onClick={() => setFiltersOpen((v) => !v)}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" /> Filters
              {activeFilterCount > 0 && (
                <Badge className="ml-1 h-4 min-w-4 px-1 text-xs bg-white text-brand-700 border-none">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
            <Select
              value={sortKey}
              onValueChange={(v) => {
                setSortKey(v as SortKey);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 rounded-xl w-[170px] bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="createdAsc">Oldest First</SelectItem>
                <SelectItem value="createdDesc">Newest First</SelectItem>
                <SelectItem value="companyAsc">Company A–Z</SelectItem>
                <SelectItem value="companyDesc">Company Z–A</SelectItem>
              </SelectContent>
            </Select>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl gap-1.5 h-9"
                >
                  <Settings2 className="h-3.5 w-3.5" /> Columns
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-56 rounded-2xl">
                <p className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-2">
                  Optional Columns
                </p>
                <div className="space-y-2">
                  {OPTIONAL_COLUMN_META.map((col) => (
                    <label
                      key={col.key}
                      className="flex items-center gap-2 text-sm cursor-pointer"
                    >
                      <Checkbox
                        checked={visibleOptional.has(col.key)}
                        onCheckedChange={() => toggleOptionalColumn(col.key)}
                      />
                      {col.label}
                    </label>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Conversion sub-tabs — drive the same `converted` filter as the
              Filters panel's "Conversion Status" dropdown. */}
          <Tabs
            value={filters.converted}
            onValueChange={(v) => updateFilters({ converted: v })}
          >
            <TabsList className="rounded-2xl h-auto p-1.5 flex-nowrap w-max [&_[data-state=inactive]]:text-slate-700">
              <TabsTrigger value="ALL" className="rounded-xl gap-1.5">
                All Leads ({conversionCounts.all})
              </TabsTrigger>
              <TabsTrigger value="CONVERTED" className="rounded-xl gap-1.5">
                Converted ({conversionCounts.converted})
              </TabsTrigger>
              <TabsTrigger value="NOT_CONVERTED" className="rounded-xl gap-1.5">
                Not Converted ({conversionCounts.notConverted})
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Advanced filters panel */}
          {filtersOpen && (
            <div className="crm-panel-frame rounded-2xl bg-white p-4 space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <FilterSelect
                  label="Lead Status"
                  value={filters.status}
                  onChange={(v) => updateFilters({ status: v })}
                  options={[...LEAD_STATUS_OPTIONS]}
                />
                <FilterSelect
                  label="Lead Owner"
                  value={filters.owner}
                  onChange={(v) => updateFilters({ owner: v })}
                  options={facets.data?.owners ?? []}
                />
                <FilterSelect
                  label="Lead Source"
                  value={filters.source}
                  onChange={(v) => updateFilters({ source: v })}
                  options={facets.data?.sources ?? []}
                />
                <FilterSelect
                  label="Industry"
                  value={filters.industry}
                  onChange={(v) => updateFilters({ industry: v })}
                  options={facets.data?.industries ?? []}
                />
                <FilterSelect
                  label="City"
                  value={filters.city}
                  onChange={(v) => updateFilters({ city: v })}
                  options={facets.data?.cities ?? []}
                />
                <FilterSelect
                  label="Country"
                  value={filters.country}
                  onChange={(v) => updateFilters({ country: v })}
                  options={facets.data?.countries ?? []}
                />
                <FilterSelect
                  label="Conversion Status"
                  value={filters.converted}
                  onChange={(v) => updateFilters({ converted: v })}
                  options={["CONVERTED", "NOT_CONVERTED"]}
                  optionLabels={{
                    CONVERTED: "Converted",
                    NOT_CONVERTED: "Not Converted",
                  }}
                />
                <FilterSelect
                  label="Rating"
                  value={filters.rating}
                  onChange={(v) => updateFilters({ rating: v })}
                  options={["Hot", "Warm", "Cold"]}
                />
                <FilterSelect
                  label="Touched"
                  value={filters.touched}
                  onChange={(v) => updateFilters({ touched: v })}
                  options={["TOUCHED", "UNTOUCHED"]}
                  optionLabels={{ TOUCHED: "Touched", UNTOUCHED: "Untouched" }}
                />
                <FilterSelect
                  label="Created By"
                  value={filters.createdBy}
                  onChange={(v) => updateFilters({ createdBy: v })}
                  options={(facets.data?.createdBy ?? []).map((c) =>
                    String(c.id),
                  )}
                  optionLabels={Object.fromEntries(
                    (facets.data?.createdBy ?? []).map((c) => [
                      String(c.id),
                      c.name,
                    ]),
                  )}
                />
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-500">
                    Created From
                  </Label>
                  <DatePicker
                    value={filters.createdFrom}
                    onChange={(v) => updateFilters({ createdFrom: v })}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-500">
                    Created To
                  </Label>
                  <DatePicker
                    value={filters.createdTo}
                    onChange={(v) => updateFilters({ createdTo: v })}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-500">
                    Min Annual Revenue
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    value={filters.minAnnualRevenue}
                    onChange={(e) =>
                      updateFilters({ minAnnualRevenue: e.target.value })
                    }
                    placeholder="e.g. 1000000"
                    className="h-9 rounded-xl text-xs bg-white"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between pt-1">
                <p className="text-sm text-slate-400">
                  {activeFilterCount > 0
                    ? `${activeFilterCount} filter${activeFilterCount === 1 ? "" : "s"} applied`
                    : "No filters applied"}
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2.5 text-xs gap-1 text-slate-500"
                  onClick={() => updateFilters(DEFAULT_FILTERS)}
                  disabled={activeFilterCount === 0}
                >
                  <X className="h-3 w-3" /> Clear all
                </Button>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {query.isPending ? (
            <div className="text-center py-16 text-slate-400 text-sm">
              Loading Leads…
            </div>
          ) : query.isError ? (
            <div className="text-center py-16 text-sm text-red-600">
              {query.error instanceof ApiError && query.error.isPermissionError
                ? "You don't have access to CRM leads."
                : "Could not load leads."}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto crm-tracker-scroll">
                <Table>
                  <TableHeader
                    style={{
                      background:
                        "linear-gradient(135deg, #2454e8 0%, #1769f5 50%, #12cfe3 100%)",
                    }}
                    className="text-white"
                  >
                    <TableRow className="hover:bg-transparent border-none">
                      <TableHead className={`${HEAD_CLASS} min-w-[200px]`}>
                        Company
                      </TableHead>
                      <TableHead className={`${HEAD_CLASS} min-w-[170px]`}>
                        Lead Name
                      </TableHead>
                      <TableHead className={`${HEAD_CLASS} min-w-[190px]`}>
                        Email
                      </TableHead>
                      <TableHead className={`${HEAD_CLASS} min-w-[130px]`}>
                        Phone
                      </TableHead>
                      <TableHead className={`${HEAD_CLASS} min-w-[130px]`}>
                        Lead Source
                      </TableHead>
                      <TableHead className={`${HEAD_CLASS} min-w-[130px]`}>
                        Lead Owner
                      </TableHead>
                      <TableHead className={`${HEAD_CLASS} min-w-[140px]`}>
                        Lead Status
                      </TableHead>
                      <TableHead className={`${HEAD_CLASS} min-w-[130px]`}>
                        Conversion
                      </TableHead>
                      {visibleColumns.map((c) => (
                        <TableHead
                          key={c.key}
                          className={`${HEAD_CLASS} min-w-[130px]`}
                        >
                          {c.label}
                        </TableHead>
                      ))}
                      {customDefs.map((d) => (
                        <TableHead
                          key={d.key}
                          className={`${HEAD_CLASS} min-w-[130px]`}
                        >
                          {d.label}
                        </TableHead>
                      ))}
                      <TableHead className={`${HEAD_CLASS} min-w-[376px]`}>
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="[&_tr:last-child]:border-b [&_tr:last-child]:border-brand-200">
                    {rows.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={
                            9 + visibleColumns.length + customDefs.length
                          }
                          className="text-center py-10 text-slate-400 text-sm"
                        >
                          {conversionCounts.all === 0
                            ? 'No rows yet. Click "Add Row" to get started.'
                            : "No leads match your search/filters."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      rows.map((row) => (
                        <TableRow
                          key={row.id}
                          className="border-b border-brand-200 last:border-b-0 hover:bg-emerald-50/40"
                        >
                          <TableCell className="px-3 py-1 align-middle text-center">
                            <button
                              type="button"
                              className="text-base font-bold text-black hover:text-brand-600 hover:underline truncate max-w-[220px] block text-center mx-auto"
                              onClick={() => openLead(row.id)}
                            >
                              {row.companyName || "—"}
                            </button>
                            <p className="text-sm font-normal text-slate-600 truncate max-w-[220px] mx-auto">
                              {row.domain}
                            </p>
                          </TableCell>
                          <TableCell className="px-3 py-1 align-middle text-center text-base text-slate-600 truncate max-w-[180px]">
                            {row.prospectName || "—"}
                          </TableCell>
                          <TableCell className="px-3 py-1 align-middle text-center text-base text-slate-600 truncate max-w-[200px]">
                            {row.email || "—"}
                          </TableCell>
                          <TableCell className="px-3 py-1 align-middle text-center text-base text-slate-600">
                            {row.contactNumber || "—"}
                          </TableCell>
                          <TableCell className="px-3 py-1 align-middle text-center text-base text-slate-600">
                            {row.leadSource || "—"}
                          </TableCell>
                          <TableCell className="px-3 py-1 align-middle text-center text-base text-slate-600">
                            {row.assignedTo || "—"}
                          </TableCell>
                          <TableCell className="px-3 py-1 align-middle text-center">
                            {row.leadStatus ? (
                              <Badge
                                className={`border pointer-events-none ${LEAD_STATUS_STYLE[row.leadStatus] || "bg-slate-100 text-slate-600 border-slate-200"}`}
                              >
                                {row.leadStatus.replace(/_/g, " ")}
                              </Badge>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell className="px-3 py-1 align-middle text-center">
                            {row.linkedAccountId ? (
                              <Badge variant="success" className="text-xs">
                                Converted
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-xs text-slate-500 border-slate-200 bg-slate-50"
                              >
                                Not Converted
                              </Badge>
                            )}
                          </TableCell>
                          {visibleColumns.map((c) => (
                            <TableCell
                              key={c.key}
                              className="px-3 py-1 align-middle text-center text-base text-slate-600"
                            >
                              {renderOptionalCell(c.key, row)}
                            </TableCell>
                          ))}
                          {customDefs.map((d) => (
                            <TableCell
                              key={d.key}
                              className="px-3 py-1 align-middle text-center text-base text-slate-600"
                            >
                              {row.customFields?.[d.key] || "—"}
                            </TableCell>
                          ))}
                          <TableCell className="px-3 py-1 align-middle text-center">
                            <div className="grid grid-cols-[72px_72px_116px_96px] items-center justify-items-center gap-0.5 mx-auto w-fit">
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-lg gap-1 h-8 text-xs shrink-0 border-blue-200 text-blue-600 bg-blue-50/50 hover:text-blue-700 hover:border-blue-400 hover:bg-blue-100"
                                onClick={() => openLead(row.id)}
                              >
                                <Eye className="h-3.5 w-3.5" /> View
                              </Button>
                              {canWrite ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="rounded-lg gap-1 h-8 text-xs shrink-0"
                                  onClick={() => setEditing(row)}
                                >
                                  <Pencil className="h-3.5 w-3.5" /> Edit
                                </Button>
                              ) : (
                                <span />
                              )}
                              <div className="flex items-center justify-center">
                                {row.linkedAccountId ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="rounded-lg gap-1 h-8 text-xs shrink-0 border-blue-200 text-blue-600 bg-blue-50/50 hover:text-blue-700 hover:border-blue-400 hover:bg-blue-100"
                                    onClick={() =>
                                      openAccount(row.linkedAccountId as number)
                                    }
                                  >
                                    <ArrowUpRight className="h-3.5 w-3.5" />{" "}
                                    View Account
                                  </Button>
                                ) : canWrite ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="rounded-lg gap-1 h-8 text-xs shrink-0 border-brand-300 text-brand-700 bg-brand-50/60 hover:bg-brand-100 hover:border-brand-400 disabled:opacity-70 disabled:text-brand-700 disabled:border-brand-200 disabled:bg-brand-50/40"
                                    disabled={!row.companyName?.trim()}
                                    onClick={() => setConvertLead(row)}
                                  >
                                    <ArrowRightCircle className="h-3.5 w-3.5" />{" "}
                                    Convert
                                  </Button>
                                ) : null}
                              </div>
                              <div className="flex items-center justify-center -ml-6">
                                {canWrite && (
                                  <DeleteConfirmDialog
                                    trigger={
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-8 px-2 gap-1 text-xs font-semibold shrink-0 text-red-700 border-red-200 bg-red-50/50 hover:text-red-800 hover:border-red-400 hover:bg-red-100 rounded-lg"
                                        title="Delete lead"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />{" "}
                                        Delete
                                      </Button>
                                    }
                                    title="Delete this lead?"
                                    description={`"${row.companyName || "This lead"}" will be moved to the CRM Recycle Bin.`}
                                    warning={
                                      row.linkedAccountId
                                        ? "This lead has already been converted — deleting it will NOT remove the linked Account, Contact or Opportunity, which remain as separate records."
                                        : undefined
                                    }
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
                page={clampedPage}
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

      {convertLead && (
        <LeadConvertDialog
          open={!!convertLead}
          onOpenChange={(open) => !open && setConvertLead(null)}
          lead={convertLead}
        />
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  optionLabels,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  optionLabels?: Record<string, string>;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-bold text-slate-500">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 rounded-xl text-xs bg-white">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All</SelectItem>
          {options.map((opt) => (
            <SelectItem key={opt} value={opt}>
              {optionLabels?.[opt] || opt.replace(/_/g, " ")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
