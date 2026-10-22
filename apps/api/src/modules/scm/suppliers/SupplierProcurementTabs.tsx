import type { ElementType } from "react";
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
import { ShoppingCart, PackageCheck } from "lucide-react";
import type { PurchaseOrder, ScmPurchaseOrder, GoodsReceipt } from "@/types";
import { formatCurrency, formatStatusLabel } from "@/modules/scm/shared/format";
import {
  GRN_STATUS_TONE,
  PO_STATUS_TONE,
} from "@/modules/scm/procurement/procurementHelpers";

export function EmptyTab({
  icon: Icon,
  title,
  hint,
}: {
  icon: ElementType;
  title: string;
  hint: string;
}) {
  return (
    <Card className="border-dashed">
      <CardContent className="py-12 text-center text-muted-foreground space-y-2">
        <Icon className="h-10 w-10 mx-auto text-muted-foreground/40" />
        <div className="font-medium text-foreground">{title}</div>
        <p className="text-xs max-w-sm mx-auto">{hint}</p>
      </CardContent>
    </Card>
  );
}

/** Supplier's purchase orders from both the SCM procurement flow and the legacy Purchases module. */
export function SupplierPurchaseOrdersTab({
  scmPurchaseOrders,
  legacyPurchaseOrders,
  currency,
}: {
  scmPurchaseOrders: ScmPurchaseOrder[];
  legacyPurchaseOrders: PurchaseOrder[];
  currency?: string;
}) {
  if (scmPurchaseOrders.length === 0 && legacyPurchaseOrders.length === 0) {
    return (
      <EmptyTab
        icon={ShoppingCart}
        title="No purchase orders yet"
        hint="Purchase orders raised against this supplier will appear here."
      />
    );
  }
  const rows = [
    ...scmPurchaseOrders.map((po) => ({
      id: po.id,
      number: po.poNumber,
      date: po.poDate,
      source: "Procurement",
      total: po.total || 0,
      status: formatStatusLabel(po.status),
      tone: PO_STATUS_TONE[po.status],
      currency: po.currency || currency,
    })),
    ...legacyPurchaseOrders.map((po) => ({
      id: po.id,
      number: po.poNumber,
      date: po.date,
      source: "Purchases",
      total: po.total || 0,
      status: po.status,
      tone: "",
      currency,
    })),
  ].sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>PO Number</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={`${r.source}-${r.id}`}>
                <TableCell className="font-mono font-medium">
                  {r.number}
                </TableCell>
                <TableCell>{r.date}</TableCell>
                <TableCell className="text-muted-foreground">
                  {r.source}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={r.tone}>
                    {r.status}
                  </Badge>
                </TableCell>
                <TableCell>{formatCurrency(r.total, r.currency, 0)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function SupplierGrnsTab({ grns }: { grns: GoodsReceipt[] }) {
  if (grns.length === 0) {
    return (
      <EmptyTab
        icon={PackageCheck}
        title="No goods receipts yet"
        hint="Goods receipt notes recorded against this supplier's purchase orders will appear here."
      />
    );
  }
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>GRN #</TableHead>
              <TableHead>Purchase Order</TableHead>
              <TableHead>Receipt Date</TableHead>
              <TableHead>Accepted</TableHead>
              <TableHead>Rejected</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {grns.map((g) => (
              <TableRow key={g.id}>
                <TableCell className="font-mono font-medium">
                  {g.grnNumber}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {g.purchaseOrderNumber || "—"}
                </TableCell>
                <TableCell>{g.receiptDate}</TableCell>
                <TableCell>
                  {g.items.reduce((s, it) => s + (it.acceptedQuantity || 0), 0)}
                </TableCell>
                <TableCell>
                  {g.items.reduce((s, it) => s + (it.rejectedQuantity || 0), 0)}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={GRN_STATUS_TONE[g.status]}
                  >
                    {formatStatusLabel(g.status)}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
