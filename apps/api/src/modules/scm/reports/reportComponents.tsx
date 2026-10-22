// Shared UI building blocks for every SCM report page — a KPI tile, the date-range +
// warehouse/supplier/product/status filter bar, and honest loading/empty/error states
// (spec #27, #28). Kept here instead of duplicated per report, matching how every SCM
// domain already centralizes its own status-tone maps in one `*Helpers.ts`.
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/modules/scm/shared/components/ScmButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, Download, Inbox } from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  type PieLabelRenderProps,
} from "recharts";
import { ALL } from "../shared/format";
import {
  type DatePreset,
  type DateRange,
  colorFor,
  presetRange,
} from "./reportHelpers";
import type { ReportFilters, Series } from "./calculations";

// ---------------------------------------------------------------------------
// KPI tile
// ---------------------------------------------------------------------------

export interface KpiCardProps {
  label: string;
  value: string;
  hint?: string;
  loading?: boolean;
  /** True when the underlying data genuinely can't support this metric (e.g. no cost
   * price configured) — renders muted instead of implying a confident number. */
  unavailable?: boolean;
}

export function KpiCard({
  label,
  value,
  hint,
  loading,
  unavailable,
}: KpiCardProps) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <p className="text-xs font-medium text-muted-foreground truncate">
          {label}
        </p>
        <p
          className={cn(
            "text-xl font-bold mt-1",
            unavailable ? "text-muted-foreground text-sm" : "text-foreground",
          )}
        >
          {loading ? "…" : value}
        </p>
        {hint && (
          <p className="text-xs text-muted-foreground mt-1 truncate">{hint}</p>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Donut / pie chart
// ---------------------------------------------------------------------------

const DONUT_OUTER_RADIUS = 90;
const pieLabel = ({ name }: PieLabelRenderProps) => String(name ?? "");

/** Labelled pie of a `Series[]` (one slice per key), used for every distribution chart. */
export function DonutChart({
  data,
  valueFormatter,
}: {
  data: Series[];
  valueFormatter?: (value: number) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="label"
          outerRadius={DONUT_OUTER_RADIUS}
          label={pieLabel}
        >
          {data.map((d, i) => (
            <Cell key={d.key} fill={colorFor(i)} />
          ))}
        </Pie>
        <Tooltip
          formatter={
            valueFormatter ? (v: number) => valueFormatter(v) : undefined
          }
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ---------------------------------------------------------------------------
// Empty / error states
// ---------------------------------------------------------------------------

export function ReportEmptyState({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
      <Inbox className="h-10 w-10 text-muted-foreground/40" />
      <div className="text-base font-medium text-foreground">{title}</div>
      {subtitle && <p className="text-sm text-center max-w-md">{subtitle}</p>}
    </div>
  );
}

export function ReportErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
      <AlertTriangle className="h-10 w-10 text-red-400" />
      <div className="text-base font-medium text-foreground">
        Couldn't load this report
      </div>
      <p className="text-sm text-center max-w-md">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filter bar
// ---------------------------------------------------------------------------

const DATE_PRESETS: Array<{ id: DatePreset; label: string }> = [
  { id: "today", label: "Today" },
  { id: "7d", label: "7 Days" },
  { id: "30d", label: "30 Days" },
  { id: "90d", label: "90 Days" },
  { id: "thisYear", label: "This Year" },
];

export interface FilterOption {
  value: string;
  label: string;
}

export interface ReportFiltersBarProps {
  range: DateRange;
  onRangeChange: (range: DateRange) => void;
  filters: ReportFilters;
  onFiltersChange: (filters: ReportFilters) => void;
  warehouses?: FilterOption[];
  vendors?: FilterOption[];
  products?: FilterOption[];
  statuses?: FilterOption[];
  onExport?: () => void;
  exportDisabled?: boolean;
  /** Which date field drives this report's range filter, shown as a caption so it's never
   * ambiguous which timestamp a report is filtering on (spec #24). */
  dateFieldNote?: string;
}

export function ReportFiltersBar({
  range,
  onRangeChange,
  filters,
  onFiltersChange,
  warehouses,
  vendors,
  products,
  statuses,
  onExport,
  exportDisabled,
  dateFieldNote,
}: ReportFiltersBarProps) {
  const setPreset = (preset: DatePreset) => onRangeChange(presetRange(preset));

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex gap-1">
            {DATE_PRESETS.map((p) => (
              <Button
                key={p.id}
                type="button"
                variant={range.preset === p.id ? "default" : "outline"}
                size="sm"
                onClick={() => setPreset(p.id)}
              >
                {p.label}
              </Button>
            ))}
          </div>
          <div className="flex items-end gap-2">
            <div>
              <Label className="text-xs">From</Label>
              <Input
                type="date"
                value={range.from}
                max={range.to || undefined}
                className="h-9 w-[150px]"
                onChange={(e) =>
                  onRangeChange({
                    from: e.target.value,
                    to: range.to,
                    preset: "custom",
                  })
                }
              />
            </div>
            <div>
              <Label className="text-xs">To</Label>
              <Input
                type="date"
                value={range.to}
                min={range.from || undefined}
                className="h-9 w-[150px]"
                onChange={(e) =>
                  onRangeChange({
                    from: range.from,
                    to: e.target.value,
                    preset: "custom",
                  })
                }
              />
            </div>
          </div>

          {warehouses && (
            <FilterSelect
              label="Warehouse"
              value={filters.warehouseId}
              options={warehouses}
              onChange={(v) => onFiltersChange({ ...filters, warehouseId: v })}
            />
          )}
          {vendors && (
            <FilterSelect
              label="Supplier"
              value={filters.vendorId}
              options={vendors}
              onChange={(v) => onFiltersChange({ ...filters, vendorId: v })}
            />
          )}
          {products && (
            <FilterSelect
              label="Product"
              value={filters.productCode}
              options={products}
              onChange={(v) => onFiltersChange({ ...filters, productCode: v })}
            />
          )}
          {statuses && (
            <FilterSelect
              label="Status"
              value={filters.status}
              options={statuses}
              onChange={(v) => onFiltersChange({ ...filters, status: v })}
            />
          )}

          {onExport && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="ml-auto"
              onClick={onExport}
              disabled={exportDisabled}
            >
              <Download className="h-4 w-4 mr-2" /> Export CSV
            </Button>
          )}
        </div>
        {dateFieldNote && (
          <p className="text-xs text-muted-foreground">{dateFieldNote}</p>
        )}
      </CardContent>
    </Card>
  );
}

const ALL_LABEL: Record<string, string> = {
  Warehouse: "All Warehouses",
  Supplier: "All Suppliers",
  Product: "All Products",
  Status: "All Statuses",
};

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 w-[160px]">
          <SelectValue placeholder={label} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>
            {ALL_LABEL[label] || `All ${label}s`}
          </SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
