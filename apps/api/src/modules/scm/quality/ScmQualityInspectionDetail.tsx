import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
import {
  ArrowLeft,
  PlayCircle,
  CheckCircle2,
  Ban,
  RefreshCcw,
  ClipboardEdit,
  RotateCw,
  ScanLine,
} from "lucide-react";
import { toast } from "sonner";
import { getAllRecords, getRecordById } from "@/services/firebase";
import { useAuth } from "@/context/AuthContext";
import type { RecordAuditEntry } from "@/services/auditLog";
import { QUALITY_PATHS } from "./qualityPaths";
import ScmBarcodeScanner from "@/modules/scm/barcode/components/ScmBarcodeScanner";
import { addScanHistoryEntry } from "@/modules/scm/barcode/barcodeService";
import {
  DISPOSITION_TONE,
  INSPECTION_STATUS_TONE,
  INSPECTION_TYPE_LABEL,
  PRIORITY_TONE,
  RESULT_TONE,
  canTransitionInspection,
  dispositionQuantity,
} from "./qualityHelpers";
import {
  cancelInspection,
  completeInspection,
  recordItemResult,
  startInspection,
} from "./inspectionService";
import { RecordItemResultDialog } from "./RecordItemResultDialog";
import { ReasonDialog } from "@/modules/scm/returns/ReturnActionDialogs";
import { INVENTORY_PATHS } from "@/modules/scm/inventory/inventoryPaths";
import type {
  ScmQualityDefect,
  ScmQualityInspection,
  ScmQualityInspectionItem,
  ScmQualityQuarantineRecord,
  ScmQualityTemplate,
  StockLedgerEntry,
} from "@/types";
import { actorName } from "@/modules/scm/shared/actor";
import { errorMessage, formatStatusLabel } from "@/modules/scm/shared/format";
import { DetailRow as Row } from "@/modules/scm/shared/components/DetailRow";
import { useAsyncAction } from "@/modules/scm/shared/useAsyncAction";

export default function ScmQualityInspectionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const performedBy = actorName(user);

  const [inspection, setInspection] = useState<ScmQualityInspection | null>(
    null,
  );
  const [template, setTemplate] = useState<ScmQualityTemplate | null>(null);
  const [defects, setDefects] = useState<ScmQualityDefect[]>([]);
  const [quarantineRecords, setQuarantineRecords] = useState<
    ScmQualityQuarantineRecord[]
  >([]);
  const [ledgerEntries, setLedgerEntries] = useState<StockLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [activeItem, setActiveItem] = useState<ScmQualityInspectionItem | null>(
    null,
  );
  const [scanOpen, setScanOpen] = useState(false);
  const [highlightItemId, setHighlightItemId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const insp = (await getRecordById(
        QUALITY_PATHS.inspections,
        id,
      )) as ScmQualityInspection | null;
      setInspection(insp ? { ...insp, items: insp.items || [] } : null);
      const [tpl, def, qtn, ledger] = await Promise.all([
        insp?.templateId
          ? (getRecordById(
              QUALITY_PATHS.templates,
              insp.templateId,
            ) as Promise<ScmQualityTemplate | null>)
          : null,
        getAllRecords(QUALITY_PATHS.defects) as Promise<ScmQualityDefect[]>,
        getAllRecords(QUALITY_PATHS.quarantine) as Promise<
          ScmQualityQuarantineRecord[]
        >,
        getAllRecords(INVENTORY_PATHS.ledger) as Promise<StockLedgerEntry[]>,
      ]);
      setTemplate(tpl);
      setDefects(def);
      setQuarantineRecords(qtn.filter((q) => q.inspectionId === id));
      setLedgerEntries(
        ledger.filter(
          (e) =>
            e.referenceType === "QC_INSPECTION" &&
            (e.referenceId || "").startsWith(`${id}:`),
        ),
      );
    } catch (err) {
      toast.error(errorMessage(err, "Failed to load inspection"));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);
  const { busy, run } = useAsyncAction(load);

  if (loading && !inspection)
    return (
      <div className="text-center py-16 text-muted-foreground">
        Loading inspection...
      </div>
    );
  if (!inspection)
    return (
      <div className="text-center py-16 text-muted-foreground">
        Inspection not found.
        <div className="mt-4">
          <Button
            variant="outline"
            onClick={() => navigate("/scm/quality/inspections")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
        </div>
      </div>
    );

  const insp = inspection;
  const isTerminal = insp.status === "COMPLETED" || insp.status === "CANCELLED";
  const canStart = canTransitionInspection(insp.status, "IN_PROGRESS");
  const canComplete = insp.status === "IN_PROGRESS";
  const canCancel = canTransitionInspection(insp.status, "CANCELLED");
  const auditLogs: RecordAuditEntry[] = Object.values(
    insp.auditLogs || {},
  ).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  // Failed incoming stock is quarantined at completion; offer a prefilled vendor return for it.
  const vendorReturnLines =
    insp.status === "COMPLETED" && insp.inspectionType === "INCOMING"
      ? insp.items.filter(
          (it) => it.disposition === "REJECT" || it.disposition === "REWORK",
        )
      : [];
  const handleScan = (code: string) => {
    const scanned = code.trim().toLowerCase();
    const item = insp.items.find(
      (it) =>
        it.productCode.toLowerCase() === scanned ||
        it.batchNumber?.toLowerCase() === scanned ||
        it.serialNumbers?.some((s) => s.toLowerCase() === scanned),
    );
    if (!item) {
      toast.error(`No inspection item matches "${code.trim()}"`);
      addScanHistoryEntry({
        code: code.trim(),
        type: "UNKNOWN",
        label: "Not found",
        source: "QUALITY",
      });
      return;
    }
    setHighlightItemId(item.id);
    setActiveItem(insp.status === "IN_PROGRESS" ? item : null);
    addScanHistoryEntry({
      code: code.trim(),
      type: "PRODUCT",
      label: item.productNameSnapshot,
      source: "QUALITY",
    });
    window.setTimeout(
      () =>
        setHighlightItemId((current) => (current === item.id ? null : current)),
      3000,
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 mb-1"
            onClick={() => navigate("/scm/quality/inspections")}
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <h2 className="text-2xl font-bold text-foreground font-mono">
            {insp.inspectionNumber}
          </h2>
          <p className="text-muted-foreground mt-1">
            {INSPECTION_TYPE_LABEL[insp.inspectionType]} ·{" "}
            {insp.sourceNumber || insp.sourceId}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={PRIORITY_TONE[insp.priority]}>
            {insp.priority}
          </Badge>
          <Badge
            variant="outline"
            className={INSPECTION_STATUS_TONE[insp.status]}
          >
            {formatStatusLabel(insp.status)}
          </Badge>
          {insp.result && (
            <Badge variant="outline" className={RESULT_TONE[insp.result]}>
              {formatStatusLabel(insp.result)}
            </Badge>
          )}
        </div>
      </div>

      {!isTerminal && (
        <Card>
          <CardHeader className="pb-4">
            <div className="font-semibold">Actions</div>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {canStart && (
              <Button
                disabled={busy}
                onClick={() =>
                  run(
                    () => startInspection(insp, performedBy),
                    "Inspection started",
                  )
                }
              >
                <PlayCircle className="h-4 w-4 mr-2" /> Start Inspection
              </Button>
            )}
            {canComplete && (
              <Button
                disabled={busy}
                onClick={() =>
                  run(
                    () => completeInspection(insp.id, performedBy),
                    "Inspection completed",
                  )
                }
              >
                <CheckCircle2 className="h-4 w-4 mr-2" /> Complete Inspection
              </Button>
            )}
            {canCancel && (
              <Button
                variant="outline"
                className="text-red-600 hover:text-red-700"
                disabled={busy}
                onClick={() => setCancelOpen(true)}
              >
                <Ban className="h-4 w-4 mr-2" /> Cancel
              </Button>
            )}
            <Button variant="ghost" disabled={busy} onClick={() => load()}>
              <RefreshCcw className="h-4 w-4 mr-2" /> Refresh
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-4">
            <div className="font-semibold">Overview</div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Inspection #" value={insp.inspectionNumber} mono />
            <Row
              label="Type"
              value={INSPECTION_TYPE_LABEL[insp.inspectionType]}
            />
            <Row label="Source Type" value={insp.sourceType} />
            <Row
              label="Source #"
              value={insp.sourceNumber || insp.sourceId}
              mono
            />
            {template && <Row label="Template" value={template.name} />}
            <Row
              label="Inspection Date"
              value={
                insp.inspectionDate
                  ? new Date(insp.inspectionDate).toLocaleString()
                  : "—"
              }
            />
            {insp.startedAt && (
              <Row
                label="Started"
                value={new Date(insp.startedAt).toLocaleString()}
              />
            )}
            {insp.completedAt && (
              <Row
                label="Completed"
                value={new Date(insp.completedAt).toLocaleString()}
              />
            )}
            {insp.cancellationReason && (
              <Row
                label="Cancellation Reason"
                value={insp.cancellationReason}
              />
            )}
            {insp.notes && <Row label="Notes" value={insp.notes} />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <div className="font-semibold">Supplier / Customer / Warehouse</div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {insp.supplierNameSnapshot && (
              <Row label="Supplier" value={insp.supplierNameSnapshot} />
            )}
            {insp.customerNameSnapshot && (
              <Row label="Customer" value={insp.customerNameSnapshot} />
            )}
            <Row
              label="Warehouse"
              value={insp.warehouseNameSnapshot || insp.warehouseId || "—"}
            />
            {insp.locationNameSnapshot && (
              <Row label="Location" value={insp.locationNameSnapshot} />
            )}
            <Row label="Created By" value={insp.createdBy} />
            {insp.inspectorName && (
              <Row label="Inspector" value={insp.inspectorName} />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-4 flex flex-row items-center justify-between">
          <div className="font-semibold">Items ({insp.items.length})</div>
          <Button variant="outline" size="sm" onClick={() => setScanOpen(true)}>
            <ScanLine className="h-4 w-4 mr-2" /> Scan Item
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Source Qty</TableHead>
                  <TableHead>Inspected</TableHead>
                  <TableHead>Accepted</TableHead>
                  <TableHead>Rejected</TableHead>
                  <TableHead>Condition</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>Disposition</TableHead>
                  {insp.status === "IN_PROGRESS" && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {insp.items.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell>
                      {it.productNameSnapshot}
                      <div className="text-xs text-muted-foreground font-mono">
                        {it.productCode}
                        {it.batchNumber ? ` · Batch ${it.batchNumber}` : ""}
                      </div>
                    </TableCell>
                    <TableCell>{it.sourceQuantity}</TableCell>
                    <TableCell>{it.inspectedQuantity || "—"}</TableCell>
                    <TableCell>{it.acceptedQuantity || "—"}</TableCell>
                    <TableCell>{it.rejectedQuantity || "—"}</TableCell>
                    <TableCell>{it.condition || "—"}</TableCell>
                    <TableCell>
                      {it.inspectionResult ? (
                        <Badge
                          variant="outline"
                          className={RESULT_TONE[it.inspectionResult]}
                        >
                          {formatStatusLabel(it.inspectionResult)}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      {it.disposition ? (
                        <Badge
                          variant="outline"
                          className={DISPOSITION_TONE[it.disposition]}
                        >
                          {formatStatusLabel(it.disposition)}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    {insp.status === "IN_PROGRESS" && (
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setActiveItem(it)}
                        >
                          <ClipboardEdit className="h-3.5 w-3.5 mr-1" /> Record
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {quarantineRecords.length > 0 && (
        <Card>
          <CardHeader className="pb-4">
            <div className="font-semibold">Quarantine Created</div>
          </CardHeader>
          <CardContent className="space-y-2">
            {quarantineRecords.map((q) => (
              <div
                key={q.id}
                className="border rounded-md p-3 text-sm flex justify-between cursor-pointer hover:bg-muted/40"
                onClick={() => navigate("/scm/quality/quarantine")}
              >
                <div>
                  {q.productCode} × {q.quantity}{" "}
                  <span className="text-muted-foreground">
                    — {q.warehouseId}
                  </span>
                </div>
                <Badge variant="outline">{formatStatusLabel(q.status)}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {ledgerEntries.length > 0 && (
        <Card>
          <CardHeader className="pb-4">
            <div className="font-semibold">Inventory Ledger Entries</div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>In</TableHead>
                  <TableHead>Out</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledgerEntries.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>
                      {e.productName}
                      <div className="text-xs text-muted-foreground font-mono">
                        {e.productCode}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {formatStatusLabel(e.transactionType)}
                      </Badge>
                    </TableCell>
                    <TableCell>{e.quantityIn || "—"}</TableCell>
                    <TableCell>{e.quantityOut || "—"}</TableCell>
                    <TableCell>
                      {new Date(e.transactionDate).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-4">
          <div className="font-semibold">Related Documents</div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between border-b pb-2">
            <span className="text-muted-foreground">
              {insp.sourceType === "GRN"
                ? "GRN"
                : insp.sourceType === "RETURN"
                  ? "Return"
                  : insp.sourceType === "FULFILLMENT"
                    ? "Fulfillment"
                    : "Source"}
            </span>
            <span
              className={
                insp.sourceType !== "INVENTORY"
                  ? "font-mono cursor-pointer text-primary hover:underline"
                  : "font-mono"
              }
              onClick={() => {
                if (insp.sourceType === "GRN") navigate("/scm/procurement/grn");
                else if (insp.sourceType === "RETURN")
                  navigate(`/scm/returns/${insp.sourceId}`);
                else if (insp.sourceType === "FULFILLMENT")
                  navigate(`/scm/orders/fulfillment/${insp.sourceId}`);
              }}
            >
              {insp.sourceNumber || insp.sourceId}
            </span>
          </div>
          {vendorReturnLines.map((it) => (
            <div
              key={it.id}
              className="flex justify-between items-center border-b pb-2"
            >
              <span className="text-muted-foreground">
                {it.productCode} — {dispositionQuantity(it)} quarantined (
                {formatStatusLabel(it.disposition || "")})
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  navigate(
                    `/scm/returns/vendor?grnId=${encodeURIComponent(insp.sourceId)}&productCode=${encodeURIComponent(it.productCode)}&qty=${dispositionQuantity(it)}&reason=${encodeURIComponent(`QC ${insp.inspectionNumber}`)}`,
                  )
                }
              >
                <RotateCw className="h-3.5 w-3.5 mr-1" /> Create Vendor Return
              </Button>
            </div>
          ))}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Credit/Debit Note</span>
            <span className="text-amber-700">
              Not generated — finance integration pending.
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <div className="font-semibold">Activity</div>
        </CardHeader>
        <CardContent>
          {auditLogs.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4 text-center">
              No activity recorded.
            </div>
          ) : (
            <div className="space-y-2">
              {auditLogs.map((a, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between text-sm border-b last:border-0 pb-2 last:pb-0"
                >
                  <div>
                    <span className="font-medium">{a.action}</span>{" "}
                    <span className="text-muted-foreground">— {a.details}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {a.performedBy} · {new Date(a.timestamp).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <RecordItemResultDialog
        item={activeItem}
        template={template}
        defects={defects}
        busy={busy}
        onClose={() => setActiveItem(null)}
        onSave={async (input) => {
          const itemId = activeItem?.id;
          if (
            itemId &&
            (await run(
              () => recordItemResult(insp.id, itemId, input, performedBy),
              "Inspection result recorded",
            ))
          )
            setActiveItem(null);
        }}
      />
      <ReasonDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        busy={busy}
        title="Cancel Inspection"
        confirmLabel="Confirm Cancel"
        onConfirm={async (reason) => {
          if (
            await run(
              () => cancelInspection(insp, reason, performedBy),
              "Inspection cancelled",
            )
          )
            setCancelOpen(false);
        }}
      />
      <ScmBarcodeScanner
        open={scanOpen}
        onOpenChange={setScanOpen}
        onResult={(code) => {
          setScanOpen(false);
          handleScan(code);
        }}
        title="Scan Inspection Item"
        placeholder="Product, batch or serial"
      />
    </div>
  );
}
