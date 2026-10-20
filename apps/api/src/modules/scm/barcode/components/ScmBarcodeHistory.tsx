// Phase 12 — session-local scan history list (see `barcodeService.ts` for the sessionStorage
// backing store). Purely a convenience view of what was scanned this session — not an audit log.
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/modules/scm/shared/components/ScmButton";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/modules/scm/shared/components/ScmTable";
import { History, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { SCAN_TYPE_LABEL } from "../barcodeResolver";
import type { ScanHistoryEntry } from "../barcodeTypes";

function timeLabel(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ScmBarcodeHistory({
  entries,
  onClear,
}: {
  entries: ScanHistoryEntry[];
  onClear: () => void;
}) {
  const navigate = useNavigate();
  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div className="font-semibold flex items-center gap-2">
          <History className="h-4 w-4" /> Recent Scans
        </div>
        {entries.length > 0 && (
          <Button variant="ghost" size="sm" onClick={onClear}>
            <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Clear
          </Button>
        )}
      </CardHeader>
      <CardContent className="p-0">
        {entries.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            No scans yet this session.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Barcode</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Resolved</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {timeLabel(e.time)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {e.code}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{SCAN_TYPE_LABEL[e.type]}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{e.label}</TableCell>
                    <TableCell>
                      {e.viewPath ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(e.viewPath!)}
                        >
                          View
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
