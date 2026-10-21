import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Boxes,
  ClipboardList,
  Database,
  Factory,
  LayoutDashboard,
  PartyPopper,
  ScanLine,
  ShieldCheck,
  ShoppingBag,
  Siren,
  Warehouse,
} from "lucide-react";

export interface ScmTourStep {
  id: string;
  /** Section grouping shown in the tour. */
  section: "Introduction" | "Core Operations" | "Completion";
  title: string;
  description: string;
  icon: LucideIcon;
  /** Route the step's contextual link navigates to. Omitted for steps that
   * don't link anywhere. */
  route?: string;
  /** Short label for the contextual "Go to X" link. Defaults to the step
   * title when a route is set. */
  navLabel?: string;
}

// One step per real SCM nav area (see `SCM_CATEGORIES` in HorizontalNavbar) —
// kept in sync with the actual nav so the tour never references a page that
// doesn't exist.
export const SCM_TOUR_STEPS: ScmTourStep[] = [
  {
    id: "welcome",
    section: "Introduction",
    title: "Welcome to SCM",
    description:
      "Supply Chain Management brings your suppliers, procurement, inventory, warehouse operations, order fulfillment and quality checks into one connected workspace. This short tour walks through each area so you know exactly where to go for what.",
    icon: Boxes,
  },
  {
    id: "overview",
    section: "Introduction",
    title: "SCM Overview",
    description:
      "Your SCM home page. It shows the Supply Chain Flow at a glance, key metrics, open purchase orders and pending receipts, plus Quick Actions to jump straight into common tasks.",
    icon: LayoutDashboard,
    route: "/scm/overview",
    navLabel: "Overview",
  },
  {
    id: "suppliers",
    section: "Core Operations",
    title: "Suppliers",
    description:
      "Manage your supplier records here — contact details, status and the actions you can take on each supplier.",
    icon: Factory,
    route: "/scm/suppliers",
  },
  {
    id: "barcode",
    section: "Core Operations",
    title: "Barcode & Scanning",
    description:
      "Scan barcodes or QR codes to speed up everyday inventory operations — quickly look up items, generate labels, or move through warehouse tasks without manual data entry.",
    icon: ScanLine,
    route: "/scm/barcode",
  },
  {
    id: "master-data",
    section: "Core Operations",
    title: "Master Data",
    description:
      "A read-only search across every SCM master — products, warehouses, locations, suppliers, batches and serials — the shared foundation the rest of SCM relies on.",
    icon: Database,
    route: "/scm/master-data",
  },
  {
    id: "procurement",
    section: "Core Operations",
    title: "Procurement",
    description:
      "Run the full buying workflow: raise material requisitions, send out RFQs, compare supplier quotations, issue purchase orders, and record goods receipts (GRNs) once items arrive.",
    icon: ClipboardList,
    route: "/scm/procurement",
  },
  {
    id: "inventory-warehouse",
    section: "Core Operations",
    title: "Inventory & Warehouse",
    description:
      "Track stock across every location — put-away, picking and packing — plus the stock ledger, batches, serial numbers, and replenishment recommendations.",
    icon: Warehouse,
    route: "/scm/warehouse",
    navLabel: "Inventory",
  },
  {
    id: "orders",
    section: "Core Operations",
    title: "Orders",
    description:
      "Manage sales order fulfillment end to end: allocate available stock, handle backorders when stock is short, and track fulfillment through to shipment.",
    icon: ShoppingBag,
    route: "/scm/orders/fulfillment",
  },
  {
    id: "quality",
    section: "Core Operations",
    title: "Quality",
    description:
      "Run inspections against quality templates, log and track defects, and manage quarantined stock to keep incoming and outgoing goods up to standard.",
    icon: ShieldCheck,
    route: "/scm/quality",
  },
  {
    id: "reports",
    section: "Core Operations",
    title: "Reports",
    description:
      "Operational reporting across procurement, inventory, warehouse, fulfillment, quality and suppliers — everything you need to review how the supply chain is performing.",
    icon: BarChart3,
    route: "/scm/reports",
  },
  {
    id: "advanced",
    section: "Core Operations",
    title: "Advanced SCM",
    description:
      "Control Tower surfaces exceptions that need attention in real time, and the SCM Assistant answers questions about your supply chain data directly.",
    icon: Siren,
    route: "/scm/advanced/control-tower",
  },
  {
    id: "finish",
    section: "Completion",
    title: "You're all set",
    description:
      "The typical flow ties together like this: Suppliers → Procurement → Purchase Orders → Goods Receipt → Inventory & Warehouse → Orders/Fulfillment → Quality → Reports. You can replay this tour anytime from the SCM Overview page.",
    icon: PartyPopper,
    route: "/scm/overview",
  },
];
