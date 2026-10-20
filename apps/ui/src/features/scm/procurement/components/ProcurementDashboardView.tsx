"use client";

import { ApiError } from "@texawave-erp/core";
import { Alert, ErrorState, Skeleton } from "@texawave-erp/ui-kit";
import { formatMoney } from "../../shared/format";
import {
  useGoodsReceipts,
  usePurchaseOrders,
  useProcurementDashboard,
  useRequisitions,
} from "../hooks";

import {
  ClipboardCheck,
  FileText,
  type LucideIcon,
  PackageCheck,
  Plus,
  ReceiptText,
  Send,
  ShoppingCart,
  Wallet,
} from "lucide-react";
import {
  ScmDashboardPage,
  type DashboardAction,
} from "../../shared/ScmDashboardPage";
const KPI_ICONS: Record<string, LucideIcon> = {
  "pr-open": ClipboardCheck,
  "pr-ready": FileText,
  "rfq-open": Send,
  quo: ReceiptText,
  "po-approval": ShoppingCart,
  "po-open": ShoppingCart,
  "po-value": Wallet,
  grn: PackageCheck,
};

const ACTIONS: DashboardAction[] = [
  {
    label: "Create Purchase Requisition",
    icon: Plus,
    href: "/scm/procurement/requisitions",
  },
  { label: "Create RFQ", icon: Plus, href: "/scm/procurement/rfqs" },
  {
    label: "Create Supplier Quotation",
    icon: Plus,
    href: "/scm/procurement/quotations",
  },
  {
    label: "Create Purchase Order",
    icon: Plus,
    href: "/scm/procurement/purchase-orders",
  },
  {
    label: "Receive Goods",
    icon: PackageCheck,
    href: "/scm/procurement/goods-receipts",
  },
];

const sum = (m: Record<string, number>, keys?: string[]) =>
  Object.entries(m).reduce(
    (s, [k, v]) => (!keys || keys.includes(k) ? s + v : s),
    0,
  );

/** Legacy `ScmProcurementDashboard`: pipeline KPIs with a link into each
 * document list. */
export function ProcurementDashboardView() {
  const query = useProcurementDashboard();
  const recent = { page: 1, limit: 5 };
  const prs = useRequisitions(recent);
  const pos = usePurchaseOrders(recent);
  const grns = useGoodsReceipts(recent);

  if (query.isPending) {
    return <Skeleton className="h-64 w-full" />;
  }
  if (query.isError) {
    if (query.error instanceof ApiError && query.error.isPermissionError) {
      return (
        <Alert variant="warning" title="You don't have access to procurement">
          Ask an administrator for the <code>scm.procurement.read</code>{" "}
          permission.
        </Alert>
      );
    }
    return <ErrorState onRetry={() => void query.refetch()} />;
  }

  const d = query.data;
  const activity = [
    ...(prs.data?.data ?? []).map((r) => ({
      key: `pr-${r.id}`,
      type: "Requisition",
      label: r.requisitionNumber,
      status: r.status,
      at: r.createdAt,
    })),
    ...(pos.data?.data ?? []).map((p) => ({
      key: `po-${p.id}`,
      type: "Purchase Order",
      label: p.poNumber,
      status: p.status,
      at: p.createdAt,
    })),
    ...(grns.data?.data ?? []).map((g) => ({
      key: `grn-${g.id}`,
      type: "GRN",
      label: g.grnNumber,
      status: g.status,
      at: g.createdAt,
    })),
  ]
    .sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""))
    .slice(0, 8);
  const cards: {
    id: string;
    label: string;
    value: number | string;
    note: string;
    href: string;
    tone?: "warning" | "brand" | "success" | "info" | "blue";
  }[] = [
    {
      id: "pr-open",
      label: "Requisitions Awaiting Approval",
      value: sum(d.requisitions, ["SUBMITTED"]),
      note: "Submitted, not yet decided",
      href: "/scm/procurement/requisitions",
      tone: "warning",
    },
    {
      id: "pr-ready",
      label: "Approved Requisitions",
      value: sum(d.requisitions, ["APPROVED"]),
      note: "Ready for an RFQ",
      href: "/scm/procurement/requisitions",
      tone: "brand",
    },
    {
      id: "rfq-open",
      label: "Open RFQs",
      value: sum(d.rfqs, [
        "RESPONSES_PENDING",
        "PARTIALLY_RESPONDED",
        "RESPONDED",
      ]),
      note: "Accepting quotations",
      href: "/scm/procurement/rfqs",
      tone: "blue",
    },
    {
      id: "quo",
      label: "Quotations to Decide",
      value: sum(d.quotations, ["RECEIVED", "SHORTLISTED"]),
      note: "Received, not yet selected",
      href: "/scm/procurement/comparison",
      tone: "info",
    },
    {
      id: "po-approval",
      label: "POs Awaiting Approval",
      value: sum(d.purchaseOrders, ["PENDING_APPROVAL"]),
      note: "Submitted by buyers",
      href: "/scm/procurement/purchase-orders",
      tone: "warning",
    },
    {
      id: "po-open",
      label: "Open Purchase Orders",
      value: sum(d.purchaseOrders, ["APPROVED", "SENT", "PARTIALLY_RECEIVED"]),
      note: "Committed, goods pending",
      href: "/scm/procurement/purchase-orders",
      tone: "brand",
    },
    {
      id: "po-value",
      label: "Open PO Value",
      value: formatMoney(d.openPurchaseOrderValue, "INR", 0),
      note: "Committed spend not yet received",
      href: "/scm/procurement/purchase-orders",
      tone: "success",
    },
    {
      id: "grn",
      label: "Goods Receipts",
      value: d.goodsReceipts,
      note: "Completed receipts",
      href: "/scm/procurement/goods-receipts",
      tone: "success",
    },
  ];

  return (
    <ScmDashboardPage
      title="Procurement Dashboard"
      subtitle="Real-time view of the requisition → RFQ → quotation → PO → GRN pipeline."
      kpis={cards.map((c) => ({
        id: c.id,
        label: c.label,
        value: c.value,
        href: c.href,
        note: c.note,
        icon: KPI_ICONS[c.id] ?? FileText,
      }))}
      actions={ACTIONS}
      activityEmpty="No procurement activity yet."
      activity={activity}
    />
  );
}
