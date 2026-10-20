import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/modules/scm/shared/components/ScmButton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { Eye, Ship, ScrollText, ScanLine } from "lucide-react";
import { toast } from "sonner";
import {
  ALL,
  SHIPMENT_STATUS_TONE,
  useLogisticsData,
} from "./logisticsHelpers";
import ScmBarcodeScanner from "../barcode/components/ScmBarcodeScanner";
import { addScanHistoryEntry } from "../barcode/barcodeService";
import type { ShipmentStatus } from "@/types";
import { formatStatusLabel } from "@/modules/scm/shared/format";

const STATUSES: ShipmentStatus[] = [
  "READY_TO_SHIP",
  "CARRIER_ASSIGNED",
  "LABEL_CREATED",
  "DISPATCHED",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "DELIVERY_EXCEPTION",
  "FAILED_DELIVERY",
  "CANCELLED",
];

export default function ScmShipments() {
  const navigate = useNavigate();
  const { loading, error, shipments, carriers, warehouses } =
    useLogisticsData();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [carrierFilter, setCarrierFilter] = useState(ALL);
  const [warehouseFilter, setWarehouseFilter] = useState(ALL);
  const [scanOpen, setScanOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return shipments.filter((s) => {
      if (statusFilter !== ALL && s.status !== statusFilter) return false;
      if (carrierFilter !== ALL && s.carrierId !== carrierFilter) return false;
      if (warehouseFilter !== ALL && s.warehouseId !== warehouseFilter)
        return false;
      if (!q) return true;
      return (
        s.shipmentNumber.toLowerCase().includes(q) ||
        s.salesOrderNumberSnapshot.toLowerCase().includes(q) ||
        s.customerNameSnapshot.toLowerCase().includes(q) ||
        (s.trackingNumber || "").toLowerCase().includes(q)
      );
    });
  }, [shipments, search, statusFilter, carrierFilter, warehouseFilter]);

  const warehouseName = (id: string) =>
    warehouses.find((w) => w.id === id)?.name || id;

  const handleScan = (code: string) => {
    const scanned = code.trim();
    const match = shipments.find(
      (s) =>
        s.shipmentNumber.toLowerCase() === scanned.toLowerCase() ||
        s.trackingNumber?.toLowerCase() === scanned.toLowerCase(),
    );
    if (!match) {
      toast.error(`No shipment found for "${scanned}"`);
      addScanHistoryEntry({
        code: scanned,
        type: "UNKNOWN",
        label: "Not found",
        source: "SHIPMENT",
      });
      return;
    }
    addScanHistoryEntry({
      code: scanned,
      type: "SHIPMENT",
      label: match.shipmentNumber,
      viewPath: `/scm/logistics/shipments/${match.id}`,
      source: "SHIPMENT",
    });
    navigate(`/scm/logistics/shipments/${match.id}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Shipments</h2>
          <p className="text-muted-foreground mt-1">
            Shipments handed to carriers, from creation through delivery.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() => setScanOpen(true)}
        >
          <ScanLine className="h-4 w-4 mr-2" /> Scan Shipment / Package
        </Button>
      </div>
      {error && (
        <div className="text-sm text-red-600 border border-red-200 bg-red-50 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <Card>
        <CardHeader className="pb-4 flex flex-col sm:flex-row gap-3 sm:items-center flex-wrap">
          <Input
            placeholder="Search shipment #, SO #, customer, tracking #..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sm:w-72"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
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
          <Select value={carrierFilter} onValueChange={setCarrierFilter}>
            <SelectTrigger className="w-[170px]">
              <SelectValue placeholder="Carrier" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All Carriers</SelectItem>
              {carriers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.carrierName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
            <SelectTrigger className="w-[170px]">
              <SelectValue placeholder="Warehouse" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All Warehouses</SelectItem>
              {warehouses.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="text-sm text-muted-foreground ml-auto">
            {filtered.length} of {shipments.length} shipments
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Shipment</TableHead>
                  <TableHead>Sales Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Carrier</TableHead>
                  <TableHead>Tracking</TableHead>
                  <TableHead>Packages</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>Shipment Date</TableHead>
                  <TableHead>Expected Delivery</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={11}
                      className="text-center py-16 text-muted-foreground"
                    >
                      Loading shipments...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={11}
                      className="text-center py-16 text-muted-foreground"
                    >
                      <div className="flex flex-col items-center gap-3">
                        <Ship className="h-10 w-10 text-muted-foreground/40" />
                        <div className="text-lg font-medium text-foreground">
                          No shipments found
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((s) => (
                    <TableRow
                      key={s.id}
                      className="hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() =>
                        navigate(`/scm/logistics/shipments/${s.id}`)
                      }
                    >
                      <TableCell className="font-mono text-xs">
                        {s.shipmentNumber}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {s.salesOrderNumberSnapshot}
                      </TableCell>
                      <TableCell>{s.customerNameSnapshot}</TableCell>
                      <TableCell>{s.carrierNameSnapshot || "—"}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {s.trackingNumber || "—"}
                      </TableCell>
                      <TableCell>{s.totalPackages}</TableCell>
                      <TableCell>{warehouseName(s.warehouseId)}</TableCell>
                      <TableCell>{s.shipmentDate || "—"}</TableCell>
                      <TableCell>{s.expectedDeliveryDate || "—"}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={SHIPMENT_STATUS_TONE[s.status]}
                        >
                          {formatStatusLabel(s.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="View"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/scm/logistics/shipments/${s.id}`);
                          }}
                        >
                          <Eye className="h-4 w-4 text-primary" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      {shipments.length === 0 && !loading && (
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <ScrollText className="h-3.5 w-3.5" /> Shipments are created from
          ready-to-ship fulfillments on the Deliveries page.
        </div>
      )}
      <ScmBarcodeScanner
        open={scanOpen}
        onOpenChange={setScanOpen}
        onResult={(code) => {
          setScanOpen(false);
          handleScan(code);
        }}
        title="Scan Shipment / Package"
        placeholder="Shipment number or tracking number"
      />
    </div>
  );
}
