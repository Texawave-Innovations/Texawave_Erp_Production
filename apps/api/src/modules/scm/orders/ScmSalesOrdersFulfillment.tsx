import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/modules/scm/shared/components/ScmButton";
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
import { FileStack, ArrowRight, ScanLine } from "lucide-react";
import { toast } from "sonner";
import {
  ALL,
  SHIPPED_STATUS_TONE,
  useOrderFulfillmentData,
} from "./orderHelpers";
import ScmBarcodeScanner from "../barcode/components/ScmBarcodeScanner";
import { addScanHistoryEntry } from "../barcode/barcodeService";

export default function ScmSalesOrdersFulfillment() {
  const navigate = useNavigate();
  const { loading, error, salesOrders, fulfillments } =
    useOrderFulfillmentData();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [scanOpen, setScanOpen] = useState(false);

  const fulfillmentBySo = useMemo(() => {
    const map = new Map<string, typeof fulfillments>();
    for (const f of fulfillments) {
      if (f.status === "CANCELLED") continue;
      map.set(f.salesOrderId, [...(map.get(f.salesOrderId) || []), f]);
    }
    return map;
  }, [fulfillments]);

  const filtered = useMemo(() => {
    let rows = salesOrders;
    if (statusFilter !== ALL)
      rows = rows.filter(
        (so) => (so.shippedStatus || "Not Shipped") === statusFilter,
      );
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(
        (so) =>
          so.soNumber?.toLowerCase().includes(q) ||
          so.customerName?.toLowerCase().includes(q),
      );
    }
    return [...rows].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [salesOrders, statusFilter, search]);

  const handleScan = (code: string) => {
    const scanned = code.trim();
    const match = salesOrders.find(
      (so) => so.soNumber?.toLowerCase() === scanned.toLowerCase(),
    );
    if (!match) {
      toast.error(`No sales order found for "${scanned}"`);
      addScanHistoryEntry({
        code: scanned,
        type: "UNKNOWN",
        label: "Not found",
        source: "GLOBAL",
      });
      return;
    }
    addScanHistoryEntry({
      code: scanned,
      type: "SALES_ORDER",
      label: match.soNumber,
      source: "GLOBAL",
    });
    setSearch(match.soNumber);
    toast.success(`Found: ${match.soNumber}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Sales Orders</h2>
          <p className="text-muted-foreground mt-1">
            Sales orders with SCM fulfillment status. The order itself remains
            owned by the Sales module — this is a read-only fulfillment view.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() => setScanOpen(true)}
        >
          <ScanLine className="h-4 w-4 mr-2" /> Scan Order
        </Button>
      </div>
      {error && (
        <div className="text-sm text-red-600 border border-red-200 bg-red-50 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <Card>
        <CardHeader className="pb-4 flex flex-col sm:flex-row gap-3 sm:items-center">
          <Input
            className="max-w-xs"
            placeholder="Search SO # or customer"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Shipped Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All Statuses</SelectItem>
              <SelectItem value="Not Shipped">Not Shipped</SelectItem>
              <SelectItem value="Partially Shipped">
                Partially Shipped
              </SelectItem>
              <SelectItem value="Shipped">Shipped</SelectItem>
            </SelectContent>
          </Select>
          <div className="text-sm text-muted-foreground sm:ml-auto">
            {filtered.length} of {salesOrders.length} sales orders
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SO #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Order Status</TableHead>
                  <TableHead>Shipped Status</TableHead>
                  <TableHead>Fulfillments</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-16 text-muted-foreground"
                    >
                      Loading sales orders...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-16 text-muted-foreground"
                    >
                      <div className="flex flex-col items-center gap-3">
                        <FileStack className="h-10 w-10 text-muted-foreground/40" />
                        <div className="text-lg font-medium text-foreground">
                          No sales orders found
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((so) => {
                    const fs = fulfillmentBySo.get(so.id) || [];
                    return (
                      <TableRow
                        key={so.id}
                        className="hover:bg-muted/50 transition-colors"
                      >
                        <TableCell className="font-mono text-xs">
                          {so.soNumber}
                        </TableCell>
                        <TableCell>{so.customerName}</TableCell>
                        <TableCell className="text-sm">{so.soDate}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{so.status}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              SHIPPED_STATUS_TONE[
                                so.shippedStatus || "Not Shipped"
                              ]
                            }
                          >
                            {so.shippedStatus || "Not Shipped"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {fs.length === 0 ? "—" : `${fs.length} record(s)`}
                        </TableCell>
                        <TableCell>
                          {fs.length > 0 ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                navigate(`/scm/orders/fulfillment/${fs[0].id}`)
                              }
                            >
                              View <ArrowRight className="h-3.5 w-3.5 ml-1" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                navigate("/scm/orders/fulfillment")
                              }
                            >
                              Start Fulfillment{" "}
                              <ArrowRight className="h-3.5 w-3.5 ml-1" />
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
        </CardContent>
      </Card>

      <ScmBarcodeScanner
        open={scanOpen}
        onOpenChange={setScanOpen}
        onResult={(code) => {
          setScanOpen(false);
          handleScan(code);
        }}
        title="Scan Sales Order"
        placeholder="Sales order number"
      />
    </div>
  );
}
