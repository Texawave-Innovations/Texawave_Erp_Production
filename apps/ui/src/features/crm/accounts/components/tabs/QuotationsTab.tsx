"use client";

import type { Quotation } from "@texawave-erp/api-types";
import { Eye, Receipt, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/legacy-ui/badge";
import { Button } from "@/components/legacy-ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/legacy-ui/table";
import {
  DeleteConfirmDialog,
  EmptyState,
  formatMoney,
} from "@/features/crm/legacy-ui/CrmCommon";
import { useDeleteQuotation } from "@/features/crm/quotations/hooks";
import { usePermission } from "@/hooks/usePermission";
import {
  CRM_DELETE_BTN_CLASS,
  SectionShell,
  TABLE_HEAD_STYLE,
  TH_CLASS,
  VIEW_BTN_CLASS,
} from "../accountUi";

/** Read-only reflection of this account's quotations — they are created from the Quotes tab. */
export function QuotationsTab({ quotations }: { quotations: Quotation[] }) {
  const router = useRouter();
  const canDelete = usePermission("crm.quotation.delete");
  const deleteMutation = useDeleteQuotation();

  return (
    <SectionShell title="Quotations">
      {quotations.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No quotations yet"
          description="Create a quotation from the main Quotes tab and assign it to this account."
        />
      ) : (
        <Table>
          <TableHeader className="text-white">
            <TableRow
              className="hover:bg-transparent border-none"
              style={TABLE_HEAD_STYLE}
            >
              <TableHead className={TH_CLASS}>Number</TableHead>
              <TableHead className={TH_CLASS}>Amount</TableHead>
              <TableHead className={TH_CLASS}>Status</TableHead>
              <TableHead className={TH_CLASS}>Valid Until</TableHead>
              <TableHead className={`w-40 ${TH_CLASS}`} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {quotations.map((q) => (
              <TableRow
                key={q.id}
                className="border-b border-brand-200 last:border-b-0 hover:bg-brand-50/40"
              >
                <TableCell className="font-semibold text-slate-700 text-base py-1">
                  {q.quotationNumber}
                </TableCell>
                <TableCell className="text-base text-slate-900 py-1">
                  {formatMoney(Number(q.grandTotal), q.currency)}
                </TableCell>
                <TableCell className="text-base py-1">
                  <Badge variant="outline" className="text-xs">
                    {q.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-base text-slate-900 py-1">
                  {q.validUntil ? q.validUntil.slice(0, 10) : "—"}
                </TableCell>
                <TableCell className="text-base py-1">
                  <div className="flex items-center justify-end gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className={VIEW_BTN_CLASS}
                      title="View quotation"
                      onClick={() => router.push(`/crm/quotes/${q.id}`)}
                    >
                      <Eye className="h-3.5 w-3.5" /> View
                    </Button>
                    {canDelete && (
                      <DeleteConfirmDialog
                        trigger={
                          <Button
                            size="sm"
                            variant="outline"
                            className={CRM_DELETE_BTN_CLASS}
                            title="Delete quotation"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Delete
                          </Button>
                        }
                        title="Delete this quotation?"
                        description={`Quotation ${q.quotationNumber} will be moved to the CRM Recycle Bin.`}
                        onConfirm={async () => {
                          await deleteMutation.mutateAsync(q.id);
                        }}
                      />
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </SectionShell>
  );
}
