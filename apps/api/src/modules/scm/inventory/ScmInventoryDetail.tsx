import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/modules/scm/shared/components/ScmButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Save,
  Boxes,
  Barcode as BarcodeIcon,
  ScanLine,
} from "lucide-react";
import { toast } from "sonner";
import { getAllRecords, updateRecord } from "@/services/firebase";
import { INVENTORY_PATHS, settingsKey } from "./inventoryPaths";
import { getLedgerEntries } from "./stockLedgerService";
import { useInventoryData, computeStockStatus } from "./useInventoryData";
import { useErrorToast } from "@/modules/scm/shared/useErrorToast";
import { useAuth } from "@/context/AuthContext";
import { productBarcodeValue } from "../barcode/barcodeHelpers";
import { addScanHistoryEntry } from "../barcode/barcodeService";
import ScmBarcodeLabel from "../barcode/components/ScmBarcodeLabel";
import ScmBarcodeScanner from "../barcode/components/ScmBarcodeScanner";
import type {
  InventorySettings,
  StockBatch,
  SerialNumberRecord,
  StockLedgerEntry,
} from "@/types";
import { actorName } from "@/modules/scm/shared/actor";
import { errorMessage, formatStatusLabel } from "@/modules/scm/shared/format";

export default function ScmInventoryDetail() {
  const { productCode: encodedCode } = useParams<{ productCode: string }>();
  const productCode = decodeURIComponent(encodedCode || "");
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    loading,
    error: inventoryError,
    products,
    warehouses,
    rows,
    settings,
    reload,
  } = useInventoryData();
  useErrorToast(inventoryError);
  const [ledger, setLedger] = useState<StockLedgerEntry[]>([]);
  const [batches, setBatches] = useState<StockBatch[]>([]);
  const [serials, setSerials] = useState<SerialNumberRecord[]>([]);
  const [reorderLevel, setReorderLevel] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [batchTracked, setBatchTracked] = useState(false);
  const [serialTracked, setSerialTracked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [barcodeValue, setBarcodeValue] = useState("");
  const [savingBarcode, setSavingBarcode] = useState(false);
  const [labelOpen, setLabelOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);

  const product = products.find((p) => p.productCode === productCode);
  const productRows = rows.filter((r) => r.productCode === productCode);
  const setting: InventorySettings | undefined = settings.find(
    (s) => s.productCode === productCode,
  );

  useEffect(() => {
    setReorderLevel(
      setting?.reorderLevel != null ? String(setting.reorderLevel) : "",
    );
    setCostPrice(setting?.costPrice != null ? String(setting.costPrice) : "");
    setBatchTracked(!!setting?.batchTracked);
    setSerialTracked(!!setting?.serialTracked);
    setBarcodeValue(setting?.barcode || "");
  }, [setting]);

  useEffect(() => {
    (async () => {
      try {
        const [l, b, s] = await Promise.all([
          getLedgerEntries(),
          getAllRecords(INVENTORY_PATHS.batches) as Promise<StockBatch[]>,
          getAllRecords(INVENTORY_PATHS.serials) as Promise<
            SerialNumberRecord[]
          >,
        ]);
        setLedger(l.filter((e) => e.productCode === productCode).slice(0, 25));
        setBatches(b.filter((x) => x.productCode === productCode));
        setSerials(s.filter((x) => x.productCode === productCode));
      } catch (err: unknown) {
        toast.error(errorMessage(err, "Failed to load stock history"));
      }
    })();
  }, [productCode]);

  const totals = useMemo(() => {
    return productRows.reduce(
      (acc, r) => ({
        onHand: acc.onHand + r.onHand,
        reserved: acc.reserved + r.reserved,
        available: acc.available + r.available,
        damaged: acc.damaged + r.damaged,
      }),
      { onHand: 0, reserved: 0, available: 0, damaged: 0 },
    );
  }, [productRows]);

  const saveSettings = async () => {
    const reorder = reorderLevel.trim() === "" ? null : Number(reorderLevel);
    const cost = costPrice.trim() === "" ? null : Number(costPrice);
    if (
      (reorder != null && !(reorder >= 0)) ||
      (cost != null && !(cost >= 0))
    ) {
      toast.error("Reorder level and cost price must be zero or more");
      return;
    }
    setSaving(true);
    try {
      // null (not undefined) so a blanked field is actually cleared in Firebase.
      const payload = {
        productCode,
        reorderLevel: reorder,
        costPrice: cost,
        batchTracked,
        serialTracked,
        updatedBy: actorName(user),
      };
      await updateRecord(
        INVENTORY_PATHS.settings,
        settingsKey(productCode),
        payload,
      );
      toast.success("Inventory settings saved");
      reload();
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to save inventory settings"));
    } finally {
      setSaving(false);
    }
  };

  const activeBarcode = productBarcodeValue(productCode, setting?.barcode);

  const saveBarcode = async () => {
    const value = barcodeValue.trim();
    if (value) {
      const clash = products.find((p) => {
        if (p.productCode === productCode) return false;
        const otherSetting = settings.find(
          (s) => s.productCode === p.productCode,
        );
        return (
          productBarcodeValue(
            p.productCode,
            otherSetting?.barcode,
          ).toLowerCase() === value.toLowerCase()
        );
      });
      if (clash) {
        toast.error(
          `Barcode already assigned to ${clash.name} (${clash.productCode})`,
        );
        return;
      }
    }
    setSavingBarcode(true);
    try {
      await updateRecord(INVENTORY_PATHS.settings, settingsKey(productCode), {
        productCode,
        barcode: value || undefined,
        updatedBy: user?.name || user?.username || "Unknown",
      });
      toast.success("Barcode saved");
      reload();
    } catch {
      toast.error("Failed to save barcode");
    } finally {
      setSavingBarcode(false);
    }
  };

  const handleScan = (code: string) => {
    const scanned = code.trim();
    if (
      scanned.toLowerCase() === activeBarcode.toLowerCase() ||
      scanned.toLowerCase() === productCode.toLowerCase()
    ) {
      toast.success(`Confirmed: ${product?.name || productCode}`);
      addScanHistoryEntry({
        code: scanned,
        type: "PRODUCT",
        label: product?.name || productCode,
        source: "PRODUCT",
      });
    } else {
      toast.error(
        `Barcode mismatch — expected ${activeBarcode}, scanned "${scanned}"`,
      );
      addScanHistoryEntry({
        code: scanned,
        type: "UNKNOWN",
        label: "Barcode mismatch",
        source: "PRODUCT",
      });
    }
  };

  if (!loading && !product) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <Boxes className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-muted-foreground">
          Product not found in the catalog.
        </p>
        <Button
          variant="outline"
          onClick={() => navigate("/scm/inventory/overview")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Stock Overview
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate("/scm/inventory/overview")}
        className="-ml-2"
      >
        <ArrowLeft className="h-4 w-4 mr-2" /> Back to Stock Overview
      </Button>

      <div>
        <h2 className="text-2xl font-bold text-foreground">
          {product?.name || productCode}
        </h2>
        <p className="text-muted-foreground mt-1 font-mono text-sm">
          {productCode}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "On Hand", value: totals.onHand },
          { label: "Reserved", value: totals.reserved },
          { label: "Available", value: totals.available },
          { label: "Damaged", value: totals.damaged },
        ].map((k) => (
          <Card key={k.label}>
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground">
                {k.label}
              </p>
              <p className="text-2xl font-bold mt-1">{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Barcode</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="space-y-1.5 flex-1 max-w-xs">
            <Label>Barcode Value</Label>
            <Input
              value={barcodeValue}
              onChange={(e) => setBarcodeValue(e.target.value)}
              placeholder={productCode}
            />
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={saveBarcode}
              disabled={savingBarcode}
            >
              {savingBarcode
                ? "Saving..."
                : setting?.barcode
                  ? "Update"
                  : "Generate Barcode"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setLabelOpen(true)}
            >
              <BarcodeIcon className="h-3.5 w-3.5 mr-1.5" /> View / Print
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setScanOpen(true)}
            >
              <ScanLine className="h-3.5 w-3.5 mr-1.5" /> Scan
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">By Warehouse</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>On Hand</TableHead>
                  <TableHead>Reserved</TableHead>
                  <TableHead>Available</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productRows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center py-10 text-muted-foreground"
                    >
                      No warehouse balances yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  productRows.map((r) => (
                    <TableRow key={r.warehouseId}>
                      <TableCell>{r.warehouseName}</TableCell>
                      <TableCell>{r.onHand}</TableCell>
                      <TableCell>{r.reserved}</TableCell>
                      <TableCell className="font-medium">
                        {r.available}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{computeStockStatus(r)}</Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {(batches.length > 0 || serials.length > 0) && (
        <div className="grid md:grid-cols-2 gap-4">
          {batches.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Batches</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {batches.map((b) => (
                  <div
                    key={b.id}
                    className="flex justify-between text-sm border-b last:border-0 pb-2"
                  >
                    <span className="font-mono">{b.batchNumber}</span>
                    <span>
                      {b.quantity} ·{" "}
                      <Badge variant="outline" className="ml-1">
                        {b.status}
                      </Badge>
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          {serials.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Serial Numbers</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-64 overflow-y-auto">
                {serials.map((s) => (
                  <div
                    key={s.id}
                    className="flex justify-between text-sm border-b last:border-0 pb-2"
                  >
                    <span className="font-mono">{s.serialNumber}</span>
                    <Badge variant="outline">{s.status}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Inventory Settings</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 max-w-md">
          <div className="space-y-1.5">
            <Label>Reorder Level</Label>
            <Input
              type="number"
              min="0"
              value={reorderLevel}
              onChange={(e) => setReorderLevel(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Cost Price</Label>
            <Input
              type="number"
              min="0"
              value={costPrice}
              onChange={(e) => setCostPrice(e.target.value)}
            />
          </div>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>Batch tracked</span>
            <Switch checked={batchTracked} onCheckedChange={setBatchTracked} />
          </label>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>Serial tracked</span>
            <Switch
              checked={serialTracked}
              onCheckedChange={setSerialTracked}
            />
          </label>
          <p className="col-span-2 text-xs text-muted-foreground">
            Tracked products require a batch number / serial numbers when goods
            are received.
          </p>
          <div className="col-span-2">
            <Button size="sm" onClick={saveSettings} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />{" "}
              {saving ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Ledger Movements</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>IN</TableHead>
                  <TableHead>OUT</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledger.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center py-10 text-muted-foreground"
                    >
                      No ledger movements yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  ledger.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="text-sm">
                        {new Date(e.transactionDate).toLocaleDateString(
                          "en-IN",
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {formatStatusLabel(e.transactionType)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {warehouses.find((w) => w.id === e.warehouseId)?.name ||
                          e.warehouseId}
                      </TableCell>
                      <TableCell className="text-emerald-600">
                        {e.quantityIn > 0 ? `+${e.quantityIn}` : ""}
                      </TableCell>
                      <TableCell className="text-red-600">
                        {e.quantityOut > 0 ? `-${e.quantityOut}` : ""}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={labelOpen} onOpenChange={setLabelOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Product Label</DialogTitle>
          </DialogHeader>
          <ScmBarcodeLabel
            format="CODE128"
            value={activeBarcode}
            title={product?.name || productCode}
            subtitle={`SKU ${productCode}`}
          />
        </DialogContent>
      </Dialog>

      <ScmBarcodeScanner
        open={scanOpen}
        onOpenChange={setScanOpen}
        onResult={(code) => {
          setScanOpen(false);
          handleScan(code);
        }}
        title="Scan to Validate"
        placeholder="Product SKU or barcode"
      />
    </div>
  );
}
