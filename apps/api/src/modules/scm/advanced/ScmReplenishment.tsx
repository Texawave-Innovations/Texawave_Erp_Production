// Phase 11 — Demand / Replenishment Assistant. A deterministic reorder recommendation engine —
// no AI, no demand prediction. Every recommendation shows exactly why it was generated; see
// `replenishmentService.ts` for the formula.
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/modules/scm/shared/components/ScmTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/modules/scm/shared/components/ScmButton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { PackageSearch, RefreshCw } from "lucide-react";
import { useControlTowerData } from "./useControlTowerData";
import { formatNumber } from "../reports/reportHelpers";
import { ReportEmptyState } from "../reports/reportComponents";
import type { ReplenishmentStatus } from "./advancedTypes";
import { ALL } from "../shared/format";

const STATUSES: ReplenishmentStatus[] = [
  "Reorder Now",
  "Monitor",
  "Overstock",
  "No Recommendation",
];

const STATUS_TONE: Record<ReplenishmentStatus, string> = {
  "Reorder Now": "text-red-700 border-red-300 bg-red-50",
  Monitor: "text-blue-700 border-blue-200 bg-blue-50",
  Overstock: "text-purple-700 border-purple-200 bg-purple-50",
  "No Recommendation": "text-slate-600 border-slate-200 bg-slate-50",
};

export default function ScmReplenishment() {
  const navigate = useNavigate();
  const { loading, error, replenishment, reload } = useControlTowerData();
  const [status, setStatus] = useState<string>("Reorder Now");
  const [search, setSearch] = useState("");

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of replenishment) c[r.status] = (c[r.status] || 0) + 1;
    return c;
  }, [replenishment]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return replenishment
      .filter((r) => status === ALL || r.status === status)
      .filter(
        (r) =>
          !q ||
          r.productName.toLowerCase().includes(q) ||
          r.productCode.toLowerCase().includes(q),
      )
      .sort(
        (a, b) => (a.daysOfCover ?? Infinity) - (b.daysOfCover ?? Infinity),
      );
  }, [replenishment, status, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <PackageSearch className="h-6 w-6 text-brand-600" /> Replenishment
            Assistant
          </h2>
          <p className="text-muted-foreground mt-1">
            Deterministic reorder recommendations from actual stock levels and
            sales-issue ledger history — never a demand prediction.
          </p>
        </div>
        <Button variant="outline" onClick={reload} disabled={loading}>
          <RefreshCw
            className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
          />{" "}
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {STATUSES.map((s) => (
          <Card
            key={s}
            className={
              status === s
                ? "ring-2 ring-brand-400 cursor-pointer"
                : "cursor-pointer hover:shadow-md transition-shadow"
            }
            onClick={() => setStatus(status === s ? ALL : s)}
          >
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground">{s}</p>
              <p className="text-2xl font-bold mt-1 text-foreground">
                {loading ? "…" : counts[s] || 0}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-9 w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All Statuses</SelectItem>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Search Product</Label>
              <input
                className="h-9 w-[220px] rounded-md border border-input bg-background px-3 text-sm"
                placeholder="Product name or code..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="ml-auto text-sm text-muted-foreground self-center">
              {filtered.length} recommendation{filtered.length === 1 ? "" : "s"}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>Available</TableHead>
                  <TableHead>Reorder Level</TableHead>
                  <TableHead>Avg. Daily Use</TableHead>
                  <TableHead>Days of Cover</TableHead>
                  <TableHead>Suggested Qty</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Why</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="text-center py-16 text-muted-foreground"
                    >
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : error ? (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="text-center py-16 text-muted-foreground"
                    >
                      {error}
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="p-0">
                      <ReportEmptyState title="No recommendations match these filters." />
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((r) => (
                    <TableRow
                      key={r.id}
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() =>
                        navigate(
                          `/scm/inventory/overview/${encodeURIComponent(r.productCode)}`,
                        )
                      }
                    >
                      <TableCell className="font-medium">
                        {r.productName}
                      </TableCell>
                      <TableCell>{r.warehouseName}</TableCell>
                      <TableCell>{formatNumber(r.availableStock)}</TableCell>
                      <TableCell>
                        {r.reorderLevel != null ? (
                          formatNumber(r.reorderLevel)
                        ) : (
                          <Badge variant="outline">N/A</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {r.avgDailyConsumption != null ? (
                          r.avgDailyConsumption.toFixed(2)
                        ) : (
                          <Badge variant="outline">N/A</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {r.daysOfCover != null ? (
                          r.daysOfCover.toFixed(1)
                        ) : (
                          <Badge variant="outline">N/A</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {r.suggestedReorderQty != null
                          ? formatNumber(r.suggestedReorderQty)
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={STATUS_TONE[r.status]}
                        >
                          {r.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-xs">
                        {r.reason}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
