// CRM Core Domain — Products catalog. New top-nav tab, additive alongside the other CRM Core
// Domain tabs (Accounts, Pipeline). Each Product is a real relational record (`crm/products`)
// that can be added as a line item to a Deal (`DealDetail.tsx` Products tab) or a Quote
// (`QuoteForm.tsx`).
import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  Package,
  Plus,
  Search,
  Tag,
  IndianRupee,
  Trash2,
  Eye,
  Pencil,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { useAuth } from "@/context/AuthContext";
import { useCrmDomainData } from "./domain/useCrmDomainData";
import {
  createCrmProduct,
  deleteCrmProduct,
  updateCrmProduct,
} from "./domain/productsService";
import { CrmProduct, CrmProductInput } from "./domain/types";
import { DeleteConfirmDialog, EmptyState } from "./intelligence/components";
import { ImportExportBar } from "./importExport/ImportExportBar";
import {
  FieldSchema,
  MappedImportRow,
  DuplicateStrategy,
} from "./importExport/types";
import {
  commitFirebaseImport,
  logBulkImportAudit,
} from "./importExport/commitHelpers";
import { CRM_PRODUCTS_PATH } from "./domain/config";
import { usePagination, PaginationFooter } from "./components/Pagination";
import { canManageProducts, isCrmAdmin } from "./domain/roles";
import { BackToDashboardButton } from "./components/BackToDashboardButton";

const PRODUCT_IMPORT_EXPORT_FIELDS: FieldSchema<CrmProduct>[] = [
  { key: "name", label: "Product Name", required: true },
  {
    key: "code",
    label: "Code / SKU",
    required: true,
    aliases: ["Product Code", "SKU"],
  },
  { key: "category", label: "Category" },
  { key: "vendor", label: "Vendor" },
  { key: "unitPrice", label: "Unit Price", required: true, type: "currency" },
  { key: "taxPercent", label: "Tax %", type: "number" },
  { key: "description", label: "Description" },
  {
    key: "active",
    label: "Active",
    type: "boolean",
    exportValue: (r) => (r.active ? "Yes" : "No"),
  },
];

const emptyForm = (): CrmProductInput => ({
  name: "",
  code: "",
  category: "",
  vendor: "",
  unitPrice: 0,
  taxPercent: 0,
  description: "",
  active: true,
});

export default function Products() {
  const location = useLocation();
  const fromDashboard = !!(
    location.state as { fromCrmDashboard?: boolean } | null
  )?.fromCrmDashboard;
  const { user } = useAuth();
  const currentUser = user?.name || user?.username || "CRM User";
  const canManage = canManageProducts(user);
  const { products, dealProducts, quotationItems, loading } =
    useCrmDomainData();

  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CrmProductInput>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [viewingProduct, setViewingProduct] = useState<CrmProduct | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) =>
      [p.name, p.code, p.category, p.vendor]
        .filter(Boolean)
        .some((f) => (f as string).toLowerCase().includes(q)),
    );
  }, [products, query]);

  const { paged, page, setPage, pageSize, setPageSize, totalPages, total } =
    usePagination(filtered);

  const usageCount = (productId: string) =>
    dealProducts.filter((dp) => dp.productId === productId).length +
    quotationItems.filter((qi) => qi.productId === productId).length;

  const commitProductsImport = async (
    importRows: MappedImportRow[],
    strategy: DuplicateStrategy,
  ) => {
    const summary = await commitFirebaseImport(
      CRM_PRODUCTS_PATH,
      importRows,
      strategy,
      (row) => {
        const data = {
          ...row.data,
          active: row.data.active === undefined ? true : !!row.data.active,
          unitPrice: Number(row.data.unitPrice) || 0,
          taxPercent: Number(row.data.taxPercent) || 0,
        };
        if (row.isDuplicate && strategy === "update")
          return { ...data, updatedBy: currentUser, updatedAt: Date.now() };
        return { ...data, createdBy: currentUser, createdAt: Date.now() };
      },
    );
    await logBulkImportAudit("product", "Products", summary, currentUser);
    return summary;
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (p: CrmProduct) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      code: p.code,
      category: p.category || "",
      vendor: p.vendor || "",
      unitPrice: p.unitPrice,
      taxPercent: p.taxPercent || 0,
      description: p.description || "",
      active: p.active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.code.trim() || !canManage) return;
    setSaving(true);
    try {
      if (editingId) {
        await updateCrmProduct(editingId, form, currentUser);
        toast.success("Product updated");
      } else {
        await createCrmProduct(form, currentUser);
        toast.success("Product created");
      }
      setDialogOpen(false);
      setForm(emptyForm());
      setEditingId(null);
    } catch (err) {
      console.error("Failed to save Product:", err);
      toast.error("Failed to save product. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (viewingProduct) {
    const backButton = fromDashboard ? (
      <BackToDashboardButton />
    ) : (
      <Button
        size="sm"
        variant="ghost"
        className="rounded-xl gap-1.5 -ml-2"
        onClick={() => setViewingProduct(null)}
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Products
      </Button>
    );

    return (
      <div className="space-y-6 pb-8">
        {backButton}
        <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl p-6 space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2.5">
              <span className="p-2.5 bg-brand-50 text-brand-600 rounded-2xl border border-brand-200">
                <Package className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {viewingProduct.name}
                </h2>
                <p className="text-sm text-slate-400 flex items-center gap-1">
                  <Tag className="h-3 w-3" /> {viewingProduct.code}
                </p>
              </div>
            </div>
            {viewingProduct.active ? (
              <Badge
                variant="outline"
                className="bg-emerald-50 text-emerald-700 border-emerald-200 border gap-1"
              >
                <CheckCircle2 className="h-3 w-3" /> Active
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="bg-slate-100 text-slate-500 border-slate-200 border gap-1"
              >
                <XCircle className="h-3 w-3" /> Inactive
              </Badge>
            )}
          </div>

          <div className="grid md:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">
                Category
              </Label>
              <p className="min-h-9 rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-800">
                {viewingProduct.category || "—"}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">Vendor</Label>
              <p className="min-h-9 rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-800">
                {viewingProduct.vendor || "—"}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">
                Used In Deals
              </Label>
              <p className="min-h-9 rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-800">
                {usageCount(viewingProduct.id)}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">
                Unit Price
              </Label>
              <p className="min-h-9 rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-800 font-semibold flex items-center gap-0.5">
                <IndianRupee className="h-3.5 w-3.5" />
                {viewingProduct.unitPrice.toLocaleString("en-IN")}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">Tax %</Label>
              <p className="min-h-9 rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-800">
                {viewingProduct.taxPercent || 0}%
              </p>
            </div>
            {viewingProduct.description && (
              <div className="md:col-span-3 space-y-1.5">
                <Label className="text-xs font-bold text-slate-600">
                  Description
                </Label>
                <p className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-800 whitespace-pre-wrap">
                  {viewingProduct.description}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl p-4 flex items-center justify-between flex-wrap gap-3">
          <div className="text-sm text-slate-400">
            View-only — use Edit to change these details.
          </div>
          {canManage && (
            <Button
              className="rounded-xl gap-1.5"
              onClick={() => {
                const p = viewingProduct;
                setViewingProduct(null);
                openEdit(p);
              }}
            >
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (dialogOpen) {
    const backButton = fromDashboard ? (
      <BackToDashboardButton />
    ) : (
      <Button
        size="sm"
        variant="ghost"
        className="rounded-xl gap-1.5 -ml-2"
        onClick={() => setDialogOpen(false)}
        disabled={saving}
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Products
      </Button>
    );

    return (
      <div className="space-y-6 pb-8">
        {backButton}
        <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl p-6 space-y-5">
          <div className="flex items-center gap-2.5">
            <span className="p-2.5 bg-brand-50 text-brand-600 rounded-2xl border border-brand-200">
              <Package className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {editingId ? "Edit Product" : "Add Product"}
              </h2>
              <p className="text-sm text-slate-400">
                Your product/service catalog — add these to Deals and Quotes as
                line items.
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">
                Product Name *
              </Label>
              <Input
                className="h-9 rounded-xl"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="Industrial Woven Fabric Roll"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">
                Code / SKU *
              </Label>
              <Input
                className="h-9 rounded-xl"
                value={form.code}
                onChange={(e) =>
                  setForm((f) => ({ ...f, code: e.target.value }))
                }
                placeholder="SKU-1001"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">
                Category
              </Label>
              <Input
                className="h-9 rounded-xl"
                value={form.category}
                onChange={(e) =>
                  setForm((f) => ({ ...f, category: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">Vendor</Label>
              <Input
                className="h-9 rounded-xl"
                value={form.vendor}
                onChange={(e) =>
                  setForm((f) => ({ ...f, vendor: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">
                Unit Price *
              </Label>
              <Input
                className="h-9 rounded-xl"
                type="number"
                min={0}
                value={form.unitPrice}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    unitPrice: Number(e.target.value) || 0,
                  }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">Tax %</Label>
              <Input
                className="h-9 rounded-xl"
                type="number"
                min={0}
                value={form.taxPercent}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    taxPercent: Number(e.target.value) || 0,
                  }))
                }
              />
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">
                Description
              </Label>
              <Textarea
                rows={2}
                className="rounded-xl"
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
              />
            </div>
            <div className="md:col-span-2 flex items-center justify-between rounded-xl border border-slate-200 p-3">
              <Label className="text-sm">Active</Label>
              <Switch
                checked={form.active}
                onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))}
              />
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl p-4 flex items-center justify-between flex-wrap gap-3">
          <div className="text-sm text-slate-400">
            Fields marked with * are required.
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="rounded-xl border-red-200 text-red-600 bg-red-50/50 hover:text-red-700 hover:border-red-400 hover:bg-red-100"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              className="rounded-xl"
              onClick={handleSave}
              disabled={!form.name.trim() || !form.code.trim() || saving}
            >
              {saving
                ? "Saving…"
                : editingId
                  ? "Save Changes"
                  : "Create Product"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BackToDashboardButton />
      <Card className="crm-panel-frame rounded-3xl overflow-hidden bg-white">
        <CardHeader className="crm-panel-header relative overflow-hidden p-5 border-b border-brand-200/50 bg-gradient-to-br from-white via-brand-100/70 to-blue-100/50 flex flex-row items-center justify-between gap-4 flex-wrap">
          <span
            aria-hidden
            className="pointer-events-none absolute -left-16 -top-20 h-48 w-48 rounded-full bg-brand-300/40 blur-3xl"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute right-10 -bottom-20 h-48 w-48 rounded-full bg-blue-300/35 blur-3xl"
          />
          <div className="relative">
            <CardTitle className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <Package className="h-4 w-4 text-brand-600" /> Products
            </CardTitle>
            <CardDescription className="text-sm text-slate-500">
              Your product/service catalog — add these to Deals and Quotes as
              line items.
            </CardDescription>
          </div>
          <div className="relative flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search products…"
                className="pl-8 h-9 rounded-xl w-56 border-brand-300 shadow-[0_0_0_3px_rgba(77,159,75,0.12)] focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-brand-400 focus-visible:shadow-[0_0_0_3px_rgba(77,159,75,0.18)] transition-shadow"
              />
            </div>
            <ImportExportBar
              moduleLabel="Products"
              fields={PRODUCT_IMPORT_EXPORT_FIELDS}
              allRecords={products}
              filteredRecords={filtered}
              fileBaseName="crm-products"
              duplicate={{
                keys: ["code"],
                findExisting: (mapped) => {
                  const code = String(mapped.code || "")
                    .trim()
                    .toLowerCase();
                  if (!code) return undefined;
                  const match = products.find(
                    (p) => p.code.trim().toLowerCase() === code,
                  );
                  return match
                    ? { id: match.id, label: match.name }
                    : undefined;
                },
              }}
              commitImport={commitProductsImport}
            />
            {canManage && (
              <Button
                size="sm"
                className="rounded-xl gap-1.5 shrink-0"
                onClick={openCreate}
              >
                <Plus className="h-4 w-4" /> Add Product
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-16 text-slate-400 text-xs">
              Loading Products…
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Package}
              title={query ? `No products match "${query}"` : "No products yet"}
              description="Add your first product to start attaching it to deals and quotes."
            />
          ) : (
            <div className="overflow-x-auto crm-tracker-scroll">
              <Table>
                <TableHeader
                  style={{
                    background:
                      "linear-gradient(90deg, #4D9F4B 0%, #72B84A 50%, #9FCA48 100%)",
                  }}
                >
                  <TableRow className="hover:bg-transparent border-b-0">
                    <TableHead className="font-black text-sm uppercase tracking-wider text-white py-2.5">
                      Product
                    </TableHead>
                    <TableHead className="font-black text-sm uppercase tracking-wider text-white py-2.5">
                      Category
                    </TableHead>
                    <TableHead className="font-black text-sm uppercase tracking-wider text-white py-2.5">
                      Vendor
                    </TableHead>
                    <TableHead className="font-black text-sm uppercase tracking-wider text-white py-2.5">
                      Unit Price
                    </TableHead>
                    <TableHead className="font-black text-sm uppercase tracking-wider text-white py-2.5">
                      Tax %
                    </TableHead>
                    <TableHead className="font-black text-sm uppercase tracking-wider text-white py-2.5">
                      Status
                    </TableHead>
                    <TableHead className="font-black text-sm uppercase tracking-wider text-white text-center w-[220px] whitespace-nowrap py-2.5">
                      Action
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="[&_tr:last-child]:border-b [&_tr:last-child]:border-brand-200">
                  {paged.map((p) => {
                    const used = usageCount(p.id);
                    return (
                      <TableRow
                        key={p.id}
                        className="border-b border-brand-200 last:border-b-0 hover:bg-brand-50/40"
                      >
                        <TableCell className="py-1">
                          <div className="flex flex-col items-center justify-center h-full">
                            <p className="font-semibold text-slate-800">
                              {p.name}
                            </p>
                            <p className="text-sm text-slate-600 flex items-center gap-1">
                              <Tag className="h-3 w-3" /> {p.code}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="py-1 text-base text-slate-600">
                          {p.category || "—"}
                        </TableCell>
                        <TableCell className="py-1 text-base text-slate-600">
                          {p.vendor || "—"}
                        </TableCell>
                        <TableCell className="py-1 text-base text-slate-700 font-semibold">
                          <span className="inline-flex items-center gap-0.5">
                            <IndianRupee className="h-3.5 w-3.5" />
                            {p.unitPrice.toLocaleString("en-IN")}
                          </span>
                        </TableCell>
                        <TableCell className="py-1 text-base text-slate-600">
                          {p.taxPercent || 0}%
                        </TableCell>
                        <TableCell className="py-1">
                          {p.active ? (
                            <Badge
                              variant="outline"
                              className="bg-emerald-50 text-emerald-700 border-emerald-200 border gap-1"
                            >
                              <CheckCircle2 className="h-3 w-3" /> Active
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="bg-slate-100 text-slate-500 border-slate-200 border gap-1"
                            >
                              <XCircle className="h-3 w-3" /> Inactive
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="py-1">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-2 gap-1 text-xs font-semibold text-blue-600 border-blue-200 bg-blue-50/50 hover:text-blue-700 hover:border-blue-400 hover:bg-blue-100 rounded-lg"
                              title="View product"
                              onClick={() => setViewingProduct(p)}
                            >
                              <Eye className="h-3.5 w-3.5" /> View
                            </Button>
                            {canManage ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 px-2 gap-1 text-xs font-semibold text-brand-700 border-brand-200 bg-brand-50/50 hover:text-brand-800 hover:border-brand-400 hover:bg-brand-100 rounded-lg"
                                  title="Edit product"
                                  onClick={() => openEdit(p)}
                                >
                                  <Pencil className="h-3.5 w-3.5" /> Edit
                                </Button>
                                {isCrmAdmin(user) && (
                                  <DeleteConfirmDialog
                                    trigger={
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-8 px-2 gap-1 text-xs font-semibold text-red-700 border-red-200 bg-red-50/50 hover:text-red-800 hover:border-red-400 hover:bg-red-100 rounded-lg"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />{" "}
                                        Delete
                                      </Button>
                                    }
                                    title={`Delete "${p.name}"?`}
                                    description="This product will be moved to the CRM Recycle Bin."
                                    warning={
                                      used > 0
                                        ? `This product is used in ${used} deal line item${used === 1 ? "" : "s"} — remove it from those deals first.`
                                        : undefined
                                    }
                                    onConfirm={() =>
                                      deleteCrmProduct(p.id, p.name, user, used)
                                    }
                                  />
                                )}
                              </>
                            ) : (
                              <span className="text-xs text-slate-300">—</span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          <PaginationFooter
            page={page}
            setPage={setPage}
            pageSize={pageSize}
            setPageSize={setPageSize}
            totalPages={totalPages}
            total={total}
          />
        </CardContent>
      </Card>
    </div>
  );
}
