import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/modules/scm/shared/components/ScmButton";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Send,
  ReceiptText,
  ShoppingCart,
  PackageCheck,
  Plus,
  ClipboardCheck,
} from "lucide-react";
import { getAllRecords } from "@/services/firebase";
import { PROCUREMENT_PATHS } from "./procurementPaths";
import {
  REQUISITION_STATUS_TONE,
  PO_STATUS_TONE,
  GRN_STATUS_TONE,
} from "./procurementHelpers";
import {
  DashboardKpiGrid,
  type DashboardKpi,
} from "@/modules/scm/shared/components/DashboardKpiGrid";
import {
  OPEN_PO_STATUSES,
  RECEIVABLE_PO_STATUSES,
} from "@/modules/scm/shared/businessRules";
import { formatStatusLabel } from "@/modules/scm/shared/format";
import { toast } from "sonner";
import type {
  PurchaseRequisition,
  Rfq,
  SupplierQuotation,
  ScmPurchaseOrder,
  GoodsReceipt,
} from "@/types";

export default function ScmProcurementDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [requisitions, setRequisitions] = useState<PurchaseRequisition[]>([]);
  const [rfqs, setRfqs] = useState<Rfq[]>([]);
  const [quotations, setQuotations] = useState<SupplierQuotation[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<ScmPurchaseOrder[]>([]);
  const [grns, setGrns] = useState<GoodsReceipt[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [pr, rfq, quo, po, grn] = await Promise.all([
          getAllRecords(PROCUREMENT_PATHS.requisitions) as Promise<
            PurchaseRequisition[]
          >,
          getAllRecords(PROCUREMENT_PATHS.rfqs) as Promise<Rfq[]>,
          getAllRecords(PROCUREMENT_PATHS.quotations) as Promise<
            SupplierQuotation[]
          >,
          getAllRecords(PROCUREMENT_PATHS.purchaseOrders) as Promise<
            ScmPurchaseOrder[]
          >,
          getAllRecords(PROCUREMENT_PATHS.grns) as Promise<GoodsReceipt[]>,
        ]);
        if (cancelled) return;
        setRequisitions(pr);
        setRfqs(rfq);
        setQuotations(quo);
        setPurchaseOrders(po);
        setGrns(grn);
      } catch {
        if (!cancelled) toast.error("Failed to load procurement data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const draftPRs = requisitions.filter((r) => r.status === "DRAFT").length;
  // Only statuses the workflow actually sets are counted (ISSUED / UNDER_REVIEW / SHORTLISTED never are).
  const pendingPRApprovals = requisitions.filter(
    (r) => r.status === "SUBMITTED",
  ).length;
  const openRfqs = rfqs.filter(
    (r) =>
      r.status === "RESPONSES_PENDING" ||
      r.status === "PARTIALLY_RESPONDED" ||
      r.status === "RESPONDED",
  ).length;
  const pendingQuotations = rfqs.filter(
    (r) =>
      r.status === "RESPONSES_PENDING" || r.status === "PARTIALLY_RESPONDED",
  ).length;
  const pendingComparisons = quotations.filter(
    (q) => q.status === "RECEIVED",
  ).length;
  const pendingPOApprovals = purchaseOrders.filter(
    (p) => p.status === "PENDING_APPROVAL",
  ).length;
  const openPOs = purchaseOrders.filter((p) =>
    OPEN_PO_STATUSES.has(p.status),
  ).length;
  const pendingGRNs = purchaseOrders.filter((p) =>
    RECEIVABLE_PO_STATUSES.has(p.status),
  ).length;

  const kpis: DashboardKpi[] = [
    {
      id: "draft-pr",
      label: "Draft Purchase Requisitions",
      value: draftPRs,
      icon: FileText,
      onClick: () => navigate("/scm/procurement/requisitions"),
    },
    {
      id: "pending-pr",
      label: "Pending PR Approvals",
      value: pendingPRApprovals,
      icon: ClipboardCheck,
      onClick: () => navigate("/scm/procurement/requisitions"),
    },
    {
      id: "open-rfq",
      label: "Open RFQs",
      value: openRfqs,
      icon: Send,
      onClick: () => navigate("/scm/procurement/rfqs"),
    },
    {
      id: "pending-quo",
      label: "Pending Supplier Quotations",
      value: pendingQuotations,
      icon: ReceiptText,
      onClick: () => navigate("/scm/procurement/quotations"),
    },
    {
      id: "pending-comparison",
      label: "Pending Quotation Comparisons",
      value: pendingComparisons,
      icon: ReceiptText,
      onClick: () => navigate("/scm/procurement/comparison"),
    },
    {
      id: "pending-po",
      label: "Pending PO Approvals",
      value: pendingPOApprovals,
      icon: ShoppingCart,
      onClick: () => navigate("/scm/procurement/purchase-orders"),
    },
    {
      id: "open-po",
      label: "Open Purchase Orders",
      value: openPOs,
      icon: ShoppingCart,
      onClick: () => navigate("/scm/procurement/purchase-orders"),
    },
    {
      id: "pending-grn",
      label: "Pending Goods Receipts",
      value: pendingGRNs,
      icon: PackageCheck,
      onClick: () => navigate("/scm/procurement/grn"),
    },
  ];

  const recentActivity = [
    ...requisitions.map((r) => ({
      id: r.id,
      type: "Requisition",
      label: r.requisitionNumber,
      status: r.status,
      tone: REQUISITION_STATUS_TONE[r.status],
      at: r.createdAt,
    })),
    ...purchaseOrders.map((p) => ({
      id: p.id,
      type: "Purchase Order",
      label: p.poNumber,
      status: p.status,
      tone: PO_STATUS_TONE[p.status],
      at: p.createdAt,
    })),
    ...grns.map((g) => ({
      id: g.id,
      type: "GRN",
      label: g.grnNumber,
      status: g.status,
      tone: GRN_STATUS_TONE[g.status],
      at: g.createdAt,
    })),
  ]
    .sort((a, b) => (b.at || 0) - (a.at || 0))
    .slice(0, 8);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">
          Procurement Dashboard
        </h2>
        <p className="text-muted-foreground mt-1">
          Real-time view of the requisition → RFQ → quotation → PO → GRN
          pipeline.
        </p>
      </div>

      <DashboardKpiGrid kpis={kpis} loading={loading} />

      <Card>
        <CardHeader className="pb-4">
          <div className="font-semibold">Quick Actions</div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={() => navigate("/scm/procurement/requisitions")}
          >
            <Plus className="h-4 w-4 mr-2" /> Create Purchase Requisition
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate("/scm/procurement/rfqs")}
          >
            <Plus className="h-4 w-4 mr-2" /> Create RFQ
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate("/scm/procurement/quotations")}
          >
            <Plus className="h-4 w-4 mr-2" /> Create Supplier Quotation
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate("/scm/procurement/purchase-orders")}
          >
            <Plus className="h-4 w-4 mr-2" /> Create Purchase Order
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate("/scm/procurement/grn")}
          >
            <PackageCheck className="h-4 w-4 mr-2" /> Receive Goods
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <div className="font-semibold">Recent Activity</div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground py-6 text-center">
              Loading...
            </div>
          ) : recentActivity.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">
              No procurement activity yet.
            </div>
          ) : (
            <div className="space-y-2">
              {recentActivity.map((a) => (
                <div
                  key={`${a.type}-${a.id}`}
                  className="flex items-center justify-between text-sm border-b last:border-0 pb-2 last:pb-0"
                >
                  <div>
                    <span className="text-muted-foreground">{a.type}</span>{" "}
                    <span className="font-mono">{a.label}</span>
                  </div>
                  <Badge variant="outline" className={a.tone}>
                    {formatStatusLabel(a.status)}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
