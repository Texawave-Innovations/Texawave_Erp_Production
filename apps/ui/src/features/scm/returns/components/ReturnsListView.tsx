"use client";

import type {
  ScmReturn,
  ScmReturnStatus,
  ScmReturnType,
} from "@texawave-erp/api-types";
import { ALL_RETURN_STATUSES } from "@texawave-erp/api-types";
import { Button, Select, StatusBadge, useToast } from "@texawave-erp/ui-kit";
import { Plus, RotateCw, Undo2 } from "lucide-react";
import { useState } from "react";
import { usePermission } from "@/hooks/usePermission";
import {
  formatDate,
  formatStatusLabel,
  scmStatusToken,
} from "../../shared/format";
import { ScmDeleteButton, ScmDeleteDialog } from "../../shared/ScmDeleteDialog";
import { ScmListView } from "../../shared/ScmListView";
import { errorText, useListControls } from "../../shared/use-list-controls";
import {
  useCreateCustomerReturn,
  useCreateVendorReturn,
  useDeleteReturn,
  useReturn,
  useReturns,
} from "../hooks";
import { CustomerReturnForm } from "./CustomerReturnForm";
import { ReturnDetailDialog } from "./ReturnDetailDialog";
import { VendorReturnForm } from "./VendorReturnForm";

/** Legacy `ScmReturnsList` / `ScmCustomerReturns` / `ScmVendorReturns` /
 * `ScmReturnInspection` / `ScmReturnDisposition`. `onlyType` scopes the list
 * and the create action to one return type; `presetStatus` locks the status
 * filter for the Inspection/Disposition queue pages (still changeable). */
export function ReturnsListView({
  onlyType,
  presetStatus,
}: {
  onlyType?: ScmReturnType;
  presetStatus?: ScmReturnStatus;
}) {
  const c = useListControls();
  const [status, setStatus] = useState<string>(presetStatus ?? "");
  const [customerFormOpen, setCustomerFormOpen] = useState(false);
  const [vendorFormOpen, setVendorFormOpen] = useState(false);
  const [viewingId, setViewingId] = useState<number | null>(null);
  const { toast } = useToast();
  const canWrite = usePermission("scm.returns.write");
  const deletingRowRemove = useDeleteReturn();
  const [deletingRow, setDeletingRow] = useState<ScmReturn | null>(null);
  const createCustomer = useCreateCustomerReturn();
  const createVendor = useCreateVendorReturn();
  const detail = useReturn(viewingId);
  const query = useReturns({
    page: c.page,
    limit: c.pageSize,
    q: c.q,
    returnType: onlyType,
    status: (status || undefined) as ScmReturnStatus | undefined,
  });

  const title = presetStatus
    ? presetStatus === "INSPECTION_PENDING"
      ? "Return Inspection"
      : "Return Disposition"
    : onlyType === "CUSTOMER_RETURN"
      ? "Customer Returns"
      : onlyType === "VENDOR_RETURN"
        ? "Vendor Returns"
        : "All Returns";

  return (
    <ScmListView<ScmReturn>
      title={title}
      description="Customer and vendor returns — approval, receipt, inspection, disposition and inventory reversal."
      icon={Undo2}
      noun="returns"
      readPermission="scm.returns.read"
      query={query}
      page={c.page}
      pageSize={c.pageSize}
      onPageChange={c.setPage}
      getRowKey={(r) => String(r.id)}
      onRowClick={(r) => setViewingId(r.id)}
      actions={
        canWrite ? (
          <div className="flex gap-2">
            {onlyType !== "VENDOR_RETURN" ? (
              <Button
                size="sm"
                className="gap-2"
                onClick={() => setCustomerFormOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Customer Return
              </Button>
            ) : null}
            {onlyType !== "CUSTOMER_RETURN" ? (
              <Button
                size="sm"
                variant="secondary"
                className="gap-2"
                onClick={() => setVendorFormOpen(true)}
              >
                <RotateCw className="h-4 w-4" />
                Vendor Return
              </Button>
            ) : null}
          </div>
        ) : null
      }
      search={{
        value: c.search,
        onChange: c.setSearch,
        placeholder: "Search by return number, customer, supplier...",
      }}
      filters={
        <div className="w-full lg:w-52">
          <Select
            aria-label="Filter by status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              c.setPage(1);
            }}
          >
            <option value="">All statuses</option>
            {ALL_RETURN_STATUSES.map((s) => (
              <option key={s} value={s}>
                {formatStatusLabel(s)}
              </option>
            ))}
          </Select>
        </div>
      }
      hasActiveFilters={Boolean(c.search || status)}
      onResetFilters={() => {
        c.setSearch("");
        setStatus("");
      }}
      emptyTitle="No returns yet"
      emptyDescription="Create a customer or vendor return to start the process."
      columns={[
        {
          header: "Return #",
          cell: (r) => (
            <span className="font-mono text-theme-xs">{r.returnNumber}</span>
          ),
        },
        ...(onlyType
          ? []
          : [
              {
                header: "Type",
                cell: (r: ScmReturn) => formatStatusLabel(r.returnType),
              },
            ]),
        {
          header: "Party",
          cell: (r) =>
            (r.returnType === "CUSTOMER_RETURN"
              ? r.customerName
              : r.supplierName) ?? "—",
        },
        {
          header: "Source",
          cell: (r) =>
            (r.returnType === "CUSTOMER_RETURN"
              ? r.fulfillmentNumber
              : r.grnNumber) ?? "—",
        },
        { header: "Reason", cell: (r) => formatStatusLabel(r.reasonCode) },
        { header: "Requested", cell: (r) => formatDate(r.requestedDate) },
        { header: "Lines", align: "right", cell: (r) => r.items.length },
        {
          header: "Status",
          cell: (r) => (
            <StatusBadge
              label={formatStatusLabel(r.status)}
              colorToken={scmStatusToken(r.status)}
            />
          ),
        },
        {
          header: "",
          headerClassName: "text-right",
          className: "text-right",
          cell: (r) =>
            canWrite ? (
              <div
                className="flex justify-end"
                onClick={(e) => e.stopPropagation()}
              >
                <ScmDeleteButton
                  label="Delete return"
                  onClick={() => setDeletingRow(r)}
                />
              </div>
            ) : null,
        },
      ]}
    >
      <ScmDeleteDialog<ScmReturn>
        target={deletingRow}
        onClose={() => setDeletingRow(null)}
        title="Delete return?"
        describe={(r) =>
          `Permanently delete ${r.returnNumber}? This cannot be undone. A return that has already moved stock or completed disposition cannot be deleted.`
        }
        confirmText="Delete return"
        run={(r) => deletingRowRemove.mutateAsync(r.id)}
        successMessage="Return deleted"
        errorFallback="Failed to delete return"
      />
      <CustomerReturnForm
        open={customerFormOpen}
        onClose={() => setCustomerFormOpen(false)}
        onSubmit={async (input) => {
          let created: ScmReturn;
          try {
            created = await createCustomer.mutateAsync(input);
          } catch (err) {
            throw new Error(errorText(err, "Failed to create return"));
          }
          toast({
            title: `${created.returnNumber} created`,
            variant: "success",
          });
          setCustomerFormOpen(false);
        }}
      />
      <VendorReturnForm
        open={vendorFormOpen}
        onClose={() => setVendorFormOpen(false)}
        onSubmit={async (input) => {
          let created: ScmReturn;
          try {
            created = await createVendor.mutateAsync(input);
          } catch (err) {
            throw new Error(errorText(err, "Failed to create return"));
          }
          toast({
            title: `${created.returnNumber} created`,
            variant: "success",
          });
          setVendorFormOpen(false);
        }}
      />
      <ReturnDetailDialog
        ret={detail.data ?? null}
        onClose={() => setViewingId(null)}
      />
    </ScmListView>
  );
}
