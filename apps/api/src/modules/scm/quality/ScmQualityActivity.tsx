import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, ScrollText } from "lucide-react";
import { ALL } from "./qualityHelpers";
import { useQualityData } from "./useQualityData";
import type { RecordAuditEntry } from "@/services/auditLog";

interface FeedEntry {
  key: string;
  entityType: "Inspection" | "Defect" | "Template" | "Quarantine";
  entityLabel: string;
  action: string;
  performedBy: string;
  details: string;
  timestamp: number;
  navigateTo?: string;
}

export default function ScmQualityActivity() {
  const navigate = useNavigate();
  const { loading, error, inspections, defects, templates, quarantine } =
    useQualityData();

  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState(ALL);

  const feed = useMemo(() => {
    const entries: FeedEntry[] = [];
    const collect = <
      T extends { id: string; auditLogs?: Record<string, RecordAuditEntry> },
    >(
      records: T[],
      entityType: FeedEntry["entityType"],
      labelFn: (r: T) => string,
      navFn?: (r: T) => string,
    ) => {
      for (const r of records) {
        const logs = Object.values(r.auditLogs || {});
        for (const l of logs) {
          entries.push({
            key: `${entityType}-${r.id}-${l.timestamp}-${l.action}`,
            entityType,
            entityLabel: labelFn(r),
            action: l.action,
            performedBy: l.performedBy,
            details: l.details,
            timestamp: l.timestamp,
            navigateTo: navFn?.(r),
          });
        }
      }
    };
    collect(
      inspections,
      "Inspection",
      (i) => i.inspectionNumber,
      (i) => `/scm/quality/inspections/${i.id}`,
    );
    collect(defects, "Defect", (d) => d.defectCode);
    collect(templates, "Template", (t) => t.templateCode);
    collect(
      quarantine,
      "Quarantine",
      (q) => `${q.productCode} × ${q.quantity}`,
      () => "/scm/quality/quarantine",
    );
    return entries.sort((a, b) => b.timestamp - a.timestamp);
  }, [inspections, defects, templates, quarantine]);

  const filtered = useMemo(() => {
    return feed.filter((e) => {
      if (entityFilter !== ALL && e.entityType !== entityFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (
          !`${e.entityLabel} ${e.action} ${e.details} ${e.performedBy}`
            .toLowerCase()
            .includes(q)
        )
          return false;
      }
      return true;
    });
  }, [feed, entityFilter, search]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Quality Activity</h2>
        <p className="text-muted-foreground mt-1">
          Audit trail of inspections, defects, templates and quarantine changes.
        </p>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <Card>
        <CardContent className="pt-6 flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search action, details, user..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={entityFilter} onValueChange={setEntityFilter}>
            <SelectTrigger className="w-full md:w-52">
              <SelectValue placeholder="Entity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All Entities</SelectItem>
              <SelectItem value="Inspection">Inspections</SelectItem>
              <SelectItem value="Defect">Defects</SelectItem>
              <SelectItem value="Template">Templates</SelectItem>
              <SelectItem value="Quarantine">Quarantine</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-16 text-muted-foreground">
              Loading activity...
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
              <ScrollText className="h-10 w-10 text-muted-foreground/40" />
              <div>No QC activity recorded yet.</div>
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map((e) => (
                <div
                  key={e.key}
                  className={`flex items-center justify-between text-sm p-3 ${e.navigateTo ? "cursor-pointer hover:bg-muted/40" : ""}`}
                  onClick={() => e.navigateTo && navigate(e.navigateTo)}
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{e.entityType}</Badge>
                    <span className="font-mono text-xs text-muted-foreground">
                      {e.entityLabel}
                    </span>
                    <span className="font-medium">{e.action}</span>
                    <span className="text-muted-foreground">— {e.details}</span>
                  </div>
                  <div className="text-xs text-muted-foreground text-right shrink-0 ml-4">
                    {e.performedBy} · {new Date(e.timestamp).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
