// Phase 12 / 12b — SCM Barcode & QR Scanning. The one workspace for identifying and tracking
// products, inventory, locations and SCM documents by barcode/QR — and the global scanner: scan
// anything, get told what it is, and jump to the real record. Purely an identification layer:
// nothing here posts to the stock ledger, reserves stock, or mutates any SCM record — see
// `barcodeResolver.ts` for the read-only lookup and the per-workflow "Scan" buttons embedded in
// GRN/Picking/Packing/Warehouse/Logistics/Returns/Quality pages for where scanning actually
// assists a transaction (it never replaces the existing business action there either).
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/modules/scm/shared/components/ScmButton";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/modules/scm/shared/components/ScmTable";
import {
  ScanLine,
  Search,
  Package,
  Boxes,
  MapPin,
  PackageCheck,
  ClipboardCheck,
  Ship,
  Undo2,
  Barcode as BarcodeIcon,
  QrCode,
  Printer,
  Tag,
  Database,
  Factory,
  ClipboardList,
  PackageOpen,
  ShieldCheck,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { updateRecord } from "@/services/firebase";
import { useAuth } from "@/context/AuthContext";
import { INVENTORY_PATHS, settingsKey } from "../inventory/inventoryPaths";
import { useBarcodeMasterData } from "./barcodeService";
import { resolveScan } from "./barcodeResolver";
import { productBarcodeValue, buildQrPayload } from "./barcodeHelpers";
import {
  getScanHistory,
  addScanHistoryEntry,
  clearScanHistory,
} from "./barcodeService";
import ScmBarcodeScanner from "./components/ScmBarcodeScanner";
import ScmBarcodeResult from "./components/ScmBarcodeResult";
import ScmBarcodeHistory from "./components/ScmBarcodeHistory";
import ScmBarcodeGenerator from "./components/ScmBarcodeGenerator";
import ScmBarcodeLabel from "./components/ScmBarcodeLabel";
import ScmBarcode from "./components/ScmBarcode";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type {
  BarcodeFormat,
  ScannerContext,
  ScmScanResult,
} from "./barcodeTypes";

const QUICK_ACTIONS: {
  id: ScannerContext;
  label: string;
  icon: typeof Package;
  hint: string;
}[] = [
  {
    id: "PRODUCT",
    label: "Scan Product",
    icon: Package,
    hint: "Product SKU or barcode",
  },
  {
    id: "SUPPLIER",
    label: "Scan Supplier",
    icon: Factory,
    hint: "Vendor code",
  },
  {
    id: "INVENTORY",
    label: "Scan Inventory",
    icon: Boxes,
    hint: "SKU, batch or serial number",
  },
  {
    id: "LOCATION",
    label: "Scan Location",
    icon: MapPin,
    hint: "Warehouse location / bin code",
  },
  {
    id: "PROCUREMENT",
    label: "Scan Procurement",
    icon: ClipboardList,
    hint: "Requisition, RFQ or PO number",
  },
  {
    id: "GRN",
    label: "Scan GRN",
    icon: PackageCheck,
    hint: "GRN or PO number",
  },
  {
    id: "PICKING",
    label: "Scan Picking",
    icon: ClipboardCheck,
    hint: "Pick or sales order number",
  },
  {
    id: "PACKING",
    label: "Scan Packing",
    icon: PackageOpen,
    hint: "Package or pack number",
  },
  {
    id: "SHIPMENT",
    label: "Scan Shipment",
    icon: Ship,
    hint: "Shipment or tracking number",
  },
  { id: "RETURN", label: "Scan Return", icon: Undo2, hint: "Return number" },
  {
    id: "QUALITY",
    label: "Scan Quality",
    icon: ShieldCheck,
    hint: "Inspection number",
  },
];

export default function ScmBarcodeDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const data = useBarcodeMasterData();
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanContext, setScanContext] = useState<ScannerContext>("GLOBAL");
  const [manualCode, setManualCode] = useState("");
  const [result, setResult] = useState<ScmScanResult | null>(null);
  const [history, setHistory] = useState(() => getScanHistory());
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [generatorFormat, setGeneratorFormat] =
    useState<BarcodeFormat>("CODE128");
  const [labelPreview, setLabelPreview] = useState<{
    value: string;
    title: string;
    subtitle?: string;
    footer?: string;
    format: BarcodeFormat;
  } | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [editBarcodeFor, setEditBarcodeFor] = useState<{
    productCode: string;
    name: string;
  } | null>(null);
  const [editBarcodeValue, setEditBarcodeValue] = useState("");
  const [duplicateOf, setDuplicateOf] = useState<{
    name: string;
    productCode: string;
  } | null>(null);
  const [savingBarcode, setSavingBarcode] = useState(false);

  const saveAssignedBarcode = async () => {
    if (!editBarcodeFor) return;
    const value = editBarcodeValue.trim();
    setDuplicateOf(null);

    // Section 26 — duplicate barcode validation: never silently overwrite another product's code.
    if (value) {
      const clash = data.products.find((p) => {
        if (p.productCode === editBarcodeFor.productCode) return false;
        const otherSetting = data.settings.find(
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
        setDuplicateOf({ name: clash.name, productCode: clash.productCode });
        return;
      }
    }

    setSavingBarcode(true);
    try {
      await updateRecord(
        INVENTORY_PATHS.settings,
        settingsKey(editBarcodeFor.productCode),
        {
          productCode: editBarcodeFor.productCode,
          barcode: value || undefined,
          updatedBy: user?.name || user?.username || "Unknown",
        },
      );
      toast.success("Barcode assigned");
      setEditBarcodeFor(null);
      data.reload();
    } catch {
      toast.error("Failed to assign barcode");
    } finally {
      setSavingBarcode(false);
    }
  };

  const handleResolved = (code: string, source: ScannerContext = "GLOBAL") => {
    const resolved = resolveScan(code, data);
    setResult(resolved);
    const primary = resolved.alternatives?.[0] || resolved;
    setHistory(
      addScanHistoryEntry({
        code: resolved.code || code,
        type: primary.type,
        label: resolved.alternatives
          ? `${resolved.alternatives.length} matches`
          : resolved.title,
        viewPath: resolved.alternatives ? undefined : resolved.viewPath,
        source,
      }),
    );
    // The scan can be triggered from a button further down the page (e.g. the Products table) —
    // always bring the result card into view instead of leaving the person to scroll for it.
    window.setTimeout(
      () =>
        document
          .getElementById("scm-scan-result")
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      50,
    );
  };

  const openScanner = (context: ScannerContext) => {
    setScanContext(context);
    setScannerOpen(true);
  };

  const submitManual = () => {
    if (!manualCode.trim()) return;
    handleResolved(manualCode.trim(), scanContext);
    setManualCode("");
  };

  const scopeHint = QUICK_ACTIONS.find((q) => q.id === scanContext)?.hint;

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    const list = q
      ? data.products.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.productCode.toLowerCase().includes(q),
        )
      : data.products;
    return list.slice(0, 100);
  }, [data.products, productSearch]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ScanLine className="h-6 w-6 text-brand-600" /> Barcode & Scanning
          </h2>
          <p className="text-muted-foreground mt-1">
            Scan, identify and track products, inventory, locations and SCM
            documents.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("/scm/master-data")}
        >
          <Database className="h-4 w-4 mr-2" /> Master Data
        </Button>
      </div>

      {/* Scanner */}
      <Card>
        <CardHeader className="pb-4">
          <div className="font-semibold">Scanner</div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <Button className="sm:w-auto" onClick={() => openScanner("GLOBAL")}>
              <ScanLine className="h-4 w-4 mr-2" /> Scan Barcode / QR Code
            </Button>
            <div className="flex-1 flex gap-2">
              <Input
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitManual();
                }}
                placeholder="Enter barcode manually"
              />
              <Button
                variant="outline"
                onClick={submitManual}
                disabled={!manualCode.trim()}
              >
                <Search className="h-4 w-4 mr-2" /> Search
              </Button>
            </div>
          </div>

          <div>
            <div className="text-xs font-medium text-muted-foreground mb-2">
              Quick Actions
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {QUICK_ACTIONS.map((qa) => (
                <button
                  key={qa.id}
                  onClick={() => openScanner(qa.id)}
                  className="flex flex-col items-center gap-1.5 rounded-md border border-border p-3 text-center hover:bg-brand-50 hover:border-brand-200 transition-colors"
                >
                  <qa.icon className="h-5 w-5 text-brand-600" />
                  <span className="text-xs font-medium text-foreground">
                    {qa.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setGeneratorFormat("CODE128");
                setGeneratorOpen(true);
              }}
            >
              <BarcodeIcon className="h-4 w-4 mr-2" /> Generate Barcode
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setGeneratorFormat("QR");
                setGeneratorOpen(true);
              }}
            >
              <QrCode className="h-4 w-4 mr-2" /> Generate QR Code
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setGeneratorFormat("CODE128");
                setGeneratorOpen(true);
              }}
            >
              <Printer className="h-4 w-4 mr-2" /> Print Label
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <div id="scm-scan-result">
          <ScmBarcodeResult result={result} onPick={(r) => setResult(r)} />
        </div>
      )}

      {/* Barcode Utilities */}
      <Card>
        <CardHeader className="pb-4">
          <div className="font-semibold">Barcode Utilities</div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="products">
            <TabsList>
              <TabsTrigger value="products">Products</TabsTrigger>
              <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
              <TabsTrigger value="locations">Locations</TabsTrigger>
            </TabsList>

            <TabsContent value="products" className="space-y-3">
              <Input
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Search products by name or SKU..."
                className="max-w-sm"
              />
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Barcode</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.loading ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-center py-10 text-muted-foreground"
                        >
                          Loading products...
                        </TableCell>
                      </TableRow>
                    ) : filteredProducts.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-center py-10 text-muted-foreground"
                        >
                          No products found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredProducts.map((p) => {
                        const setting = data.settings.find(
                          (s) => s.productCode === p.productCode,
                        );
                        const hasBarcode = !!setting?.barcode?.trim();
                        const barcode = productBarcodeValue(
                          p.productCode,
                          setting?.barcode,
                        );
                        return (
                          <TableRow
                            key={p.productCode}
                            className="hover:bg-muted/50"
                          >
                            <TableCell className="font-medium">
                              {p.name}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {p.productCode}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {barcode}
                              {!hasBarcode && (
                                <span className="text-muted-foreground italic ml-1">
                                  (auto)
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {p.category || "—"}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {hasBarcode ? (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      setLabelPreview({
                                        value: barcode,
                                        title: p.name,
                                        subtitle: `SKU ${p.productCode}`,
                                        format: "CODE128",
                                      })
                                    }
                                  >
                                    <Tag className="h-3.5 w-3.5 mr-1.5" /> View
                                    / Print
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      handleResolved(barcode, "PRODUCT")
                                    }
                                  >
                                    <ScanLine className="h-3.5 w-3.5 mr-1.5" />{" "}
                                    Scan
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setEditBarcodeFor({
                                      productCode: p.productCode,
                                      name: p.name,
                                    });
                                    setEditBarcodeValue(p.productCode);
                                  }}
                                >
                                  <BarcodeIcon className="h-3.5 w-3.5 mr-1.5" />{" "}
                                  Generate Barcode
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="suppliers" className="space-y-3">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Company</TableHead>
                      <TableHead>Vendor Code</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.loading ? (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="text-center py-10 text-muted-foreground"
                        >
                          Loading suppliers...
                        </TableCell>
                      </TableRow>
                    ) : data.vendors.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="text-center py-10 text-muted-foreground"
                        >
                          No suppliers yet — create one under Suppliers.
                        </TableCell>
                      </TableRow>
                    ) : (
                      data.vendors.slice(0, 100).map((v) => (
                        <TableRow key={v.id} className="hover:bg-muted/50">
                          <TableCell className="font-medium">
                            {v.companyName}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {v.vendorCode}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {v.status || "—"}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setLabelPreview({
                                  value: buildQrPayload(
                                    "SUPPLIER",
                                    v.vendorCode,
                                    v.id,
                                  ),
                                  title: v.companyName,
                                  subtitle: v.vendorCode,
                                  footer: v.status
                                    ? `Status: ${v.status}`
                                    : undefined,
                                  format: "QR",
                                })
                              }
                            >
                              <Tag className="h-3.5 w-3.5 mr-1.5" /> QR Label
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="locations" className="space-y-3">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Location Code</TableHead>
                      <TableHead>Warehouse</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.loading ? (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="text-center py-10 text-muted-foreground"
                        >
                          Loading locations...
                        </TableCell>
                      </TableRow>
                    ) : data.locations.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="text-center py-10 text-muted-foreground"
                        >
                          No locations yet — create one under Warehouse →
                          Locations.
                        </TableCell>
                      </TableRow>
                    ) : (
                      data.locations.slice(0, 100).map((loc) => {
                        const code = loc.locationCode || loc.binCode;
                        const wh = data.warehouses.find(
                          (w) => w.id === loc.warehouseId,
                        );
                        return (
                          <TableRow key={loc.id} className="hover:bg-muted/50">
                            <TableCell className="font-mono text-xs">
                              {code}
                            </TableCell>
                            <TableCell>{wh?.name || loc.warehouseId}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {loc.locationType || "BIN"}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setLabelPreview({
                                    value: buildQrPayload(
                                      "LOCATION",
                                      code,
                                      loc.id,
                                    ),
                                    title: code,
                                    subtitle: wh?.name,
                                    footer: `Warehouse: ${wh?.name || loc.warehouseId}`,
                                    format: "QR",
                                  })
                                }
                              >
                                <Tag className="h-3.5 w-3.5 mr-1.5" /> QR Label
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <ScmBarcodeHistory
        entries={history}
        onClear={() => setHistory(clearScanHistory())}
      />

      <ScmBarcodeScanner
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onResult={(code) => {
          setScannerOpen(false);
          handleResolved(code, scanContext);
        }}
        placeholder={
          scopeHint
            ? `Enter ${scopeHint.toLowerCase()}`
            : "Enter barcode or QR value manually"
        }
      />

      <ScmBarcodeGenerator
        open={generatorOpen}
        onOpenChange={setGeneratorOpen}
        initialFormat={generatorFormat}
        data={data}
      />

      <Dialog
        open={!!editBarcodeFor}
        onOpenChange={(o) => {
          if (!o) {
            setEditBarcodeFor(null);
            setDuplicateOf(null);
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Generate Barcode</DialogTitle>
          </DialogHeader>
          {editBarcodeFor && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                {editBarcodeFor.name}{" "}
                <span className="font-mono text-xs">
                  ({editBarcodeFor.productCode})
                </span>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Barcode Value</Label>
                <Input
                  value={editBarcodeValue}
                  onChange={(e) => {
                    setEditBarcodeValue(e.target.value);
                    setDuplicateOf(null);
                  }}
                />
              </div>
              {editBarcodeValue.trim() && (
                <div className="border rounded-md p-3">
                  <ScmBarcode
                    value={editBarcodeValue.trim()}
                    format="CODE128"
                    height={40}
                  />
                </div>
              )}
              {duplicateOf && (
                <div className="text-xs text-red-600 border border-red-200 bg-red-50 rounded-md p-2">
                  Barcode already assigned to{" "}
                  <span className="font-medium">{duplicateOf.name}</span> (
                  {duplicateOf.productCode}). Choose a different value.
                </div>
              )}
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setEditBarcodeFor(null)}
                  disabled={savingBarcode}
                >
                  Cancel
                </Button>
                <Button onClick={saveAssignedBarcode} disabled={savingBarcode}>
                  {savingBarcode ? "Saving..." : "Save"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!labelPreview}
        onOpenChange={(o) => {
          if (!o) setLabelPreview(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Label Preview</DialogTitle>
          </DialogHeader>
          {labelPreview && (
            <ScmBarcodeLabel
              format={labelPreview.format}
              value={labelPreview.value}
              title={labelPreview.title}
              subtitle={labelPreview.subtitle}
              footer={labelPreview.footer}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
