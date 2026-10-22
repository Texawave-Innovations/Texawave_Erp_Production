import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/modules/scm/shared/components/ScmButton";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/modules/scm/shared/components/ScmTable";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Plus,
  Eye,
  Pencil,
  Power,
  Star,
  Factory,
  ScanLine,
} from "lucide-react";
import { toast } from "sonner";
import { getAllRecords, updateRecord } from "@/services/firebase";
import type { Vendor, VendorStatus } from "@/types";
import {
  getSupplierStatus,
  matchesSupplierSearch,
  statusBadgeTone,
  SUPPLIER_STATUSES,
} from "./supplierHelpers";
import ScmSupplierFormDialog from "./ScmSupplierFormDialog";
import { useAuth } from "@/context/AuthContext";
import { logRecordAudit } from "@/services/auditLog";
import { SCM_CROSS_MODULE_PATHS } from "@/modules/scm/shared/crossModulePaths";
import { actorName } from "@/modules/scm/shared/actor";
import { transitionStatus } from "@/modules/scm/shared/statusTransition";
import { ALL, errorMessage } from "@/modules/scm/shared/format";
import ScmBarcodeScanner from "../barcode/components/ScmBarcodeScanner";
import { addScanHistoryEntry } from "../barcode/barcodeService";

export default function ScmSuppliers() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(ALL);
  const [typeFilter, setTypeFilter] = useState<string>(ALL);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [scanOpen, setScanOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  const loadVendors = async () => {
    setLoading(true);
    try {
      const data = (await getAllRecords(
        SCM_CROSS_MODULE_PATHS.vendors,
      )) as Vendor[];
      setVendors(data.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
    } catch {
      toast.error("Failed to load suppliers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVendors();
  }, []);

  const supplierTypes = useMemo(
    () =>
      Array.from(
        new Set(vendors.map((v) => v.type).filter(Boolean)),
      ) as string[],
    [vendors],
  );

  const filtered = useMemo(() => {
    return vendors.filter((v) => {
      if (!matchesSupplierSearch(v, debouncedSearch)) return false;
      if (statusFilter !== ALL && getSupplierStatus(v) !== statusFilter)
        return false;
      if (typeFilter !== ALL && v.type !== typeFilter) return false;
      return true;
    });
  }, [vendors, debouncedSearch, statusFilter, typeFilter]);

  /** Only flips Active <-> Inactive. Blocked / Pending Approval suppliers must be changed
   * explicitly through the edit form, never re-activated by a one-click toggle. */
  const toggleActive = async (vendor: Vendor) => {
    const current = getSupplierStatus(vendor);
    if (current !== "Active" && current !== "Inactive") return;
    const next: VendorStatus = current === "Active" ? "Inactive" : "Active";
    try {
      if (vendor.status) {
        await transitionStatus<VendorStatus>(
          SCM_CROSS_MODULE_PATHS.vendors,
          vendor.id,
          [current],
          next,
        );
      } else {
        // Legacy record without a status field (treated as Active).
        await updateRecord(SCM_CROSS_MODULE_PATHS.vendors, vendor.id, {
          status: next,
        });
      }
      await logRecordAudit(
        SCM_CROSS_MODULE_PATHS.vendors,
        vendor.id,
        "Supplier status changed",
        actorName(user),
        `${current} → ${next}`,
      );
      toast.success(`Supplier marked ${next}`);
      loadVendors();
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to update supplier status"));
    }
  };

  const handleScan = (code: string) => {
    const scanned = code.trim();
    const match = vendors.find(
      (v) => v.vendorCode?.toLowerCase() === scanned.toLowerCase(),
    );
    if (!match) {
      toast.error(`No supplier found for "${scanned}"`);
      addScanHistoryEntry({
        code: scanned,
        type: "UNKNOWN",
        label: "Not found",
        source: "SUPPLIER",
      });
      return;
    }
    addScanHistoryEntry({
      code: scanned,
      type: "SUPPLIER",
      label: match.companyName,
      viewPath: `/scm/suppliers/${match.id}`,
      source: "SUPPLIER",
    });
    navigate(`/scm/suppliers/${match.id}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Suppliers</h2>
          <p className="text-muted-foreground mt-1">
            Manage vendors, contacts, purchasing terms, performance and supplier
            relationships.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => setScanOpen(true)}>
            <ScanLine className="h-4 w-4 mr-2" /> Scan Supplier
          </Button>
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" /> Add Supplier
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            <div className="relative w-full md:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by code, name, contact, email, phone, GSTIN..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All Statuses</SelectItem>
                  {SUPPLIER_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {supplierTypes.length > 0 && (
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All Types</SelectItem>
                    {supplierTypes.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          <div className="text-sm text-muted-foreground pt-1">
            {filtered.length} of {vendors.length} suppliers
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Primary Contact</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>GSTIN</TableHead>
                  <TableHead>Payment Terms</TableHead>
                  <TableHead>Lead Time</TableHead>
                  <TableHead>Rating</TableHead>
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
                      Loading suppliers...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={11}
                      className="text-center py-16 text-muted-foreground"
                    >
                      {vendors.length === 0 ? (
                        <div className="flex flex-col items-center gap-3">
                          <Factory className="h-10 w-10 text-muted-foreground/40" />
                          <div className="text-lg font-medium text-foreground">
                            No suppliers yet
                          </div>
                          <p className="text-sm">
                            Add your first supplier to start building your
                            procurement network.
                          </p>
                          <Button
                            onClick={() => {
                              setEditing(null);
                              setFormOpen(true);
                            }}
                          >
                            <Plus className="h-4 w-4 mr-2" /> Add your first
                            supplier
                          </Button>
                        </div>
                      ) : (
                        "No suppliers match the current filters."
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((vendor) => {
                    const status = getSupplierStatus(vendor);
                    return (
                      <TableRow
                        key={vendor.id}
                        className="hover:bg-muted/50 transition-colors"
                      >
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className="font-mono text-xs"
                          >
                            {vendor.vendorCode || "—"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <button
                            type="button"
                            onClick={() =>
                              navigate(`/scm/suppliers/${vendor.id}`)
                            }
                            className="font-medium text-primary hover:underline text-left"
                          >
                            {vendor.companyName}
                          </button>
                          {vendor.type && (
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {vendor.type}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>{vendor.contactPerson || "—"}</TableCell>
                        <TableCell>{vendor.phone || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {vendor.email || "—"}
                        </TableCell>
                        <TableCell>
                          {vendor.gst ? (
                            <Badge
                              variant="outline"
                              className="font-mono text-xs"
                            >
                              {vendor.gst}
                            </Badge>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>{vendor.paymentTerms || "—"}</TableCell>
                        <TableCell>
                          {vendor.leadTimeDays
                            ? `${vendor.leadTimeDays}d`
                            : "—"}
                        </TableCell>
                        <TableCell>
                          {vendor.rating ? (
                            <span className="flex items-center gap-1 text-amber-600">
                              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                              {vendor.rating}
                            </span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={statusBadgeTone(status)}
                          >
                            {status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              title="View Supplier"
                              onClick={() =>
                                navigate(`/scm/suppliers/${vendor.id}`)
                              }
                            >
                              <Eye className="h-4 w-4 text-primary" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Edit Supplier"
                              onClick={() => {
                                setEditing(vendor);
                                setFormOpen(true);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={
                                status !== "Active" && status !== "Inactive"
                              }
                              title={
                                status === "Active"
                                  ? "Deactivate"
                                  : status === "Inactive"
                                    ? "Activate"
                                    : `${status} — change status via Edit`
                              }
                              onClick={() => toggleActive(vendor)}
                            >
                              <Power
                                className={`h-4 w-4 ${status === "Active" ? "text-emerald-600" : "text-muted-foreground"}`}
                              />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <ScmSupplierFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        vendor={editing}
        onSaved={loadVendors}
      />

      <ScmBarcodeScanner
        open={scanOpen}
        onOpenChange={setScanOpen}
        onResult={(code) => {
          setScanOpen(false);
          handleScan(code);
        }}
        title="Scan Supplier"
        placeholder="Vendor code"
      />
    </div>
  );
}
