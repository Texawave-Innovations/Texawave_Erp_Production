"use client";

import type { ScmCustomer, ScmCustomerPayload } from "@texawave-erp/api-types";
import { Button, StatusBadge, useToast } from "@texawave-erp/ui-kit";
import { Plus, Users } from "lucide-react";
import { useState } from "react";
import { usePermission } from "@/hooks/usePermission";
import { scmStatusToken } from "../../shared/format";
import { ScmFormDialog } from "../../shared/ScmFormDialog";
import { ScmListView } from "../../shared/ScmListView";
import { errorText, useListControls } from "../../shared/use-list-controls";
import { useCreateCustomer, useCustomers, useUpdateCustomer } from "../hooks";

/** Minimal customer master backing sales orders (the new ERP has no Sales
 * module yet; legacy read these from a global customer store). */
export function CustomersView() {
  const c = useListControls();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ScmCustomer | null>(null);
  const { toast } = useToast();
  const canWrite = usePermission("scm.sales.write");
  const create = useCreateCustomer();
  const update = useUpdateCustomer();
  const query = useCustomers({ page: c.page, limit: c.pageSize, q: c.q });

  return (
    <ScmListView<ScmCustomer>
      title="Customers"
      description="Customers that sales orders are raised against."
      icon={Users}
      noun="customers"
      readPermission="scm.sales.read"
      query={query}
      page={c.page}
      pageSize={c.pageSize}
      onPageChange={c.setPage}
      getRowKey={(r) => String(r.id)}
      onRowClick={(r) => {
        if (canWrite) {
          setEditing(r);
          setFormOpen(true);
        }
      }}
      actions={
        canWrite ? (
          <Button
            size="sm"
            className="gap-2"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Add Customer
          </Button>
        ) : null
      }
      search={{
        value: c.search,
        onChange: c.setSearch,
        placeholder: "Search by name, code, email...",
      }}
      hasActiveFilters={Boolean(c.search)}
      onResetFilters={() => c.setSearch("")}
      emptyTitle="No customers yet"
      emptyDescription="Add a customer before creating sales orders."
      columns={[
        {
          header: "Code",
          cell: (r) => (
            <span className="font-mono text-theme-xs">{r.customerCode}</span>
          ),
        },
        { header: "Name", cell: (r) => r.name },
        { header: "Contact", cell: (r) => r.contactPerson ?? "—" },
        { header: "Email", cell: (r) => r.email ?? "—" },
        { header: "Phone", cell: (r) => r.phone ?? "—" },
        { header: "GSTIN", cell: (r) => r.gstin ?? "—" },
        {
          header: "Status",
          cell: (r) => (
            <StatusBadge
              label={r.status}
              colorToken={scmStatusToken(r.status)}
            />
          ),
        },
      ]}
    >
      <ScmFormDialog
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        title={editing ? `Edit ${editing.name}` : "Add Customer"}
        submitLabel={editing ? "Save Changes" : "Add Customer"}
        initialValues={
          editing
            ? {
                customerCode: editing.customerCode,
                name: editing.name,
                contactPerson: editing.contactPerson ?? "",
                email: editing.email ?? "",
                phone: editing.phone ?? "",
                gstin: editing.gstin ?? "",
                billingAddress: editing.billingAddress ?? "",
                shippingAddress: editing.shippingAddress ?? "",
                status: editing.status,
              }
            : { status: "Active" }
        }
        fields={[
          {
            name: "customerCode",
            label: "Customer code",
            type: "text",
            upper: true,
            mono: true,
            hint: "Leave blank to auto-generate",
          },
          { name: "name", label: "Name", type: "text", required: true },
          { name: "contactPerson", label: "Contact person", type: "text" },
          { name: "email", label: "Email", type: "text" },
          { name: "phone", label: "Phone", type: "text" },
          { name: "gstin", label: "GSTIN", type: "text", upper: true },
          {
            name: "status",
            label: "Status",
            type: "select",
            options: [
              { value: "Active", label: "Active" },
              { value: "Inactive", label: "Inactive" },
            ],
          },
          {
            name: "billingAddress",
            label: "Billing address",
            type: "textarea",
            span: 2,
          },
          {
            name: "shippingAddress",
            label: "Shipping address",
            type: "textarea",
            span: 2,
          },
        ]}
        onSubmit={async (v) => {
          const input = v as unknown as ScmCustomerPayload;
          try {
            if (editing) await update.mutateAsync({ id: editing.id, input });
            else await create.mutateAsync(input);
          } catch (err) {
            throw new Error(errorText(err, "Failed to save customer"));
          }
          toast({
            title: editing ? "Customer updated" : "Customer added",
            variant: "success",
          });
          setFormOpen(false);
          setEditing(null);
        }}
      />
    </ScmListView>
  );
}
