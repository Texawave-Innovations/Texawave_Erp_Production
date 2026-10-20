import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Factory,
  ClipboardList,
  FileText,
  Send,
  ReceiptText,
  Scale,
  ShoppingCart,
  PackageCheck,
  Boxes,
  LayoutGrid,
  ScrollText,
  Lock,
  ArrowLeftRight,
  SlidersHorizontal,
  Layers,
  Hash,
  Warehouse as WarehouseIcon,
  Building2,
  MapPin,
  PackagePlus,
  ClipboardCheck,
  PackageOpen,
  ShoppingBag,
  FileStack,
  Split,
  AlertTriangle,
  Truck,
  Undo2,
  ShieldCheck,
  SearchCheck,
  ShieldAlert,
  BarChart3,
  LineChart,
  Users,
  Target,
  ClipboardX,
  BadgeAlert,
  Siren,
  ListChecks,
  Gauge,
  PackageSearch,
  ScanLine,
  Database,
} from "lucide-react";

export interface ScmNavLeaf {
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
  /** Short blurb shown on the stub page for routes not yet built past Phase 1. */
  description: string;
  /** When true, sidebar active-state matching requires an exact pathname match instead of a prefix match. */
  exact?: boolean;
}

export interface ScmNavGroup {
  id: string;
  label: string;
  icon: LucideIcon;
  children: ScmNavLeaf[];
}

export type ScmNavItem = ScmNavLeaf | ScmNavGroup;

export function isScmNavGroup(item: ScmNavItem): item is ScmNavGroup {
  return "children" in item;
}

const SCM_ROOT = "/scm";

export const SCM_NAV: ScmNavItem[] = [
  {
    id: "overview",
    label: "Overview",
    path: `${SCM_ROOT}/overview`,
    icon: LayoutDashboard,
    description: "End-to-end supply chain command center.",
  },
  {
    id: "suppliers",
    label: "Suppliers",
    path: `${SCM_ROOT}/suppliers`,
    icon: Factory,
    description: "Supplier master, performance and documents.",
  },
  {
    id: "barcode",
    label: "Barcode & Scanning",
    path: `${SCM_ROOT}/barcode`,
    icon: ScanLine,
    description:
      "Scan, identify and track products, inventory, locations and SCM documents.",
  },
  {
    id: "master-data",
    label: "Master Data",
    path: `${SCM_ROOT}/master-data`,
    icon: Database,
    description: "Read-only lookup across every SCM master record.",
  },
  {
    id: "procurement",
    label: "Procurement",
    icon: ClipboardList,
    children: [
      {
        id: "procurement-dashboard",
        label: "Dashboard",
        path: `${SCM_ROOT}/procurement`,
        icon: LayoutDashboard,
        description: "Procurement pipeline KPIs and quick actions.",
        exact: true,
      },
      {
        id: "requisitions",
        label: "Purchase Requisitions",
        path: `${SCM_ROOT}/procurement/requisitions`,
        icon: FileText,
        description: "Raise and approve internal purchase requisitions.",
      },
      {
        id: "rfqs",
        label: "RFQs",
        path: `${SCM_ROOT}/procurement/rfqs`,
        icon: Send,
        description:
          "Request quotations from suppliers against an approved requisition.",
      },
      {
        id: "quotations",
        label: "Supplier Quotations",
        path: `${SCM_ROOT}/procurement/quotations`,
        icon: ReceiptText,
        description: "Record supplier responses to RFQs.",
      },
      {
        id: "comparison",
        label: "Quotation Comparison",
        path: `${SCM_ROOT}/procurement/comparison`,
        icon: Scale,
        description:
          "Compare supplier quotations side by side before approval.",
      },
      {
        id: "purchase-orders",
        label: "Purchase Orders",
        path: `${SCM_ROOT}/procurement/purchase-orders`,
        icon: ShoppingCart,
        description:
          "Purchase orders raised against approved supplier quotations.",
      },
      {
        id: "grn",
        label: "GRNs",
        path: `${SCM_ROOT}/procurement/grn`,
        icon: PackageCheck,
        description:
          "Goods receipt notes recording accepted, damaged and rejected quantities.",
      },
    ],
  },
  // Inventory and Warehouse consolidated into one module/nav group per the client's request to
  // "club Inventory and Warehouse together and bring a flow" — no route paths changed (still
  // `/scm/inventory/*` and `/scm/warehouse/*`, so nothing that deep-links into either is broken),
  // only their sidebar presentation is merged. Ordered to read as the actual receive → store →
  // operate → audit flow: warehouse dashboard/stock structure first, then day-to-day stock
  // operations, then the append-only ledger and lot/serial detail at the end. Inventory
  // Intelligence and Replenishment (previously under Advanced SCM) are folded in here too, since
  // both are inventory tools, as part of simplifying Advanced SCM down to its exception/action
  // views (see the `advanced` group below).
  {
    id: "inventory-warehouse",
    label: "Inventory",
    icon: WarehouseIcon,
    children: [
      {
        id: "warehouse-dashboard",
        label: "Dashboard",
        path: `${SCM_ROOT}/warehouse`,
        icon: LayoutDashboard,
        description:
          "Warehouse capacity, occupancy and put-away/picking/packing KPIs.",
        exact: true,
      },
      {
        id: "stock-overview",
        label: "Stock Overview",
        path: `${SCM_ROOT}/inventory/overview`,
        icon: LayoutGrid,
        description:
          "On-hand, reserved, available and incoming stock by product.",
      },
      {
        id: "warehouses",
        label: "Warehouses",
        path: `${SCM_ROOT}/warehouse/warehouses`,
        icon: Building2,
        description: "Warehouse master records.",
      },
      {
        id: "locations",
        label: "Locations",
        path: `${SCM_ROOT}/warehouse/locations`,
        icon: MapPin,
        description: "Zone → Rack → Shelf → Bin hierarchy within a warehouse.",
      },
      {
        id: "warehouse-stock",
        label: "Stock View",
        path: `${SCM_ROOT}/warehouse/stock`,
        icon: LayoutGrid,
        description: "On-hand stock by warehouse, location, batch and serial.",
      },
      {
        id: "putaway",
        label: "Put-away",
        path: `${SCM_ROOT}/warehouse/putaway`,
        icon: PackagePlus,
        description: "Put received stock away into bin locations.",
      },
      {
        id: "picking",
        label: "Picking",
        path: `${SCM_ROOT}/warehouse/picking`,
        icon: ClipboardCheck,
        description: "Pick lists generated from eligible sales orders.",
      },
      {
        id: "packing",
        label: "Packing",
        path: `${SCM_ROOT}/warehouse/packing`,
        icon: PackageOpen,
        description: "Pack picked items into shippable packages.",
      },
      {
        id: "movements",
        label: "Internal Movements",
        path: `${SCM_ROOT}/warehouse/movements`,
        icon: ArrowLeftRight,
        description:
          "Move stock between bins, shelves, racks or zones in the same warehouse.",
      },
      {
        id: "transfers",
        label: "Transfers",
        path: `${SCM_ROOT}/inventory/transfers`,
        icon: ArrowLeftRight,
        description: "Warehouse-to-warehouse stock transfers.",
      },
      {
        id: "reservations",
        label: "Reservations",
        path: `${SCM_ROOT}/inventory/reservations`,
        icon: Lock,
        description: "Stock reserved against confirmed sales orders.",
      },
      {
        id: "adjustments",
        label: "Adjustments",
        path: `${SCM_ROOT}/inventory/adjustments`,
        icon: SlidersHorizontal,
        description: "Manual stock corrections with an audited reason.",
      },
      {
        id: "stock-ledger",
        label: "Stock Ledger",
        path: `${SCM_ROOT}/inventory/ledger`,
        icon: ScrollText,
        description:
          "Authoritative, append-only history of every stock movement.",
      },
      {
        id: "batches",
        label: "Batches",
        path: `${SCM_ROOT}/inventory/batches`,
        icon: Layers,
        description: "Batch/lot tracked stock.",
      },
      {
        id: "serials",
        label: "Serial Numbers",
        path: `${SCM_ROOT}/inventory/serials`,
        icon: Hash,
        description: "Serial-number tracked stock.",
      },
      {
        id: "warehouse-activity",
        label: "Activity",
        path: `${SCM_ROOT}/warehouse/activity`,
        icon: ScrollText,
        description:
          "Audit trail of warehouse, location, put-away, movement, picking and packing changes.",
      },
      {
        id: "inventory-intelligence",
        label: "Stock Intelligence",
        path: `${SCM_ROOT}/inventory/intelligence`,
        icon: Gauge,
        description:
          "Stock health, valuation and fast/slow/dead-stock movement analysis.",
      },
      {
        id: "replenishment",
        label: "Replenishment",
        path: `${SCM_ROOT}/inventory/replenishment`,
        icon: PackageSearch,
        description:
          "Deterministic reorder recommendations from stock and ledger history.",
      },
    ],
  },
  {
    id: "orders",
    label: "Orders",
    icon: ShoppingBag,
    children: [
      {
        id: "sales-orders",
        label: "Sales Orders",
        path: `${SCM_ROOT}/orders/sales-orders`,
        icon: FileStack,
        description: "Sales orders with SCM fulfillment status.",
      },
      {
        id: "allocation",
        label: "Allocation",
        path: `${SCM_ROOT}/orders/allocation`,
        icon: Split,
        description: "Allocate available stock against open sales orders.",
      },
      {
        id: "backorders",
        label: "Backorders",
        path: `${SCM_ROOT}/orders/backorders`,
        icon: AlertTriangle,
        description: "Orders waiting on stock shortage or procurement.",
      },
      {
        id: "fulfillment",
        label: "Fulfillment",
        path: `${SCM_ROOT}/orders/fulfillment`,
        icon: Truck,
        description: "Pick, pack and ship progress across open orders.",
      },
    ],
  },
  // Logistics and Returns removed from the user-facing SCM navigation per the client's request
  // ("remove logistics" / "remove return"). Their routes (`/scm/logistics/*`, `/scm/returns/*`),
  // pages, services and Firebase data are all untouched and still fully mounted in App.tsx — they
  // stay reachable via the places that already deep-link into them directly rather than through
  // this sidebar (Order fulfillment, Quality inspections/quarantine, the Stock Ledger's return
  // references, Master Data's carrier lookup, Barcode scanning, the AI copilot, Advanced SCM's
  // exception feed, and Reports/Executive KPIs), so removing them here creates no dead links and
  // deletes no functionality or data — only their standalone entry points from the primary SCM
  // workflow are gone.
  {
    id: "quality",
    label: "Quality",
    icon: ShieldCheck,
    children: [
      {
        id: "quality-dashboard",
        label: "Quality Overview",
        path: `${SCM_ROOT}/quality`,
        icon: LayoutDashboard,
        description: "QC KPIs, pending inspections and quarantine summary.",
        exact: true,
      },
      {
        id: "inspections",
        label: "Inspections",
        path: `${SCM_ROOT}/quality/inspections`,
        icon: SearchCheck,
        description:
          "Incoming, return, inventory and pre-dispatch quality inspections.",
      },
      {
        id: "quality-templates",
        label: "Templates",
        path: `${SCM_ROOT}/quality/templates`,
        icon: ClipboardCheck,
        description: "Reusable inspection checkpoint templates.",
      },
      {
        id: "quality-defects",
        label: "Defects",
        path: `${SCM_ROOT}/quality/defects`,
        icon: BadgeAlert,
        description: "Defect master — codes, categories and severity.",
      },
      {
        id: "quarantine",
        label: "Quarantine",
        path: `${SCM_ROOT}/quality/quarantine`,
        icon: ShieldAlert,
        description: "Stock held pending quality disposition.",
      },
      {
        id: "quality-activity",
        label: "Activity",
        path: `${SCM_ROOT}/quality/activity`,
        icon: ClipboardX,
        description:
          "Audit trail of QC inspections, defects and quarantine changes.",
      },
    ],
  },
  {
    id: "reports",
    label: "Reports",
    icon: BarChart3,
    children: [
      {
        id: "reports-overview",
        label: "Overview",
        path: `${SCM_ROOT}/reports`,
        icon: LayoutDashboard,
        description:
          "Executive SCM KPIs across procurement, inventory, warehouse, fulfillment, logistics, returns and quality.",
        exact: true,
      },
      {
        id: "reports-procurement",
        label: "Procurement",
        path: `${SCM_ROOT}/reports/procurement`,
        icon: LineChart,
        description:
          "Purchase analysis, PR/PO/GRN pipeline and pending receipts.",
      },
      {
        id: "reports-inventory",
        label: "Inventory",
        path: `${SCM_ROOT}/reports/inventory`,
        icon: BarChart3,
        description:
          "Stock valuation, category mix, movement trend and low/out-of-stock exposure.",
      },
      {
        id: "reports-warehouse",
        label: "Warehouse",
        path: `${SCM_ROOT}/reports/warehouse`,
        icon: WarehouseIcon,
        description:
          "Warehouse footprint, operations volume and location utilization.",
      },
      {
        id: "reports-fulfillment",
        label: "Fulfillment",
        path: `${SCM_ROOT}/reports/fulfillment`,
        icon: Target,
        description: "Order fulfillment, backorders and availability.",
      },
      {
        id: "reports-logistics",
        label: "Logistics",
        path: `${SCM_ROOT}/reports/logistics`,
        icon: Truck,
        description: "Shipment status, delays and freight analysis.",
      },
      {
        id: "reports-returns",
        label: "Returns",
        path: `${SCM_ROOT}/reports/returns`,
        icon: Undo2,
        description: "Return volume, reasons, dispositions and return rate.",
      },
      {
        id: "reports-quality",
        label: "Quality",
        path: `${SCM_ROOT}/reports/quality`,
        icon: ShieldCheck,
        description:
          "QC results, defect severity/category mix and quarantine trend.",
      },
      {
        id: "reports-suppliers",
        label: "Suppliers",
        path: `${SCM_ROOT}/reports/suppliers`,
        icon: Users,
        description: "Supplier spend, receipts, returns and QC outcomes.",
      },
    ],
  },
  // Simplified per the client's request to "make advance SCM simple": down from 5 mixed-purpose
  // entries to the 3 that are genuinely cross-module oversight (not a second, competing SCM
  // system). Inventory Intelligence and Replenishment moved into the Inventory & Warehouse group
  // above, since both are inventory-specific tools, not cross-module exceptions — no route or
  // functionality change, just where each link lives in the sidebar.
  {
    id: "advanced",
    label: "Advanced SCM",
    icon: Siren,
    children: [
      {
        id: "control-tower",
        label: "Control Tower",
        path: `${SCM_ROOT}/control-tower`,
        icon: Siren,
        description:
          "Real-time operational exceptions across every SCM module.",
      },
      {
        id: "action-center",
        label: "Action Center",
        path: `${SCM_ROOT}/action-center`,
        icon: ListChecks,
        description: "Actionable SCM work items, grouped by category.",
      },
      {
        id: "supplier-intelligence",
        label: "Supplier Intelligence",
        path: `${SCM_ROOT}/suppliers/intelligence`,
        icon: Users,
        description:
          "Transparent supplier performance metrics — no black-box scoring.",
      },
    ],
  },
];
