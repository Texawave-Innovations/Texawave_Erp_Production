import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/modules/scm/shared/components/ScmTable";
import { Search, ScrollText } from "lucide-react";
import { toast } from "sonner";
import { getAllRecords } from "@/services/firebase";
import { INVENTORY_PATHS } from "../inventory/inventoryPaths";
import { WAREHOUSE_PATHS } from "./warehousePaths";
import type { RecordAuditEntry } from "@/services/auditLog";
import { errorMessage } from "@/modules/scm/shared/format";

interface ActivityRow extends RecordAuditEntry {
  key: string;
  sourceType: string;
  recordLabel: string;
}

/** Any audited record: an id, its audit subnode, and whichever number/code fields label it. */
interface AuditedRecord {
  id: string;
  auditLogs?: Record<string, RecordAuditEntry>;
  [field: string]: unknown;
}

const str = (v: unknown) => (typeof v === "string" ? v : "");

const SOURCES: {
  type: string;
  path: string;
  label: (r: AuditedRecord) => string;
}[] = [
  {
    type: "Warehouse",
    path: INVENTORY_PATHS.warehouses,
    label: (r) => `${str(r.code)} — ${str(r.name)}`,
  },
  {
    type: "Location",
    path: INVENTORY_PATHS.locations,
    label: (r) => str(r.locationCode) || str(r.binCode),
  },
  {
    type: "Put-away",
    path: WAREHOUSE_PATHS.putaways,
    label: (r) => str(r.putawayNumber),
  },
  {
    type: "Movement",
    path: WAREHOUSE_PATHS.movements,
    label: (r) => str(r.movementNumber),
  },
  {
    type: "Picking",
    path: WAREHOUSE_PATHS.pickings,
    label: (r) => str(r.pickNumber),
  },
  {
    type: "Packing",
    path: WAREHOUSE_PATHS.packings,
    label: (r) => str(r.packNumber),
  },
];

export default function ScmWarehouseActivity() {
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const results = await Promise.all(
          SOURCES.map(
            (source) => getAllRecords(source.path) as Promise<AuditedRecord[]>,
          ),
        );
        const all: ActivityRow[] = [];
        results.forEach((records, i) => {
          const source = SOURCES[i];
          for (const record of records) {
            for (const [key, entry] of Object.entries(record.auditLogs || {})) {
              all.push({
                key: `${source.type}-${record.id}-${key}`,
                sourceType: source.type,
                recordLabel: source.label(record),
                ...entry,
              });
            }
          }
        });
        setRows(all.sort((a, b) => b.timestamp - a.timestamp));
      } catch (err: unknown) {
        toast.error(errorMessage(err, "Failed to load warehouse activity"));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      `${r.sourceType} ${r.recordLabel} ${r.action} ${r.performedBy} ${r.details}`
        .toLowerCase()
        .includes(q),
    );
  }, [rows, search]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">
          Warehouse Activity
        </h2>
        <p className="text-muted-foreground mt-1">
          Audit trail of warehouse, location, put-away, movement, picking and
          packing changes.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="relative w-full md:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search activity..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="text-sm text-muted-foreground pt-1">
            {filtered.length} of {rows.length} activity entries
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Record</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Performed By</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center py-16 text-muted-foreground"
                    >
                      Loading activity...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center py-16 text-muted-foreground"
                    >
                      <div className="flex flex-col items-center gap-3">
                        <ScrollText className="h-10 w-10 text-muted-foreground/40" />
                        <div className="text-lg font-medium text-foreground">
                          No warehouse activity yet
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.slice(0, 300).map((r) => (
                    <TableRow
                      key={r.key}
                      className="hover:bg-muted/50 transition-colors"
                    >
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(r.timestamp).toLocaleString("en-IN")}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{r.sourceType}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {r.recordLabel}
                      </TableCell>
                      <TableCell>{r.action}</TableCell>
                      <TableCell className="text-sm">{r.performedBy}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.details}
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
