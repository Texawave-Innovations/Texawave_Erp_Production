import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/modules/scm/shared/components/ScmButton";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  Plus,
  FileText,
  Send,
  Check,
  X,
  Ban,
  ArrowRightCircle,
  AlertTriangle,
  ScanLine,
} from "lucide-react";
import { toast } from "sonner";
import { getAllRecords } from "@/services/firebase";
import { useAuth } from "@/context/AuthContext";
import { notifyAdminFeed } from "@/services/notifications";
import { useErrorToast } from "@/modules/scm/shared/useErrorToast";
import { PROCUREMENT_PATHS } from "./procurementPaths";
import {
  PAGE_SIZE,
  REQUISITION_STATUS_TONE,
  useProcurementMasters,
} from "./procurementHelpers";
import RequisitionFormDialog from "./RequisitionFormDialog";
import type { RequisitionPrefill } from "./requisitionForm";
import ShortageRequisitionDialog from "./ShortageRequisitionDialog";
import type { PurchaseRequisition, RequisitionStatus } from "@/types";
import { logRecordAudit } from "@/services/auditLog";
import { actorName } from "@/modules/scm/shared/actor";
import { transitionStatus } from "@/modules/scm/shared/statusTransition";
import {
  ALL,
  errorMessage,
  formatCurrency,
  formatStatusLabel,
} from "@/modules/scm/shared/format";
import ScmBarcodeScanner from "../barcode/components/ScmBarcodeScanner";
import { addScanHistoryEntry } from "../barcode/barcodeService";

const STATUSES = Object.keys(REQUISITION_STATUS_TONE) as RequisitionStatus[];
const PATH = PROCUREMENT_PATHS.requisitions;

export default function ScmPurchaseRequisitions() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const performedBy = actorName(user);
  const {
    products,
    warehouses,
    loading: mastersLoading,
    error: mastersError,
  } = useProcurementMasters();
  useErrorToast(mastersError);

  const [requisitions, setRequisitions] = useState<PurchaseRequisition[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PurchaseRequisition | null>(null);
  const [prefill, setPrefill] = useState<RequisitionPrefill | null>(null);
  const [shortageOpen, setShortageOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<PurchaseRequisition | null>(
    null,
  );
  const [rejectReason, setRejectReason] = useState("");
  const [scanOpen, setScanOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = (await getAllRecords(PATH)) as PurchaseRequisition[];
      setRequisitions(
        data.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
      );
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to load purchase requisitions"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    return requisitions.filter((r) => {
      if (statusFilter !== ALL && r.status !== statusFilter) return false;
      if (fromDate && r.requestDate < fromDate) return false;
      if (toDate && r.requestDate > toDate) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const hay =
          `${r.requisitionNumber} ${r.requestedBy} ${r.purpose || ""} ${r.department || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [requisitions, statusFilter, fromDate, toDate, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const openCreate = () => {
    setEditing(null);
    setPrefill(null);
    setFormOpen(true);
  };

  const openEdit = (r: PurchaseRequisition) => {
    if (r.status !== "DRAFT") {
      toast.error("Only draft requisitions can be edited");
      return;
    }
    setEditing(r);
    setPrefill(null);
    setFormOpen(true);
  };

  /** Runs a status change with the busy flag, a toast and a reload either way. */
  const runAction = async (
    id: string,
    action: () => Promise<void>,
    success: string,
    failure: string,
  ): Promise<boolean> => {
    setBusyId(id);
    try {
      await action();
      toast.success(success);
      return true;
    } catch (err: unknown) {
      toast.error(errorMessage(err, failure));
      return false;
    } finally {
      setBusyId(null);
      load();
    }
  };

  const submit = (r: PurchaseRequisition) =>
    runAction(
      r.id,
      async () => {
        await transitionStatus<RequisitionStatus>(
          PATH,
          r.id,
          ["DRAFT"],
          "SUBMITTED",
        );
        await logRecordAudit(
          PATH,
          r.id,
          "Requisition submitted",
          performedBy,
          r.requisitionNumber,
        );
        await notifyAdminFeed(
          "Purchase Requisition Submitted",
          `${r.requisitionNumber} by ${performedBy} is awaiting approval`,
          "procurement",
        );
      },
      "Requisition submitted for approval",
      "Failed to submit requisition",
    );

  const approve = (r: PurchaseRequisition) =>
    runAction(
      r.id,
      async () => {
        await transitionStatus<RequisitionStatus>(
          PATH,
          r.id,
          ["SUBMITTED", "UNDER_REVIEW"],
          "APPROVED",
          { approvedBy: performedBy, approvedAt: Date.now() },
        );
        await logRecordAudit(
          PATH,
          r.id,
          "Requisition approved",
          performedBy,
          r.requisitionNumber,
        );
        await notifyAdminFeed(
          "Purchase Requisition Approved",
          `${r.requisitionNumber} approved by ${performedBy} — ready for RFQ`,
          "procurement",
        );
      },
      "Requisition approved",
      "Failed to approve requisition",
    );

  const confirmReject = async () => {
    if (!rejectTarget) return;
    const reason = rejectReason.trim();
    if (!reason) {
      toast.error("A rejection reason is required");
      return;
    }
    const target = rejectTarget;
    const ok = await runAction(
      target.id,
      async () => {
        await transitionStatus<RequisitionStatus>(
          PATH,
          target.id,
          ["SUBMITTED", "UNDER_REVIEW"],
          "REJECTED",
          { rejectionReason: reason },
        );
        await logRecordAudit(
          PATH,
          target.id,
          "Requisition rejected",
          performedBy,
          reason,
        );
        await notifyAdminFeed(
          "Purchase Requisition Rejected",
          `${target.requisitionNumber} rejected by ${performedBy}: ${reason}`,
          "procurement",
        );
      },
      "Requisition rejected",
      "Failed to reject requisition",
    );
    if (ok) {
      setRejectTarget(null);
      setRejectReason("");
    }
  };

  const cancel = (r: PurchaseRequisition) => {
    if (
      !window.confirm(
        `Cancel requisition ${r.requisitionNumber}? This cannot be undone.`,
      )
    )
      return;
    return runAction(
      r.id,
      async () => {
        await transitionStatus<RequisitionStatus>(
          PATH,
          r.id,
          ["DRAFT", "SUBMITTED", "UNDER_REVIEW"],
          "CANCELLED",
        );
        await logRecordAudit(
          PATH,
          r.id,
          "Requisition cancelled",
          performedBy,
          r.requisitionNumber,
        );
      },
      "Requisition cancelled",
      "Failed to cancel requisition",
    );
  };

  const createRfq = (r: PurchaseRequisition) => {
    navigate("/scm/procurement/rfqs", { state: { fromRequisition: r } });
  };

  const handleScan = (code: string) => {
    const scanned = code.trim();
    const match = requisitions.find(
      (r) => r.requisitionNumber.toLowerCase() === scanned.toLowerCase(),
    );
    if (!match) {
      toast.error(`No requisition found for "${scanned}"`);
      addScanHistoryEntry({
        code: scanned,
        type: "UNKNOWN",
        label: "Not found",
        source: "PROCUREMENT",
      });
      return;
    }
    setSearch(match.requisitionNumber);
    setPage(1);
    addScanHistoryEntry({
      code: scanned,
      type: "PURCHASE_REQUISITION",
      label: match.requisitionNumber,
      source: "PROCUREMENT",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Purchase Requisitions
          </h2>
          <p className="text-muted-foreground mt-1">
            Raise and approve internal purchase requisitions before sourcing
            suppliers.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setScanOpen(true)}>
            <ScanLine className="h-4 w-4 mr-2" /> Scan PR
          </Button>
          <Button
            variant="outline"
            onClick={() => setShortageOpen(true)}
            disabled={mastersLoading || warehouses.length === 0}
          >
            <AlertTriangle className="h-4 w-4 mr-2" /> From Sales Order Shortage
          </Button>
          <Button
            onClick={openCreate}
            disabled={mastersLoading || warehouses.length === 0}
          >
            <Plus className="h-4 w-4 mr-2" /> New Requisition
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            <div className="relative w-full md:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by number, requester, purpose..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-10"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Select
                value={statusFilter}
                onValueChange={(v) => {
                  setStatusFilter(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All Statuses</SelectItem>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {formatStatusLabel(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setPage(1);
                }}
                className="w-[150px]"
              />
              <Input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setPage(1);
                }}
                className="w-[150px]"
              />
            </div>
          </div>
          <div className="text-sm text-muted-foreground pt-1">
            {filtered.length} of {requisitions.length} requisitions
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PR #</TableHead>
                  <TableHead>Requester</TableHead>
                  <TableHead>Request Date</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Est. Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center py-16 text-muted-foreground"
                    >
                      Loading requisitions...
                    </TableCell>
                  </TableRow>
                ) : paged.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center py-16 text-muted-foreground"
                    >
                      <div className="flex flex-col items-center gap-3">
                        <FileText className="h-10 w-10 text-muted-foreground/40" />
                        <div className="text-lg font-medium text-foreground">
                          {requisitions.length === 0
                            ? "No purchase requisitions yet"
                            : "No requisitions match the current filters"}
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paged.map((r) => (
                    <TableRow
                      key={r.id}
                      className="hover:bg-muted/50 transition-colors"
                    >
                      <TableCell className="font-mono text-xs">
                        {r.requisitionNumber}
                      </TableCell>
                      <TableCell>
                        {r.requestedBy}
                        {r.department && (
                          <div className="text-xs text-muted-foreground">
                            {r.department}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{r.requestDate}</TableCell>
                      <TableCell>{r.priority}</TableCell>
                      <TableCell>{r.items.length}</TableCell>
                      <TableCell>{formatCurrency(r.total)}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={REQUISITION_STATUS_TONE[r.status]}
                        >
                          {formatStatusLabel(r.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          {r.status === "DRAFT" && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Edit"
                                onClick={() => openEdit(r)}
                                disabled={busyId === r.id}
                              >
                                <FileText className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Submit"
                                onClick={() => submit(r)}
                                disabled={busyId === r.id}
                              >
                                <Send className="h-4 w-4 text-blue-600" />
                              </Button>
                            </>
                          )}
                          {(r.status === "SUBMITTED" ||
                            r.status === "UNDER_REVIEW") && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Approve"
                                onClick={() => approve(r)}
                                disabled={busyId === r.id}
                              >
                                <Check className="h-4 w-4 text-emerald-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Reject"
                                onClick={() => {
                                  setRejectTarget(r);
                                  setRejectReason("");
                                }}
                                disabled={busyId === r.id}
                              >
                                <X className="h-4 w-4 text-red-600" />
                              </Button>
                            </>
                          )}
                          {r.status === "APPROVED" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Create RFQ"
                              onClick={() => createRfq(r)}
                              disabled={busyId === r.id}
                            >
                              <ArrowRightCircle className="h-4 w-4 text-violet-600" />
                            </Button>
                          )}
                          {(r.status === "DRAFT" ||
                            r.status === "SUBMITTED" ||
                            r.status === "UNDER_REVIEW") && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Cancel"
                              onClick={() => cancel(r)}
                              disabled={busyId === r.id}
                            >
                              <Ban className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {pageCount > 1 && (
            <div className="flex items-center justify-end gap-2 p-3 border-t">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {pageCount}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pageCount}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <RequisitionFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
        prefill={prefill}
        products={products}
        warehouses={warehouses}
        performedBy={performedBy}
        onSaved={load}
      />

      <ShortageRequisitionDialog
        open={shortageOpen}
        onOpenChange={setShortageOpen}
        warehouses={warehouses}
        products={products}
        onShortage={(p) => {
          setEditing(null);
          setPrefill(p);
          setFormOpen(true);
        }}
      />

      <Dialog
        open={!!rejectTarget}
        onOpenChange={(o) => {
          if (!o) setRejectTarget(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Reject Requisition {rejectTarget?.requisitionNumber}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label>Rejection Reason *</Label>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder="Explain why this requisition is being rejected"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmReject}
              disabled={busyId === rejectTarget?.id}
            >
              Reject
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
        title="Scan Purchase Requisition"
        placeholder="Requisition number"
      />
    </div>
  );
}
