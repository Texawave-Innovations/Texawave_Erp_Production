import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/modules/scm/shared/components/ScmButton";
import {
  ClipboardList,
  Boxes,
  Warehouse as WarehouseIcon,
  Target,
  Truck,
  Undo2,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";
import { useScmReportsData } from "./reportService";
import {
  computeExecutiveSummary,
  EMPTY_FILTERS,
  type ReportFilters,
} from "./calculations";
import { formatCurrency } from "../shared/format";
import { presetRange, formatNumber, formatPercent } from "./reportHelpers";
import { ReportFiltersBar, ReportErrorState } from "./reportComponents";

interface DomainCard {
  id: string;
  title: string;
  icon: typeof ClipboardList;
  path: string;
  metrics: Array<{ label: string; value: string }>;
}

const DOMAIN_CARD_COUNT = 7;

export default function ScmReportsDashboard() {
  const navigate = useNavigate();
  const { loading, error, data, reload } = useScmReportsData();
  const [range, setRange] = useState(() => presetRange("30d"));
  const [filters, setFilters] = useState<ReportFilters>(EMPTY_FILTERS);

  const warehouseOptions = useMemo(
    () => data.warehouses.map((w) => ({ value: w.id, label: w.name })),
    [data.warehouses],
  );
  const vendorOptions = useMemo(
    () => data.vendors.map((v) => ({ value: v.id, label: v.companyName })),
    [data.vendors],
  );
  const productOptions = useMemo(
    () => data.products.map((p) => ({ value: p.productCode, label: p.name })),
    [data.products],
  );

  const summary = useMemo(
    () => (loading ? null : computeExecutiveSummary(data, range, filters)),
    [data, range, filters, loading],
  );

  const cards: DomainCard[] = summary
    ? [
        {
          id: "procurement",
          title: "Procurement",
          icon: ClipboardList,
          path: "/scm/reports/procurement",
          metrics: [
            {
              label: "Purchase Orders",
              value: formatNumber(summary.procurement.poCount),
            },
            {
              label: "PO Value",
              value: formatCurrency(summary.procurement.poValue),
            },
            {
              label: "Open Requisitions",
              value: formatNumber(summary.procurement.openRequisitionCount),
            },
            {
              label: "POs Awaiting Receipt",
              value: formatNumber(summary.procurement.posAwaitingReceiptCount),
            },
          ],
        },
        {
          id: "inventory",
          title: "Inventory",
          icon: Boxes,
          path: "/scm/reports/inventory",
          metrics: [
            {
              label: "Total Stock Units",
              value: formatNumber(summary.inventory.totalUnits),
            },
            {
              label: "Inventory Value",
              value:
                summary.inventory.inventoryValue == null
                  ? "N/A"
                  : formatCurrency(summary.inventory.inventoryValue),
            },
            {
              label: "Low Stock Items",
              value: formatNumber(summary.inventory.lowStockCount),
            },
            {
              label: "Out of Stock Items",
              value: formatNumber(summary.inventory.outOfStockCount),
            },
            {
              label: "Reserved Stock",
              value: formatNumber(summary.inventory.reserved),
            },
            {
              label: "Incoming Stock",
              value: formatNumber(summary.inventory.incoming),
            },
          ],
        },
        {
          id: "warehouse",
          title: "Warehouse",
          icon: WarehouseIcon,
          path: "/scm/reports/warehouse",
          metrics: [
            {
              label: "Warehouses",
              value: formatNumber(summary.warehouse.warehouseCount),
            },
            {
              label: "Locations",
              value: formatNumber(summary.warehouse.locationCount),
            },
            {
              label: "Put-aways",
              value: formatNumber(summary.warehouse.putawayCount),
            },
            {
              label: "Internal Movements",
              value: formatNumber(summary.warehouse.movementCount),
            },
          ],
        },
        {
          id: "fulfillment",
          title: "Fulfillment",
          icon: Target,
          path: "/scm/reports/fulfillment",
          metrics: [
            {
              label: "Sales Orders",
              value: formatNumber(summary.fulfillment.salesOrderCount),
            },
            {
              label: "Fulfillment Orders",
              value: formatNumber(summary.fulfillment.fulfillmentCount),
            },
            {
              label: "Backorders",
              value: formatNumber(summary.fulfillment.backorderCount),
            },
            {
              label: "Completion Rate",
              value: formatPercent(summary.fulfillment.completionRatePercent),
            },
          ],
        },
        {
          id: "logistics",
          title: "Logistics",
          icon: Truck,
          path: "/scm/reports/logistics",
          metrics: [
            {
              label: "Shipments",
              value: formatNumber(summary.logistics.shipmentCount),
            },
            {
              label: "Pending",
              value: formatNumber(summary.logistics.pendingCount),
            },
            {
              label: "In Transit",
              value: formatNumber(summary.logistics.inTransitCount),
            },
            {
              label: "Delivered",
              value: formatNumber(summary.logistics.deliveredCount),
            },
            {
              label: "Delivery Problems",
              value: formatNumber(summary.logistics.problemCount),
            },
            {
              label: "Exceptions",
              value: formatNumber(summary.logistics.exceptionCount),
            },
          ],
        },
        {
          id: "returns",
          title: "Returns",
          icon: Undo2,
          path: "/scm/reports/returns",
          metrics: [
            {
              label: "Customer Returns",
              value: formatNumber(summary.returns.customerReturnCount),
            },
            {
              label: "Vendor Returns",
              value: formatNumber(summary.returns.vendorReturnCount),
            },
            {
              label: "Pending Returns",
              value: formatNumber(summary.returns.pendingApprovalCount),
            },
            {
              label: "Customer Return Rate",
              value: formatPercent(summary.returns.customerReturnRatePercent),
            },
          ],
        },
        {
          id: "quality",
          title: "Quality",
          icon: ShieldCheck,
          path: "/scm/reports/quality",
          metrics: [
            {
              label: "Inspections",
              value: formatNumber(summary.quality.inspectionCount),
            },
            {
              label: "Passed",
              value: formatNumber(summary.quality.passedCount),
            },
            {
              label: "Failed",
              value: formatNumber(summary.quality.failedCount),
            },
            {
              label: "Critical Defects",
              value: formatNumber(summary.quality.criticalDefectCount),
            },
          ],
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            SCM Reports &amp; Analytics
          </h2>
          <p className="text-muted-foreground mt-1">
            Supply chain performance, inventory, procurement, fulfillment and
            quality insights.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate("/scm/reports/suppliers")}
        >
          Supplier Report <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>

      <ReportFiltersBar
        range={range}
        onRangeChange={setRange}
        filters={filters}
        onFiltersChange={setFilters}
        warehouses={warehouseOptions}
        vendors={vendorOptions}
        products={productOptions}
      />

      {error ? (
        <ReportErrorState message={error} onRetry={reload} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {loading
            ? Array.from({ length: DOMAIN_CARD_COUNT }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-6 text-center text-muted-foreground">
                    Loading...
                  </CardContent>
                </Card>
              ))
            : cards.map((card) => (
                <Card key={card.id} className="flex flex-col">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-semibold">
                        <card.icon className="h-4 w-4 text-primary" />{" "}
                        {card.title}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(card.path)}
                      >
                        View <ArrowRight className="h-3.5 w-3.5 ml-1" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-3 pt-0">
                    {card.metrics.map((m) => (
                      <div key={m.label}>
                        <div className="text-lg font-bold text-foreground">
                          {m.value}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {m.label}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
        </div>
      )}

      {!loading && !error && (
        <p className="text-xs text-muted-foreground">
          Metrics reflect real SCM records for the selected filters as of now;
          inventory, warehouse, location, open-requisition and awaiting-receipt
          figures are point-in-time snapshots rather than filtered by the date
          range. Open a domain report for full detail, charts and CSV export.
        </p>
      )}
    </div>
  );
}
