"use client";

import type { BarcodeProductRow, ScanResult } from "@texawave-erp/api-types";
import {
  Button,
  Card,
  DataTable,
  Input,
  PageHeader,
  Tabs,
  useToast,
} from "@texawave-erp/ui-kit";
import {
  Barcode as BarcodeIcon,
  Boxes,
  Database,
  FileText,
  MapPin,
  Package,
  Pencil,
  Plus,
  Printer,
  QrCode,
  ScanLine,
  Search,
  Tag,
  Trash2,
  Undo2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { usePermission } from "@/hooks/usePermission";
import { BarcodeGeneratorDialog } from "../../barcode/BarcodeGeneratorDialog";
import { buildQrPayload } from "../../barcode/codes";
import { CameraScanDialog } from "../../barcode/CameraScanDialog";
import { LabelDialog } from "../../barcode/LabelDialog";
import type { BarcodeLabelProps } from "../../barcode/BarcodeLabel";
import {
  AddProductDialog,
  AssignBinDialog,
  GenerateBarcodeDialog,
  SetExpiryDialog,
} from "../../barcode/ProductBarcodeDialogs";
import {
  addScanHistoryEntry,
  clearScanHistory,
  getScanHistory,
  removeScanHistoryEntry,
  type ScanSource,
} from "../../barcode/scan-history";
import { ScanResultCard } from "../../barcode/ScanResultCard";
import { useDeleteScmProduct } from "../../products/hooks";
import { SCM_CLIENT_DEMO } from "../../shared/demo-mode";
import { formatDateTime, formatStatusLabel } from "../../shared/format";
import {
  useLocationOptions,
  useProductOptions,
  useSupplierOptions,
  useWarehouseOptions,
} from "../../shared/masters";
import { ScmDeleteButton, ScmDeleteDialog } from "../../shared/ScmDeleteDialog";
import { errorText } from "../../shared/use-list-controls";
import { productLabelLines, expiryTone } from "../../shared/expiry";
import { useBarcodeProducts, useScanCode } from "../hooks";

const QUICK_ACTIONS: {
  id: ScanSource;
  label: string;
  hint: string;
  icon: typeof Package;
}[] = [
  {
    id: "PRODUCT",
    label: "Scan Product",
    hint: "Product barcode or SKU",
    icon: Package,
  },
  {
    id: "LOCATION",
    label: "Scan Location",
    hint: "Bin / rack / warehouse code",
    icon: MapPin,
  },
  { id: "BATCH", label: "Scan Batch", hint: "Batch number", icon: Boxes },
  { id: "SERIAL", label: "Scan Serial", hint: "Serial number", icon: Tag },
  {
    id: "DOCUMENT",
    label: "Scan Document",
    hint: "PO / GRN / SO / MR number",
    icon: FileText,
  },
];

const TABS = [
  { id: "products", label: "Products" },
  { id: "suppliers", label: "Suppliers" },
  { id: "locations", label: "Locations" },
] as const;
type TabId = (typeof TABS)[number]["id"];

/** Legacy `ScmBarcodeDashboard`: scan (camera, handheld scanner or typed) a
 * product, location, batch, serial or document code and jump to the matching
 * record, plus the Barcode Utilities for generating barcode / QR labels,
 * assigning bins and expiry, and adding products. */
export function BarcodeView() {
  const router = useRouter();
  const { toast } = useToast();
  const canProductWrite = usePermission("scm.product.write");
  const scanMutation = useScanCode();

  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanContext, setScanContext] = useState<ScanSource>("GLOBAL");
  const [manual, setManual] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [history, setHistory] = useState(() => getScanHistory());
  const [tab, setTab] = useState<TabId>("products");
  const [productSearch, setProductSearch] = useState("");
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [generatorFormat, setGeneratorFormat] = useState<"CODE128" | "QR">(
    "CODE128",
  );
  const [label, setLabel] = useState<{
    title: string;
    label: BarcodeLabelProps;
  } | null>(null);
  const [genFor, setGenFor] = useState<BarcodeProductRow | null>(null);
  const [binFor, setBinFor] = useState<BarcodeProductRow | null>(null);
  const [expiryFor, setExpiryFor] = useState<BarcodeProductRow | null>(null);
  const [deleting, setDeleting] = useState<BarcodeProductRow | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addPrefill, setAddPrefill] = useState<string | undefined>(undefined);

  const productsQuery = useBarcodeProducts(productSearch.trim());
  const productOptions = useProductOptions();
  const suppliers = useSupplierOptions();
  const locations = useLocationOptions();
  const warehouses = useWarehouseOptions();
  const removeProduct = useDeleteScmProduct();

  const fullProduct = (id: number | undefined) =>
    id ? (productOptions.data ?? []).find((p) => p.id === id) : undefined;
  const whName = (id: number) =>
    (warehouses.data ?? []).find((w) => w.id === id)?.name ??
    "Unknown Warehouse";
  const hint = QUICK_ACTIONS.find((q) => q.id === scanContext)?.hint;

  async function resolve(code: string, source: ScanSource = "GLOBAL") {
    const value = code.trim();
    if (!value) return;
    try {
      const res = await scanMutation.mutateAsync(value);
      setResult(res);
      const primary = res.alternatives?.[0] ?? res;
      setHistory(
        addScanHistoryEntry({
          code: res.code || value,
          type: primary.type,
          label: res.alternatives
            ? `${res.alternatives.length} matches`
            : res.title,
          viewPath: res.alternatives ? undefined : res.viewPath,
          source,
        }),
      );
      // Bring the result into view even when the scan came from the table below.
      window.setTimeout(
        () =>
          document
            .getElementById("scm-scan-result")
            ?.scrollIntoView({ behavior: "smooth", block: "start" }),
        50,
      );
    } catch (err) {
      toast({ title: errorText(err, "Scan failed"), variant: "error" });
    }
  }

  function openScanner(context: ScanSource) {
    setScanContext(context);
    setScannerOpen(true);
  }

  function submitManual() {
    if (!manual.trim()) return;
    void resolve(manual, scanContext);
    setManual("");
  }

  function openAdd(code?: string) {
    setAddPrefill(code);
    setAddOpen(true);
  }

  const rows = productsQuery.data ?? [];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        variant="banner"
        icon={ScanLine}
        title="Barcode & Scanning"
        description="Scan, identify and track products, inventory, locations and SCM documents."
        action={
          <Button
            size="sm"
            variant="secondary"
            className="gap-2"
            onClick={() => router.push("/scm/master-data")}
          >
            <Database className="h-4 w-4" />
            Master Data
          </Button>
        }
      />

      <Card>
        <div className="flex flex-col gap-4 p-4">
          <h2 className="text-theme-sm font-semibold">Scanner</h2>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              className="gap-2 sm:w-auto"
              onClick={() => openScanner("GLOBAL")}
            >
              <ScanLine className="h-4 w-4" /> Scan Barcode / QR Code
            </Button>
            <div className="flex flex-1 gap-2">
              <Input
                aria-label="Code"
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitManual();
                }}
                placeholder={
                  hint
                    ? `Enter ${hint.toLowerCase()}`
                    : "Enter barcode manually, or scan with a handheld scanner"
                }
              />
              <Button
                variant="secondary"
                className="gap-2"
                onClick={submitManual}
                disabled={!manual.trim()}
                loading={scanMutation.isPending}
              >
                <Search className="h-4 w-4" /> Search
              </Button>
            </div>
          </div>
          <div>
            <div className="mb-2 text-theme-xs font-medium text-gray-500">
              Quick Actions
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {QUICK_ACTIONS.map((qa) => (
                <button
                  key={qa.id}
                  type="button"
                  onClick={() => openScanner(qa.id)}
                  className="flex flex-col items-center gap-1.5 rounded-lg border border-gray-200 p-3 text-center transition-colors hover:border-brand-300 hover:bg-brand-50 dark:border-gray-800 dark:hover:bg-brand-500/10"
                >
                  <qa.icon className="h-5 w-5 text-brand-600" />
                  <span className="text-theme-xs font-medium">{qa.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
            <Button
              size="sm"
              variant="secondary"
              className="gap-2"
              onClick={() => {
                setGeneratorFormat("CODE128");
                setGeneratorOpen(true);
              }}
            >
              <BarcodeIcon className="h-4 w-4" /> Generate Barcode
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="gap-2"
              onClick={() => {
                setGeneratorFormat("QR");
                setGeneratorOpen(true);
              }}
            >
              <QrCode className="h-4 w-4" /> Generate QR Code
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="gap-2"
              onClick={() => {
                setGeneratorFormat("CODE128");
                setGeneratorOpen(true);
              }}
            >
              <Printer className="h-4 w-4" /> Print Label
            </Button>
          </div>
        </div>
      </Card>

      {result ? (
        <div id="scm-scan-result">
          <ScanResultCard
            result={result}
            onPick={(r) => setResult(r)}
            onAddProduct={(code) => openAdd(code)}
          />
        </div>
      ) : null}

      <Card>
        <div className="flex flex-col gap-4 p-4">
          <h2 className="text-theme-sm font-semibold">Barcode Utilities</h2>
          <Tabs
            label="Barcode utilities"
            idPrefix="barcode-utils"
            tabs={TABS}
            value={tab}
            onChange={setTab}
          >
            {tab === "products" ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <Input
                    aria-label="Search products"
                    className="max-w-sm"
                    placeholder="Search products by name or SKU..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                  />
                  {canProductWrite ? (
                    <Button
                      size="sm"
                      className="gap-2"
                      onClick={() => openAdd()}
                    >
                      <Plus className="h-4 w-4" /> Add Product
                    </Button>
                  ) : null}
                </div>
                <DataTable<BarcodeProductRow>
                  caption="Products"
                  rows={rows}
                  getRowKey={(r) => String(r.id)}
                  loading={productsQuery.isPending}
                  emptyState={
                    <div className="py-8 text-center text-gray-500">
                      No products found.
                    </div>
                  }
                  columns={[
                    {
                      header: "Product",
                      cell: (r) => (
                        <span className="font-medium">{r.name}</span>
                      ),
                    },
                    {
                      header: "SKU",
                      cell: (r) => (
                        <span className="font-mono text-theme-xs">
                          {r.productCode}
                        </span>
                      ),
                    },
                    {
                      header: "Barcode",
                      cell: (r) => (
                        <span className="font-mono text-theme-xs">
                          {r.barcodeValue}
                          {!r.barcode ? (
                            <span className="ml-1 italic text-gray-500">
                              (auto)
                            </span>
                          ) : null}
                        </span>
                      ),
                    },
                    { header: "Category", cell: (r) => r.category ?? "—" },
                    {
                      header: "Bin Location",
                      cell: (r) => (
                        <div className="flex min-w-[220px] max-w-[320px] items-start justify-between gap-1.5">
                          <div className="flex flex-col gap-1 text-theme-sm text-gray-600 dark:text-gray-300">
                            {r.bins.length === 0 ? (
                              <span className="italic">Not tracked</span>
                            ) : (
                              r.bins.map((b, i) => (
                                <span
                                  key={`${b.locationId ?? "w"}-${i}`}
                                  title={b.path}
                                  className="leading-snug"
                                >
                                  {b.path}
                                </span>
                              ))
                            )}
                          </div>
                          {canProductWrite ? (
                            <button
                              type="button"
                              className="shrink-0 text-gray-400 transition-colors hover:text-brand-600"
                              title={
                                r.bins.length
                                  ? "Change manually assigned bin"
                                  : "Assign a bin location"
                              }
                              aria-label={`Assign bin for ${r.name}`}
                              onClick={() => setBinFor(r)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          ) : null}
                        </div>
                      ),
                    },
                    {
                      header: "Expiry Date",
                      cell: (r) =>
                        r.expiry.source === "BATCH" || !canProductWrite ? (
                          <span
                            className={`text-theme-sm ${expiryTone(r.expiry.status ?? undefined)}`}
                            title={
                              r.expiry.batches.length > 1
                                ? r.expiry.batches
                                    .map(
                                      (b) =>
                                        `${b.batchNumber}: ${b.expiryDate}`,
                                    )
                                    .join(", ")
                                : "Batch tracked — edit expiry under Batches"
                            }
                          >
                            {r.expiry.text}
                          </span>
                        ) : (
                          <button
                            type="button"
                            className={`text-left text-theme-sm hover:underline ${expiryTone(r.expiry.status ?? undefined)}`}
                            title="Click to set or change the expiry date"
                            onClick={() => setExpiryFor(r)}
                          >
                            {r.expiry.text}
                          </button>
                        ),
                    },
                    {
                      header: "Created",
                      cell: (r) =>
                        r.barcodeCreatedAt
                          ? formatDateTime(r.barcodeCreatedAt)
                          : "—",
                    },
                    {
                      header: "Last Updated",
                      cell: (r) => formatDateTime(r.lastUpdated),
                    },
                    {
                      header: "Actions",
                      cell: (r) => (
                        <div className="flex flex-wrap gap-1">
                          {r.barcode ? (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setLabel({
                                    title: "Product Label",
                                    label: {
                                      format: "CODE128",
                                      value: r.barcodeValue,
                                      title: r.name,
                                      subtitle: `SKU ${r.productCode}`,
                                      lines: productLabelLines(
                                        r.barcodeCreatedAt,
                                        {
                                          source: r.expiry.source,
                                          batches: [],
                                          ...(r.expiry.date
                                            ? { date: r.expiry.date }
                                            : {}),
                                        },
                                      ),
                                      secondaryQr: buildQrPayload(
                                        "PRODUCT",
                                        r.productCode,
                                        r.id,
                                      ),
                                      secondaryQrLabel:
                                        "Scan to open this product",
                                    },
                                  })
                                }
                              >
                                <Tag className="mr-1.5 h-3.5 w-3.5" /> View /
                                Print
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  void resolve(r.barcodeValue, "PRODUCT")
                                }
                              >
                                <ScanLine className="mr-1.5 h-3.5 w-3.5" /> Scan
                              </Button>
                            </>
                          ) : canProductWrite ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setGenFor(r)}
                            >
                              <BarcodeIcon className="mr-1.5 h-3.5 w-3.5" />{" "}
                              Generate Barcode
                            </Button>
                          ) : null}
                          {canProductWrite ? (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => router.push("/scm/products")}
                              >
                                <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                              </Button>
                              <ScmDeleteButton
                                label="Delete product"
                                onClick={() => setDeleting(r)}
                              />
                            </>
                          ) : null}
                        </div>
                      ),
                    },
                  ]}
                />
              </div>
            ) : null}

            {tab === "suppliers" ? (
              <DataTable
                caption="Suppliers"
                rows={(suppliers.data ?? []).slice(0, 100)}
                getRowKey={(s) => String(s.id)}
                loading={suppliers.isPending}
                emptyState={
                  <div className="py-8 text-center text-gray-500">
                    No suppliers yet — create one under Suppliers.
                  </div>
                }
                columns={[
                  {
                    header: "Company",
                    cell: (s) => (
                      <span className="font-medium">{s.companyName}</span>
                    ),
                  },
                  {
                    header: "Vendor Code",
                    cell: (s) => (
                      <span className="font-mono text-theme-xs">
                        {s.supplierCode}
                      </span>
                    ),
                  },
                  {
                    header: "Status",
                    cell: (s) => formatStatusLabel(s.status ?? ""),
                  },
                  {
                    header: "Actions",
                    cell: (s) => (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setLabel({
                            title: "Supplier QR Label",
                            label: {
                              format: "QR",
                              value: buildQrPayload(
                                "SUPPLIER",
                                s.supplierCode,
                                s.id,
                              ),
                              title: s.companyName,
                              subtitle: s.supplierCode,
                              footer: s.status
                                ? `Status: ${s.status}`
                                : undefined,
                            },
                          })
                        }
                      >
                        <Tag className="mr-1.5 h-3.5 w-3.5" /> QR Label
                      </Button>
                    ),
                  },
                ]}
              />
            ) : null}

            {tab === "locations" ? (
              <DataTable
                caption="Locations"
                rows={(locations.data ?? []).slice(0, 100)}
                getRowKey={(l) => String(l.id)}
                loading={locations.isPending}
                emptyState={
                  <div className="py-8 text-center text-gray-500">
                    No locations yet — create one under Warehouse → Locations.
                  </div>
                }
                columns={[
                  {
                    header: "Location Code",
                    cell: (l) => (
                      <span className="font-mono text-theme-xs">
                        {l.locationCode ?? l.binCode}
                      </span>
                    ),
                  },
                  ...(SCM_CLIENT_DEMO
                    ? []
                    : [
                        {
                          header: "Warehouse",
                          cell: (l: { warehouseId: number }) =>
                            whName(l.warehouseId),
                        },
                      ]),
                  { header: "Type", cell: (l) => l.locationType ?? "BIN" },
                  {
                    header: "Actions",
                    cell: (l) => (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const code = l.locationCode ?? l.binCode;
                          setLabel({
                            title: "Location QR Label",
                            label: {
                              format: "QR",
                              value: buildQrPayload("LOCATION", code, l.id),
                              title: code,
                              subtitle: whName(l.warehouseId),
                              footer: `Warehouse: ${whName(l.warehouseId)}`,
                            },
                          });
                        }}
                      >
                        <Tag className="mr-1.5 h-3.5 w-3.5" /> QR Label
                      </Button>
                    ),
                  },
                ]}
              />
            ) : null}
          </Tabs>
        </div>
      </Card>

      <ScanHistoryCard
        entries={history}
        onClear={() => setHistory(clearScanHistory())}
        onRemove={(id) => setHistory(removeScanHistoryEntry(id))}
        onOpen={(path) => router.push(path)}
      />

      <CameraScanDialog
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onResult={(code) => {
          setScannerOpen(false);
          void resolve(code, scanContext);
        }}
        placeholder={
          hint
            ? `Enter ${hint.toLowerCase()}`
            : "Enter barcode or QR value manually"
        }
      />
      <BarcodeGeneratorDialog
        open={generatorOpen}
        onClose={() => setGeneratorOpen(false)}
        initialFormat={generatorFormat}
      />
      <LabelDialog
        open={label !== null}
        onClose={() => setLabel(null)}
        dialogTitle={label?.title ?? "Label"}
        label={label?.label ?? null}
      />
      <GenerateBarcodeDialog
        product={genFor}
        full={fullProduct(genFor?.id)}
        onClose={() => setGenFor(null)}
      />
      <AssignBinDialog
        product={binFor}
        full={fullProduct(binFor?.id)}
        onClose={() => setBinFor(null)}
      />
      <SetExpiryDialog
        product={expiryFor}
        full={fullProduct(expiryFor?.id)}
        onClose={() => setExpiryFor(null)}
      />
      <AddProductDialog
        open={addOpen}
        initialCode={addPrefill}
        onClose={() => setAddOpen(false)}
        onCreated={(product) => {
          setAddOpen(false);
          router.push(`/scm/inventory/overview/${product.id}`);
        }}
      />
      <ScmDeleteDialog<BarcodeProductRow>
        target={deleting}
        onClose={() => setDeleting(null)}
        title="Delete product?"
        describe={(p) =>
          `Delete ${p.name} (${p.productCode}) from the catalog? Products with stock history can't be deleted — mark them inactive instead.`
        }
        confirmText="Delete product"
        run={(p) => removeProduct.mutateAsync(p.id)}
        successMessage="Product deleted"
        errorFallback="Could not delete product"
      />
    </div>
  );
}

function ScanHistoryCard({
  entries,
  onClear,
  onRemove,
  onOpen,
}: {
  entries: ReturnType<typeof getScanHistory>;
  onClear: () => void;
  onRemove: (id: string) => void;
  onOpen: (path: string) => void;
}) {
  return (
    <Card>
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-theme-sm font-semibold">Recent scans</h2>
          {entries.length > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5"
              onClick={onClear}
            >
              <Undo2 className="h-3.5 w-3.5" /> Clear
            </Button>
          ) : null}
        </div>
        {entries.length === 0 ? (
          <p className="text-theme-sm text-gray-500">
            Scans from this session appear here (kept in this browser only).
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-gray-100 rounded-xl border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
            {entries.map((e) => (
              <div
                key={e.id}
                className="flex items-center justify-between gap-3 p-3"
              >
                <span className="font-mono text-theme-xs text-gray-500">
                  {e.code}
                </span>
                <span className="min-w-0 flex-1 truncate text-theme-sm">
                  {e.label}
                </span>
                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-theme-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                  {formatStatusLabel(e.type)}
                </span>
                <span className="hidden text-theme-xs text-gray-500 sm:inline">
                  {new Date(e.time).toLocaleTimeString()}
                </span>
                {e.viewPath ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onOpen(e.viewPath as string)}
                  >
                    Open
                  </Button>
                ) : null}
                <button
                  type="button"
                  className="text-gray-400 hover:text-error-600"
                  aria-label="Remove from history"
                  onClick={() => onRemove(e.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
