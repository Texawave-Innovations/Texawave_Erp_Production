// Phase 11 — SCM Action Center: actionable work items derived from the same exception engine
// as the Control Tower, grouped by the operational category a user would act on them in.
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
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
import { ArrowRight, ListChecks, RefreshCw } from "lucide-react";
import { useControlTowerData } from "./useControlTowerData";
import { buildActionItems, SEVERITY_TONE } from "./advancedHelpers";
import { SEVERITY_ORDER } from "./advancedTypes";
import type { ActionCategory } from "./advancedTypes";
import { ReportEmptyState } from "../reports/reportComponents";
import { ALL } from "../shared/format";

const CATEGORIES: ActionCategory[] = [
  "Procurement",
  "Inventory",
  "Warehouse",
  "Fulfillment",
  "Logistics",
  "Returns",
  "Quality",
];

export default function ScmActionCenter() {
  const navigate = useNavigate();
  const { loading, error, exceptions, reload } = useControlTowerData();
  const [category, setCategory] = useState(ALL);

  const items = useMemo(
    () =>
      buildActionItems(exceptions).sort(
        (a, b) =>
          SEVERITY_ORDER[a.priority] - SEVERITY_ORDER[b.priority] ||
          (b.ageDays ?? 0) - (a.ageDays ?? 0),
      ),
    [exceptions],
  );

  const filtered = useMemo(
    () =>
      category === ALL ? items : items.filter((i) => i.category === category),
    [items, category],
  );

  const countByCategory = useMemo(() => {
    const c: Record<string, number> = {};
    for (const i of items) c[i.category] = (c[i.category] || 0) + 1;
    return c;
  }, [items]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ListChecks className="h-6 w-6 text-brand-600" /> SCM Action Center
          </h2>
          <p className="text-muted-foreground mt-1">
            Actionable work items across procurement, inventory, warehouse,
            fulfillment, logistics, returns and quality.
          </p>
        </div>
        <Button variant="outline" onClick={reload} disabled={loading}>
          <RefreshCw
            className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
          />{" "}
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {CATEGORIES.map((c) => (
          <Card
            key={c}
            className={
              category === c
                ? "ring-2 ring-brand-400 cursor-pointer"
                : "cursor-pointer hover:shadow-md transition-shadow"
            }
            onClick={() => setCategory(category === c ? ALL : c)}
          >
            <CardContent className="p-3">
              <p className="text-xs font-medium text-muted-foreground truncate">
                {c}
              </p>
              <p className="text-xl font-bold mt-1 text-foreground">
                {loading ? "…" : countByCategory[c] || 0}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-9 w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All Categories</SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="ml-auto text-sm text-muted-foreground self-center">
            {filtered.length} action{filtered.length === 1 ? "" : "s"}
          </div>
        </CardContent>
      </Card>

      {error ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            {error}
          </CardContent>
        </Card>
      ) : loading ? (
        <Card>
          <CardContent className="p-16 text-center text-muted-foreground">
            Loading…
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent>
            <ReportEmptyState
              title="No outstanding actions."
              subtitle="Every deterministic rule currently finds nothing to act on."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => (
            <Card
              key={item.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(item.navigationPath)}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className={SEVERITY_TONE[item.priority]}
                    >
                      {item.priority}
                    </Badge>
                    <Badge variant="secondary">{item.category}</Badge>
                    <span className="text-xs font-mono text-muted-foreground">
                      {item.relatedDocument}
                    </span>
                  </div>
                  <p className="font-medium text-foreground mt-1">
                    {item.action}
                  </p>
                  <p className="text-sm text-muted-foreground mt-0.5 truncate">
                    {item.source}
                  </p>
                  {item.ageDays != null && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {item.ageDays === 0
                        ? "Today"
                        : `${item.ageDays} day${item.ageDays === 1 ? "" : "s"} old`}
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    navigate(item.navigationPath);
                  }}
                >
                  Open <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
