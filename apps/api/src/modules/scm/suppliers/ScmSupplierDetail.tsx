import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/modules/scm/shared/components/ScmButton";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/modules/scm/shared/components/ScmTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Pencil,
  Building2,
  Phone,
  Mail,
  MapPin,
  Landmark,
  Star,
  FileText,
  Users,
  Package,
  Send,
  ReceiptText,
  ShoppingCart,
  PackageCheck,
  Wallet,
  Undo2,
  TrendingUp,
  FolderOpen,
  History,
  Upload,
  QrCode,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  getAllRecords,
  getRecordById,
  updateRecord,
} from "@/services/firebase";
import { uploadFile } from "@/services/cloudinary";
import type {
  Vendor,
  PurchaseOrder,
  PaymentMade,
  VendorDocument,
  ScmPurchaseOrder,
  GoodsReceipt,
} from "@/types";
import { getSupplierStatus, statusBadgeTone } from "./supplierHelpers";
import {
  EmptyTab,
  SupplierGrnsTab,
  SupplierPurchaseOrdersTab,
} from "./SupplierProcurementTabs";
import { PROCUREMENT_PATHS } from "@/modules/scm/procurement/procurementPaths";
import { OPEN_PO_STATUSES } from "@/modules/scm/shared/businessRules";
import { errorMessage, formatCurrency } from "@/modules/scm/shared/format";
import ScmSupplierFormDialog from "./ScmSupplierFormDialog";
import { useAuth } from "@/context/AuthContext";
import { logRecordAudit } from "@/services/auditLog";
import { SCM_CROSS_MODULE_PATHS } from "@/modules/scm/shared/crossModulePaths";
import { actorName } from "@/modules/scm/shared/actor";
import ScmBarcodeLabel from "../barcode/components/ScmBarcodeLabel";
import { buildQrPayload } from "../barcode/barcodeHelpers";

interface AuditEntry {
  id: string;
  action: string;
  performedBy: string;
  details: string;
  timestamp: number;
}

export default function ScmSupplierDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [scmPurchaseOrders, setScmPurchaseOrders] = useState<
    ScmPurchaseOrder[]
  >([]);
  const [grns, setGrns] = useState<GoodsReceipt[]>([]);
  const [payments, setPayments] = useState<PaymentMade[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [v, pos, scmPos, grnRecords, pays, auditRecords] =
        await Promise.all([
          getRecordById(SCM_CROSS_MODULE_PATHS.vendors, id),
          getAllRecords(SCM_CROSS_MODULE_PATHS.legacyPurchaseOrders).catch(
            () => [],
          ),
          getAllRecords(PROCUREMENT_PATHS.purchaseOrders).catch(() => []),
          getAllRecords(PROCUREMENT_PATHS.grns).catch(() => []),
          getAllRecords("purchases/paymentsMade").catch(() => []),
          getAllRecords(`contacts/vendors/${id}/auditLogs`).catch(() => []),
        ]);
      setVendor(v as Vendor | null);
      setPurchaseOrders(
        (pos as PurchaseOrder[]).filter((po) => po.vendorId === id),
      );
      setScmPurchaseOrders(
        (scmPos as ScmPurchaseOrder[]).filter((po) => po.vendorId === id),
      );
      setGrns(
        (grnRecords as GoodsReceipt[])
          .filter((g) => g.vendorId === id)
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
      );
      setPayments((pays as PaymentMade[]).filter((p) => p.vendorId === id));
      setAudit(
        (auditRecords as AuditEntry[]).sort(
          (a, b) => b.timestamp - a.timestamp,
        ),
      );
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to load supplier"));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const productsSupplied = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        lastRate: number;
        lastDate: string;
        totalQty: number;
        pos: number;
      }
    >();
    for (const po of purchaseOrders) {
      const date = po.date || "";
      for (const item of po.items || []) {
        const existing = map.get(item.itemName);
        if (!existing || date > existing.lastDate) {
          map.set(item.itemName, {
            name: item.itemName,
            lastRate: item.rate,
            lastDate: date,
            totalQty: (existing?.totalQty || 0) + item.qty,
            pos: (existing?.pos || 0) + 1,
          });
        } else {
          map.set(item.itemName, {
            ...existing,
            totalQty: existing.totalQty + item.qty,
            pos: existing.pos + 1,
          });
        }
      }
    }
    return Array.from(map.values());
  }, [purchaseOrders]);

  const poCount =
    purchaseOrders.length +
    scmPurchaseOrders.filter((po) => po.status !== "CANCELLED").length;
  const totalPOValue =
    purchaseOrders.reduce((s, po) => s + (po.total || 0), 0) +
    scmPurchaseOrders
      .filter((po) => po.status !== "CANCELLED")
      .reduce((s, po) => s + (po.total || 0), 0);
  const openPOs =
    purchaseOrders.filter((po) => po.status === "Draft" || po.status === "Sent")
      .length +
    scmPurchaseOrders.filter((po) => OPEN_PO_STATUSES.has(po.status)).length;
  const totalPaid = payments.reduce((s, p) => s + (p.amount || 0), 0);

  const handleDocUpload = async (file: File) => {
    if (!vendor) return;
    setUploading(true);
    try {
      const url = await uploadFile(file);
      const doc: VendorDocument = {
        id: `doc-${Date.now()}`,
        name: file.name,
        url,
        uploadedAt: Date.now(),
      };
      const nextDocs = [...(vendor.documents || []), doc];
      await updateRecord(SCM_CROSS_MODULE_PATHS.vendors, vendor.id, {
        documents: nextDocs,
      });
      await logRecordAudit(
        SCM_CROSS_MODULE_PATHS.vendors,
        vendor.id,
        "Document uploaded",
        actorName(user),
        `Uploaded "${file.name}"`,
      );
      toast.success("Document uploaded");
      load();
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to upload document"));
    } finally {
      setUploading(false);
    }
  };

  if (loading)
    return (
      <div className="py-20 text-center text-muted-foreground">
        Loading supplier...
      </div>
    );
  if (!vendor)
    return (
      <div className="py-20 text-center text-muted-foreground">
        Supplier not found.
      </div>
    );

  const status = getSupplierStatus(vendor);
  const money = (n: number) => formatCurrency(n, vendor.currency, 0);
  const address =
    vendor.addresses?.find((a) => a.isDefault) || vendor.addresses?.[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/scm/suppliers")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold text-foreground">
                {vendor.companyName}
              </h2>
              <Badge variant="outline" className={statusBadgeTone(status)}>
                {status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground font-mono">
              {vendor.vendorCode}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setQrOpen(true)}>
            <QrCode className="h-4 w-4 mr-2" /> Print QR
          </Button>
          <Button onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4 mr-2" /> Edit Supplier
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <div className="overflow-x-auto">
          <TabsList className="inline-flex w-max">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="contacts">Contacts</TabsTrigger>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="rfqs">RFQs</TabsTrigger>
            <TabsTrigger value="quotations">Supplier Quotations</TabsTrigger>
            <TabsTrigger value="pos">Purchase Orders</TabsTrigger>
            <TabsTrigger value="grns">GRNs</TabsTrigger>
            <TabsTrigger value="bills">Bills</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="returns">Returns</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4 space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5" /> Contact
                </div>
                <div className="text-sm font-medium">
                  {vendor.contactPerson || "—"}
                </div>
                <div className="text-sm flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-3.5 w-3.5 text-primary" />{" "}
                  {vendor.phone || "—"}
                </div>
                <div className="text-sm flex items-center gap-2 text-muted-foreground truncate">
                  <Mail className="h-3.5 w-3.5 text-primary" />{" "}
                  {vendor.email || "—"}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> Tax & Location
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">GST:</span>{" "}
                  <span className="font-mono">{vendor.gst || "—"}</span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">PAN:</span>{" "}
                  <span className="font-mono">{vendor.pan || "—"}</span>
                </div>
                <div className="text-sm text-muted-foreground truncate">
                  {address
                    ? [address.street, address.city, address.state]
                        .filter(Boolean)
                        .join(", ")
                    : "—"}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Landmark className="h-3.5 w-3.5" /> Commercial
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Payment Terms:</span>{" "}
                  {vendor.paymentTerms || "—"}
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Credit Limit:</span>{" "}
                  {vendor.creditLimit ? money(vendor.creditLimit) : "—"}
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Lead Time:</span>{" "}
                  {vendor.leadTimeDays ? `${vendor.leadTimeDays} days` : "—"}
                </div>
                {vendor.rating && (
                  <div className="text-sm flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />{" "}
                    {vendor.rating} / 5
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {poCount === 0 ? (
            <EmptyTab
              icon={TrendingUp}
              title="Procurement data will appear here once transactions are available."
              hint="Create a purchase order for this supplier from Procurement to see live totals here."
            />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">
                    Purchase Orders
                  </p>
                  <p className="text-2xl font-bold">{poCount}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">
                    Total PO Value
                  </p>
                  <p className="text-2xl font-bold">{money(totalPOValue)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Open POs</p>
                  <p className="text-2xl font-bold">{openPOs}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Total Paid</p>
                  <p className="text-2xl font-bold">{money(totalPaid)}</p>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="contacts">
          {(vendor.contacts && vendor.contacts.length > 0) ||
          vendor.contactPerson ? (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Primary</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!vendor.contacts?.length && (
                      <TableRow>
                        <TableCell>{vendor.contactPerson}</TableCell>
                        <TableCell className="text-muted-foreground">
                          —
                        </TableCell>
                        <TableCell>{vendor.phone || "—"}</TableCell>
                        <TableCell>{vendor.email || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline">Primary</Badge>
                        </TableCell>
                      </TableRow>
                    )}
                    {vendor.contacts?.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>{c.name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {c.role || "—"}
                        </TableCell>
                        <TableCell>{c.phone || "—"}</TableCell>
                        <TableCell>{c.email || "—"}</TableCell>
                        <TableCell>
                          {c.isPrimary && (
                            <Badge variant="outline">Primary</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <EmptyTab
              icon={Users}
              title="No contacts yet"
              hint="Add a primary contact by editing this supplier."
            />
          )}
        </TabsContent>

        <TabsContent value="products">
          {productsSupplied.length === 0 ? (
            <EmptyTab
              icon={Package}
              title="No products sourced yet"
              hint="Products supplied by this vendor are derived from its purchase order history and will appear here once a PO is placed."
            />
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product / Item</TableHead>
                      <TableHead>Last Purchase Price</TableHead>
                      <TableHead>Last Purchase Date</TableHead>
                      <TableHead># POs</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productsSupplied.map((p) => (
                      <TableRow key={p.name}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell>{money(p.lastRate)}</TableCell>
                        <TableCell>{p.lastDate || "—"}</TableCell>
                        <TableCell>{p.pos}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="rfqs">
          <EmptyTab
            icon={Send}
            title="Coming in Procurement"
            hint="RFQs sent to this supplier will appear here once the Procurement RFQ workflow is built (Phase 4)."
          />
        </TabsContent>

        <TabsContent value="quotations">
          <EmptyTab
            icon={ReceiptText}
            title="Coming in Procurement"
            hint="Supplier quotations received from this vendor will appear here once the Procurement workflow is built (Phase 4)."
          />
        </TabsContent>

        <TabsContent value="pos">
          <SupplierPurchaseOrdersTab
            scmPurchaseOrders={scmPurchaseOrders}
            legacyPurchaseOrders={purchaseOrders}
            currency={vendor.currency}
          />
        </TabsContent>

        <TabsContent value="grns">
          <SupplierGrnsTab grns={grns} />
        </TabsContent>

        <TabsContent value="bills">
          <EmptyTab
            icon={FileText}
            title="No vendor bills yet"
            hint="Vendor bills raised against this supplier's purchase orders will appear here once Accounts Payable is built out."
          />
        </TabsContent>

        <TabsContent value="payments">
          {payments.length === 0 ? (
            <EmptyTab
              icon={Wallet}
              title="No payments yet"
              hint="Payments made to this supplier will appear here."
            />
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Payment #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead>Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-mono font-medium">
                          {p.paymentNumber}
                        </TableCell>
                        <TableCell>{p.paymentDate}</TableCell>
                        <TableCell>{p.mode}</TableCell>
                        <TableCell>{money(p.amount || 0)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="returns">
          <EmptyTab
            icon={Undo2}
            title="Coming in Returns"
            hint="Purchase returns raised against this supplier will appear here once the Returns module is built (Phase 8)."
          />
        </TabsContent>

        <TabsContent value="performance">
          {poCount === 0 ? (
            <EmptyTab
              icon={TrendingUp}
              title="No performance data yet"
              hint="Supplier performance will be calculated after procurement activity is available."
            />
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">
                      Purchase Orders
                    </p>
                    <p className="text-2xl font-bold">{poCount}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">
                      Total Purchase Value
                    </p>
                    <p className="text-2xl font-bold">{money(totalPOValue)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">Open POs</p>
                    <p className="text-2xl font-bold">{openPOs}</p>
                  </CardContent>
                </Card>
              </div>
              <p className="text-xs text-muted-foreground">
                On-time delivery, rejection rate and return rate will be
                calculated once GRN and Quality inspection data is tracked
                (Phase 4/8).
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="documents" className="space-y-3">
          <div className="flex justify-end">
            <label className="inline-flex">
              <input
                type="file"
                className="hidden"
                disabled={uploading}
                onChange={(e) =>
                  e.target.files?.[0] && handleDocUpload(e.target.files[0])
                }
              />
              <Button asChild variant="outline" size="sm" disabled={uploading}>
                <span>
                  <Upload className="h-3.5 w-3.5 mr-1.5" />{" "}
                  {uploading ? "Uploading..." : "Upload Document"}
                </span>
              </Button>
            </label>
          </div>
          {!vendor.documents?.length ? (
            <EmptyTab
              icon={FolderOpen}
              title="No documents yet"
              hint="Upload GST certificates, PAN, bank documents, contracts or compliance documents for this supplier."
            />
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Uploaded</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vendor.documents.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell>{d.name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(d.uploadedAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <a
                            href={d.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary hover:underline text-sm"
                          >
                            View
                          </a>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="activity">
          {audit.length === 0 ? (
            <EmptyTab
              icon={History}
              title="No activity recorded yet"
              hint="Supplier creation, edits, status changes and document uploads will be logged here."
            />
          ) : (
            <div className="space-y-2">
              {audit.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start gap-3 rounded-lg border border-slate-200 p-3"
                >
                  <History className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {entry.action}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {entry.details} · {entry.performedBy} ·{" "}
                      {new Date(entry.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <ScmSupplierFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        vendor={vendor}
        onSaved={load}
      />

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Supplier QR Code</DialogTitle>
          </DialogHeader>
          <ScmBarcodeLabel
            format="QR"
            value={buildQrPayload("SUPPLIER", vendor.vendorCode, vendor.id)}
            title={vendor.companyName}
            subtitle={vendor.vendorCode}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
