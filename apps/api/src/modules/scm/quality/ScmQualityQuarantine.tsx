import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/modules/scm/shared/components/ScmButton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/modules/scm/shared/components/ScmTable";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Search,
  ShieldAlert,
  Eye,
  CheckCircle2,
  XCircle,
  ScanLine,
  Tag,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import {
  ALL,
  QUARANTINE_STATUSES,
  QUARANTINE_STATUS_TONE,
} from "./qualityHelpers";
import { useQualityData } from "./useQualityData";
import {
  rejectQuarantine,
  releaseQuarantine,
  reviewQuarantine,
} from "./quarantineService";
import { errorMessage, formatStatusLabel } from "@/modules/scm/shared/format";
import ScmBarcodeScanner from "../barcode/components/ScmBarcodeScanner";
import ScmBarcodeLabel from "../barcode/components/ScmBarcodeLabel";
import { buildQrPayload } from "../barcode/barcodeHelpers";
import { addScanHistoryEntry } from "../barcode/barcodeService";
import type {
  ScmQualityQuarantineRecord,
  ScmQualityQuarantineStatus,
} from "@/types";
import { actorName } from "@/modules/scm/shared/actor";

export default function ScmQualityQuarantine() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const performedBy = actorName(user);
  const { loading, error, quarantine, reload } = useQualityData();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    ScmQualityQuarantineStatus | typeof ALL
  >("QUARANTINED");

  const [actionRecord, setActionRecord] =
    useState<ScmQualityQuarantineRecord | null>(null);
  const [actionType, setActionType] = useState<"release" | "reject" | null>(
    null,
  );
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [qrFor, setQrFor] = useState<ScmQualityQuarantineRecord | null>(null);

  const filtered = useMemo(() => {
    return quarantine.filter((q) => {
      if (statusFilter !== ALL && q.status !== statusFilter) return false;
      if (
        search.trim() &&
        !`${q.productCode} ${q.productNameSnapshot} ${q.inspectionNumberSnapshot || ""} ${q.sourceNumber || ""}`
          .toLowerCase()
          .includes(search.trim().toLowerCase())
      )
        return false;
      return true;
    });
  }, [quarantine, statusFilter, search]);

  const handleReview = async (record: ScmQualityQuarantineRecord) => {
    try {
      await reviewQuarantine(record, performedBy);
      toast.success("Moved to review");
      reload();
    } catch (err) {
      toast.error(errorMessage(err, "Failed to update quarantine"));
    }
  };

  const openAction = (
    record: ScmQualityQuarantineRecord,
    type: "release" | "reject",
  ) => {
    setActionRecord(record);
    setActionType(type);
    setNotes("");
  };

  const handleConfirmAction = async () => {
    if (!actionRecord || !actionType) return;
    setBusy(true);
    try {
      if (actionType === "release") {
        await releaseQuarantine(actionRecord, notes || undefined, performedBy);
        toast.success("Stock released");
      } else {
        await rejectQuarantine(actionRecord, notes || undefined, performedBy);
        toast.success("Stock rejected (written off)");
      }
      setActionRecord(null);
      setActionType(null);
      reload();
    } catch (err) {
      toast.error(errorMessage(err, "Action failed"));
    } finally {
      setBusy(false);
    }
  };

  const handleScan = (code: string) => {
    const scanned = code.trim();
    const q = scanned.toLowerCase();
    const match = quarantine.find(
      (r) =>
        r.id === scanned ||
        r.productCode.toLowerCase() === q ||
        r.inspectionNumberSnapshot.toLowerCase() === q ||
        r.batchNumber?.toLowerCase() === q,
    );
    if (!match) {
      toast.error(`No quarantine record found for "${scanned}"`);
      addScanHistoryEntry({
        code: scanned,
        type: "UNKNOWN",
        label: "Not found",
        source: "QUALITY",
      });
      return;
    }
    addScanHistoryEntry({
      code: scanned,
      type: "QUARANTINE",
      label: match.productNameSnapshot,
      source: "QUALITY",
    });
    setSearch(match.productCode);
    toast.success(`Found: ${match.productNameSnapshot}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Quarantine Register
          </h2>
          <p className="text-muted-foreground mt-1">
            Stock held pending quality disposition — release must be a
            controlled, explicit decision.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() => setScanOpen(true)}
        >
          <ScanLine className="h-4 w-4 mr-2" /> Scan Quarantine
        </Button>
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
              placeholder="Search product or inspection #..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(v) =>
              setStatusFilter(v as ScmQualityQuarantineStatus | typeof ALL)
            }
          >
            <SelectTrigger className="w-full md:w-52">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All Statuses</SelectItem>
              {QUARANTINE_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {formatStatusLabel(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-16 text-muted-foreground">
              Loading quarantine register...
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
              <ShieldAlert className="h-10 w-10 text-muted-foreground/40" />
              <div>No quarantined stock.</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Batch/Serial</TableHead>
                    <TableHead>Warehouse</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Inspection</TableHead>
                    <TableHead>Defect</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((q) => (
                    <TableRow key={q.id}>
                      <TableCell>
                        {q.productNameSnapshot}
                        <div className="text-xs text-muted-foreground font-mono">
                          {q.productCode}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        {q.batchNumber ||
                          (q.serialNumbers && q.serialNumbers.join(", ")) ||
                          "—"}
                      </TableCell>
                      <TableCell>
                        {q.warehouseNameSnapshot || q.warehouseId}
                      </TableCell>
                      <TableCell>{q.quantity}</TableCell>
                      <TableCell className="text-xs">
                        {q.sourceType}
                        {q.sourceNumber ? ` · ${q.sourceNumber}` : ""}
                      </TableCell>
                      <TableCell
                        className="font-mono text-xs cursor-pointer text-primary hover:underline"
                        onClick={() =>
                          navigate(
                            q.inspectionId
                              ? `/scm/quality/inspections/${q.inspectionId}`
                              : `/scm/returns/${q.sourceId}`,
                          )
                        }
                      >
                        {q.inspectionNumberSnapshot || q.sourceNumber || "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {q.defectCode || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={QUARANTINE_STATUS_TONE[q.status]}
                        >
                          {formatStatusLabel(q.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(q.quarantineDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {q.status === "QUARANTINED" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleReview(q)}
                            >
                              <Eye className="h-3.5 w-3.5 mr-1" /> Review
                            </Button>
                          )}
                          {(q.status === "QUARANTINED" ||
                            q.status === "UNDER_REVIEW") && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-emerald-600"
                                onClick={() => openAction(q, "release")}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />{" "}
                                Release
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600"
                                onClick={() => openAction(q, "reject")}
                              >
                                <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                              </Button>
                            </>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setQrFor(q)}
                          >
                            <Tag className="h-3.5 w-3.5 mr-1" /> Tag
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!actionRecord}
        onOpenChange={(o) => {
          if (!o) {
            setActionRecord(null);
            setActionType(null);
          }
        }}
      >
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {actionType === "release"
                ? "Release Quarantined Stock"
                : "Reject Quarantined Stock (Write Off)"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {actionRecord && (
              <p className="text-sm text-muted-foreground">
                {actionRecord.quantity} × {actionRecord.productCode} at{" "}
                {actionRecord.warehouseNameSnapshot || actionRecord.warehouseId}
                .
                {actionType === "release"
                  ? " This posts a QC_RELEASE entry, returning the quantity to sellable on-hand."
                  : " This permanently writes the quantity off as damaged — it will never return to sellable stock."}
              </p>
            )}
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setActionRecord(null);
                setActionType(null);
              }}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              variant={actionType === "reject" ? "destructive" : "default"}
              disabled={busy}
              onClick={handleConfirmAction}
            >
              {busy
                ? "Saving..."
                : actionType === "release"
                  ? "Confirm Release"
                  : "Confirm Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ScmBarcodeScanner
        open={scanOpen}
        onOpenChange={setScanOpen}
        onResult={(code) => {
          setScanOpen(false);
          handleScan(code);
        }}
        title="Scan Quarantine"
        placeholder="Product code, batch or inspection number"
      />

      <Dialog
        open={!!qrFor}
        onOpenChange={(o) => {
          if (!o) setQrFor(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Quarantine Tag</DialogTitle>
          </DialogHeader>
          {qrFor && (
            <ScmBarcodeLabel
              format="QR"
              value={buildQrPayload("QUARANTINE", qrFor.id, qrFor.id)}
              title={qrFor.productNameSnapshot}
              subtitle={qrFor.batchNumber || qrFor.productCode}
              footer={`Warehouse: ${qrFor.warehouseNameSnapshot || qrFor.warehouseId}`}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
