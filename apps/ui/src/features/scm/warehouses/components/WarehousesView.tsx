"use client";

import type { ScmWarehouse } from "@texawave-erp/api-types";
import { Button, Select, StatusBadge, useToast } from "@texawave-erp/ui-kit";
import { Building2, Pencil, Plus, Power, Tag } from "lucide-react";
import { useState } from "react";
import { usePermission } from "@/hooks/usePermission";
import { buildQrPayload } from "../../barcode/codes";
import { LabelDialog } from "../../barcode/LabelDialog";
import type { BarcodeLabelProps } from "../../barcode/BarcodeLabel";
import { formatQty } from "../../shared/format";
import { useMasterListItems } from "../../master-list-items/hooks";
import { ScmFormDialog, type ScmFormValues } from "../../shared/ScmFormDialog";
import { ScmDeleteButton, ScmDeleteDialog } from "../../shared/ScmDeleteDialog";
import { ScmListView } from "../../shared/ScmListView";
import { errorText, useListControls } from "../../shared/use-list-controls";
import {
  useCreateWarehouse,
  useDeleteWarehouse,
  useUpdateWarehouse,
  useWarehouses,
} from "../hooks";

function toForm(w: ScmWarehouse): Partial<ScmFormValues> {
  return {
    code: w.code,
    name: w.name,
    type: w.type,
    status: w.status,
    address: w.address ?? "",
    city: w.city ?? "",
    state: w.state ?? "",
    country: w.country ?? "",
    postalCode: w.postalCode ?? "",
    managerName: w.managerName ?? "",
    contactPerson: w.contactPerson ?? "",
    phone: w.phone ?? "",
    email: w.email ?? "",
    capacity: w.capacity === null ? "" : Number(w.capacity),
    capacityUnit: w.capacityUnit ?? "",
    operatingHours: w.operatingHours ?? "",
    notes: w.notes ?? "",
  };
}

/** Legacy `ScmWarehouses` + `ScmWarehouseFormDialog`: warehouse master. */
export function WarehousesView() {
  const c = useListControls();
  const [status, setStatus] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ScmWarehouse | null>(null);
  const { toast } = useToast();
  const canWrite = usePermission("scm.warehouse.write");
  const deletingRowRemove = useDeleteWarehouse();
  const [deletingRow, setDeletingRow] = useState<ScmWarehouse | null>(null);
  const create = useCreateWarehouse();
  const update = useUpdateWarehouse();
  const [label, setLabel] = useState<BarcodeLabelProps | null>(null);
  const warehouseTypes = useMasterListItems({
    category: "warehouse_type",
    page: 1,
    limit: 100,
  });
  const warehouseTypeOptions = (warehouseTypes.data?.data ?? []).map((i) => ({
    value: i.value,
    label: i.value,
  }));

  function showQrLabel(w: Pick<ScmWarehouse, "id" | "code" | "name">) {
    setLabel({
      format: "QR",
      value: buildQrPayload("WAREHOUSE", w.code, w.id),
      title: w.name,
      subtitle: w.code,
    });
  }

  const query = useWarehouses({
    page: c.page,
    limit: c.pageSize,
    q: c.q,
    status: status === "" ? undefined : (status as "Active" | "Inactive"),
  });

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
  }

  async function toggle(w: ScmWarehouse) {
    const next = w.status === "Active" ? "Inactive" : "Active";
    try {
      await update.mutateAsync({ id: w.id, input: { status: next } });
      toast({ title: `Warehouse marked ${next}`, variant: "success" });
    } catch (err) {
      toast({
        title: errorText(err, "Failed to update warehouse status"),
        variant: "error",
      });
    }
  }

  return (
    <ScmListView<ScmWarehouse>
      title="Warehouses"
      description="Warehouse master records, contacts and capacity."
      icon={Building2}
      noun="warehouses"
      readPermission="scm.warehouse.read"
      query={query}
      page={c.page}
      pageSize={c.pageSize}
      onPageChange={c.setPage}
      getRowKey={(w) => String(w.id)}
      actions={
        canWrite ? (
          <Button size="sm" className="gap-2" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Warehouse
          </Button>
        ) : null
      }
      search={{
        value: c.search,
        onChange: c.setSearch,
        placeholder: "Search by code, name or city...",
      }}
      filters={
        <div className="w-full sm:w-44">
          <Select
            aria-label="Filter by status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              c.setPage(1);
            }}
          >
            <option value="">All statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </Select>
        </div>
      }
      hasActiveFilters={Boolean(c.search || status)}
      onResetFilters={() => {
        c.setSearch("");
        setStatus("");
      }}
      emptyTitle="No warehouses yet"
      emptyDescription="Add a warehouse to start holding stock."
      columns={[
        {
          header: "Code",
          cell: (w) => (
            <span className="font-mono text-theme-xs">{w.code}</span>
          ),
        },
        {
          header: "Name",
          cell: (w) => <span className="font-semibold">{w.name}</span>,
        },
        { header: "Type", cell: (w) => w.type },
        { header: "City", cell: (w) => w.city ?? "—" },
        { header: "Manager", cell: (w) => w.managerName ?? "—" },
        {
          header: "Capacity",
          align: "right",
          cell: (w) =>
            w.capacity
              ? `${formatQty(w.capacity)} ${w.capacityUnit ?? ""}`
              : "—",
        },
        {
          header: "Status",
          cell: (w) => (
            <StatusBadge
              label={w.status}
              colorToken={w.status === "Active" ? "success" : "gray"}
            />
          ),
        },
        {
          header: "Actions",
          headerClassName: "text-right",
          className: "text-right",
          cell: (w) =>
            canWrite ? (
              <div className="flex justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  title="QR label"
                  aria-label={`QR label for ${w.name}`}
                  onClick={() => showQrLabel(w)}
                >
                  <Tag className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Edit ${w.name}`}
                  onClick={() => {
                    setEditing(w);
                    setFormOpen(true);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`${w.status === "Active" ? "Deactivate" : "Activate"} ${w.name}`}
                  title={w.status === "Active" ? "Deactivate" : "Activate"}
                  onClick={() => void toggle(w)}
                >
                  <Power
                    className={`h-4 w-4 ${w.status === "Active" ? "text-success-600" : "text-gray-400"}`}
                  />
                </Button>
              </div>
            ) : null,
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
                  label="Delete warehouse"
                  onClick={() => setDeletingRow(r)}
                />
              </div>
            ) : null,
        },
      ]}
    >
      <ScmDeleteDialog<ScmWarehouse>
        target={deletingRow}
        onClose={() => setDeletingRow(null)}
        title="Delete warehouse?"
        describe={(r) =>
          `Delete warehouse ${r.name} (${r.code})? This cannot be undone. Blocked automatically while it holds stock or any receipts, orders, shipments, inspections or returns reference it; its empty locations are removed with it.`
        }
        confirmText="Delete warehouse"
        run={(r) => deletingRowRemove.mutateAsync(r.id)}
        successMessage="Warehouse deleted"
        errorFallback="Failed to delete warehouse"
      />
      <ScmFormDialog
        open={formOpen}
        onClose={closeForm}
        size="2xl"
        title={editing ? "Edit Warehouse" : "Add Warehouse"}
        submitLabel={editing ? "Save Changes" : "Create Warehouse"}
        initialValues={
          editing
            ? toForm(editing)
            : { type: "Main", status: "Active", country: "India" }
        }
        fields={[
          {
            name: "code",
            label: "Code",
            type: "text",
            required: true,
            upper: true,
            mono: true,
          },
          { name: "name", label: "Name", type: "text", required: true },
          {
            name: "type",
            label: "Type",
            type: "select",
            required: true,
            options: warehouseTypeOptions,
          },
          {
            name: "status",
            label: "Status",
            type: "select",
            required: true,
            options: [
              { value: "Active", label: "Active" },
              { value: "Inactive", label: "Inactive" },
            ],
          },
          { name: "address", label: "Address", type: "text", span: 2 },
          { name: "city", label: "City", type: "text" },
          { name: "state", label: "State", type: "text" },
          { name: "country", label: "Country", type: "text" },
          { name: "postalCode", label: "Postal Code", type: "text" },
          { name: "managerName", label: "Manager", type: "text" },
          { name: "contactPerson", label: "Contact Person", type: "text" },
          { name: "phone", label: "Phone", type: "text" },
          { name: "email", label: "Email", type: "text" },
          { name: "capacity", label: "Capacity", type: "number", min: 0 },
          {
            name: "capacityUnit",
            label: "Capacity Unit",
            type: "text",
            placeholder: "e.g. sq ft, pallets",
          },
          {
            name: "operatingHours",
            label: "Operating Hours",
            type: "text",
            span: 2,
          },
          { name: "notes", label: "Notes", type: "textarea", span: 2 },
        ]}
        onSubmit={async (v) => {
          const str = (k: string) => (v[k] as string | undefined) ?? "";
          const input = {
            code: str("code"),
            name: str("name"),
            type: v.type as string,
            status: v.status as "Active" | "Inactive",
            address: str("address"),
            city: str("city"),
            state: str("state"),
            country: str("country"),
            postalCode: str("postalCode"),
            managerName: str("managerName"),
            contactPerson: str("contactPerson"),
            phone: str("phone"),
            email: str("email"),
            capacity: v.capacity as number | undefined,
            capacityUnit: str("capacityUnit"),
            operatingHours: str("operatingHours"),
            notes: str("notes"),
          };
          let created: ScmWarehouse | undefined;
          try {
            if (editing) await update.mutateAsync({ id: editing.id, input });
            else created = await create.mutateAsync(input);
          } catch (err) {
            throw new Error(errorText(err, "Failed to save warehouse"));
          }
          toast({
            title: editing ? "Warehouse updated" : "Warehouse created",
            variant: "success",
          });
          closeForm();
          if (created) showQrLabel(created);
        }}
      />
      <LabelDialog
        open={label !== null}
        onClose={() => setLabel(null)}
        dialogTitle="Warehouse QR Label"
        label={label}
      />
    </ScmListView>
  );
}
