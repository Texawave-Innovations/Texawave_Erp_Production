import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Search, LayoutGrid, Boxes, MapPin, Layers } from "lucide-react";
import { toast } from "sonner";
import { getAllRecords } from "@/services/firebase";
import { INVENTORY_PATHS } from "../inventory/inventoryPaths";
import { useInventoryData } from "../inventory/useInventoryData";
import {
  ALL,
  locationLabel,
  useWarehouseMasters,
  useWarehouseOperations,
  computeLocationStock,
} from "./warehouseHelpers";
import type { StockBatch, SerialNumberRecord } from "@/types";
import {
  DashboardKpiGrid,
  type DashboardKpi,
} from "@/modules/scm/shared/components/DashboardKpiGrid";
import { stockValue } from "@/modules/scm/shared/businessRules";
import {
  errorMessage,
  formatCurrency,
  formatStatusLabel,
} from "@/modules/scm/shared/format";

interface LocationRow {
  warehouseId: string;
  warehouseName: string;
  locationId: string | null;
  locationLabel: string;
  productCode: string;
  productName: string;
  quantity: number;
}

export default function ScmWarehouseStock() {
  const {
    loading: mastersLoading,
    error: mastersError,
    warehouses,
    locations,
  } = useWarehouseMasters();
  const {
    loading: opsLoading,
    error: opsError,
    putaways,
    movements,
    pickings,
  } = useWarehouseOperations();
  const { loading: invLoading, rows } = useInventoryData();
  const [batches, setBatches] = useState<StockBatch[]>([]);
  const [serials, setSerials] = useState<SerialNumberRecord[]>([]);
  const [warehouseFilter, setWarehouseFilter] = useState(ALL);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [b, s] = await Promise.all([
          getAllRecords(INVENTORY_PATHS.batches) as Promise<StockBatch[]>,
          getAllRecords(INVENTORY_PATHS.serials) as Promise<
            SerialNumberRecord[]
          >,
        ]);
        setBatches(b);
        setSerials(s);
      } catch (err: unknown) {
        toast.error(
          errorMessage(err, "Failed to load batches and serial numbers"),
        );
      }
    })();
  }, []);

  const loading = mastersLoading || opsLoading || invLoading;
  const locationStock = useMemo(
    () => computeLocationStock(putaways, movements, pickings),
    [putaways, movements, pickings],
  );
  const warehouseName = (id: string) =>
    warehouses.find((w) => w.id === id)?.name || id;

  const locationRows: LocationRow[] = useMemo(() => {
    const warehouseName = (id: string) =>
      warehouses.find((w) => w.id === id)?.name || id;
    const out: LocationRow[] = [];
    const onHandByProductWarehouse = new Map<string, number>();
    for (const r of rows)
      onHandByProductWarehouse.set(
        `${r.productCode}__${r.warehouseId}`,
        r.onHand,
      );

    const assignedByProductWarehouse = new Map<string, number>();
    for (const [key, qty] of locationStock.entries()) {
      if (qty <= 0) continue;
      const [productCode, warehouseId, locationId] = key.split("__");
      const loc = locations.find((l) => l.id === locationId);
      const product = rows.find(
        (r) => r.productCode === productCode && r.warehouseId === warehouseId,
      );
      out.push({
        warehouseId,
        warehouseName: warehouseName(warehouseId),
        locationId,
        locationLabel: locationLabel(loc),
        productCode,
        productName: product?.productName || productCode,
        quantity: qty,
      });
      assignedByProductWarehouse.set(
        `${productCode}__${warehouseId}`,
        (assignedByProductWarehouse.get(`${productCode}__${warehouseId}`) ||
          0) + qty,
      );
    }
    // Residual on-hand that was never routed through a completed putaway (e.g. opening balances,
    // or GRNs awaiting putaway) — surfaced as "Unassigned" so total stock always reconciles with
    // the authoritative stock ledger balance instead of silently under-reporting.
    for (const [key, onHand] of onHandByProductWarehouse.entries()) {
      const assigned = assignedByProductWarehouse.get(key) || 0;
      const residual = onHand - assigned;
      if (residual > 0) {
        const [productCode, warehouseId] = key.split("__");
        const product = rows.find(
          (r) => r.productCode === productCode && r.warehouseId === warehouseId,
        );
        out.push({
          warehouseId,
          warehouseName: warehouseName(warehouseId),
          locationId: null,
          locationLabel: "Unassigned",
          productCode,
          productName: product?.productName || productCode,
          quantity: residual,
        });
      }
    }
    return out;
  }, [rows, locationStock, locations, warehouses]);

  const filteredLocationRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return locationRows.filter(
      (r) =>
        (warehouseFilter === ALL || r.warehouseId === warehouseFilter) &&
        (!q ||
          r.productName.toLowerCase().includes(q) ||
          r.productCode.toLowerCase().includes(q) ||
          r.locationLabel.toLowerCase().includes(q)),
    );
  }, [locationRows, warehouseFilter, search]);

  const filteredBatches = useMemo(
    () =>
      batches.filter(
        (b) => warehouseFilter === ALL || b.warehouseId === warehouseFilter,
      ),
    [batches, warehouseFilter],
  );
  const filteredSerials = useMemo(
    () =>
      serials.filter(
        (s) => warehouseFilter === ALL || s.warehouseId === warehouseFilter,
      ),
    [serials, warehouseFilter],
  );

  const totalStockQty = rows.reduce((s, r) => s + r.onHand, 0);
  const totalStockValue = rows.reduce(
    (s, r) => s + stockValue(r.onHand, r.costPrice),
    0,
  );
  const occupiedLocations = new Set(
    locationRows.filter((r) => r.locationId).map((r) => r.locationId),
  ).size;
  const kpis: DashboardKpi[] = [
    {
      id: "qty",
      label: "Total Stock Quantity",
      value: totalStockQty.toLocaleString("en-IN"),
      icon: Boxes,
    },
    {
      id: "value",
      label: "Stock Value",
      value: formatCurrency(totalStockValue, "INR", 0),
      icon: LayoutGrid,
    },
    {
      id: "occupied",
      label: "Occupied Locations",
      value: occupiedLocations,
      icon: MapPin,
    },
    {
      id: "tracked",
      label: "Tracked Batches / Serials",
      value: `${batches.length} / ${serials.length}`,
      icon: Layers,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Warehouse Stock</h2>
        <p className="text-muted-foreground mt-1">
          On-hand stock by warehouse, location, batch and serial.
          On-hand/reserved/available totals come from the stock ledger; the
          location split is derived from completed put-away, movement and
          picking records.
        </p>
      </div>

      {(mastersError || opsError) && (
        <div className="text-sm text-red-600 border border-red-200 bg-red-50 rounded-md px-3 py-2">
          {mastersError || opsError}
        </div>
      )}
      <DashboardKpiGrid kpis={kpis} loading={loading} />

      <Card>
        <CardHeader className="pb-4 flex flex-row flex-wrap gap-3 items-center">
          <div className="relative w-full md:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search product or location..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
            <SelectTrigger className="w-[200px]">
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
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="location">
            <TabsList>
              <TabsTrigger value="location">By Location</TabsTrigger>
              <TabsTrigger value="batches">Batches</TabsTrigger>
              <TabsTrigger value="serials">Serial Numbers</TabsTrigger>
            </TabsList>

            <TabsContent value="location">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Warehouse</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Quantity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="text-center py-16 text-muted-foreground"
                        >
                          Loading stock...
                        </TableCell>
                      </TableRow>
                    ) : filteredLocationRows.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="text-center py-16 text-muted-foreground"
                        >
                          No stock found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredLocationRows.map((r, idx) => (
                        <TableRow
                          key={idx}
                          className="hover:bg-muted/50 transition-colors"
                        >
                          <TableCell>{r.warehouseName}</TableCell>
                          <TableCell>
                            {r.locationId ? (
                              <Badge
                                variant="secondary"
                                className="font-mono text-xs"
                              >
                                {r.locationLabel}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">
                                {r.locationLabel}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{r.productName}</div>
                            <div className="text-xs text-muted-foreground font-mono">
                              {r.productCode}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">
                            {r.quantity}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="batches">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Batch #</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Warehouse</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Expiry</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBatches.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="text-center py-16 text-muted-foreground"
                        >
                          No batches found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredBatches.map((b) => (
                        <TableRow key={b.id}>
                          <TableCell className="font-mono text-xs">
                            {b.batchNumber}
                          </TableCell>
                          <TableCell>{b.productName}</TableCell>
                          <TableCell>{warehouseName(b.warehouseId)}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {b.locationId
                              ? locationLabel(
                                  locations.find((l) => l.id === b.locationId),
                                )
                              : "Unassigned"}
                          </TableCell>
                          <TableCell>{b.expiryDate || "—"}</TableCell>
                          <TableCell>{b.quantity}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {formatStatusLabel(b.status)}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="serials">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Serial #</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Warehouse</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Reference</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSerials.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center py-16 text-muted-foreground"
                        >
                          No serial numbers found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredSerials.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="font-mono text-xs">
                            {s.serialNumber}
                          </TableCell>
                          <TableCell>{s.productName}</TableCell>
                          <TableCell>{warehouseName(s.warehouseId)}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {s.locationId
                              ? locationLabel(
                                  locations.find((l) => l.id === s.locationId),
                                )
                              : "Unassigned"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {formatStatusLabel(s.status)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {s.currentReference || "—"}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
