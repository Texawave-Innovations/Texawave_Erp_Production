"use client";

import type {
  Carrier,
  ShippableFulfillment,
  ShipmentTrackingEvent,
} from "@texawave-erp/api-types";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  DataTable,
  ErrorState,
  PageHeader,
  Skeleton,
  StatusBadge,
  useToast,
} from "@texawave-erp/ui-kit";
import {
  AlertTriangle,
  ClipboardCheck,
  MapPin,
  PackageCheck,
  Plus,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { usePermission } from "@/hooks/usePermission";
import { useMasterListItems } from "../../master-list-items/hooks";
import {
  formatDateTime,
  formatStatusLabel,
  scmStatusToken,
} from "../../shared/format";
import { ScmFormDialog } from "../../shared/ScmFormDialog";
import { ScmDashboardPage } from "../../shared/ScmDashboardPage";
import { ScmDeleteButton, ScmDeleteDialog } from "../../shared/ScmDeleteDialog";
import { ScmListView } from "../../shared/ScmListView";
import { errorText, useListControls } from "../../shared/use-list-controls";
import {
  useCarriers,
  useCreateShipment,
  useDeleteCarrier,
  useSaveCarrier,
  useShipments,
  useShippable,
  useTrackingEvents,
} from "../hooks";

/** Legacy `ScmLogisticsDashboard`: shipment pipeline counts with links. */
export function LogisticsDashboardView() {
  const shipments = useShipments({ page: 1, limit: 100 });
  const shippable = useShippable();

  if (shipments.isPending || shippable.isPending)
    return <Skeleton className="h-64 w-full" />;
  if (shipments.isError || shippable.isError) {
    const err = shipments.error ?? shippable.error;
    if (err instanceof ApiError && err.isPermissionError) {
      return (
        <Alert variant="warning" title="You don't have access to logistics">
          Ask an administrator for the <code>scm.logistics.read</code>{" "}
          permission.
        </Alert>
      );
    }
    return (
      <ErrorState
        onRetry={() => {
          void shipments.refetch();
          void shippable.refetch();
        }}
      />
    );
  }

  const rows = shipments.data.data;
  const count = (...s: string[]) =>
    rows.filter((r) => s.includes(r.status)).length;
  const readyToShip = shippable.data.filter(
    (f) => f.blockers.length === 0 && f.unshippedPackings.length > 0,
  ).length;
  const cards = [
    {
      id: "ready",
      label: "Awaiting Shipment",
      value: readyToShip,
      note: "Packed, no shipment yet",
      href: "/scm/logistics/deliveries",
      tone: "warning" as const,
    },
    {
      id: "pre",
      label: "Preparing",
      value: count("READY_TO_SHIP", "CARRIER_ASSIGNED", "LABEL_CREATED"),
      note: "Carrier / label pending",
      href: "/scm/logistics/shipments",
      tone: "brand" as const,
    },
    {
      id: "transit",
      label: "In Transit",
      value: count("DISPATCHED", "IN_TRANSIT", "OUT_FOR_DELIVERY"),
      note: "With the carrier",
      href: "/scm/logistics/shipments",
      tone: "blue" as const,
    },
    {
      id: "exc",
      label: "Exceptions",
      value: count("DELIVERY_EXCEPTION", "FAILED_DELIVERY"),
      note: "Need attention",
      href: "/scm/logistics/shipments",
      tone: "warning" as const,
    },
    {
      id: "done",
      label: "Delivered",
      value: count("DELIVERED"),
      note: "Completed",
      href: "/scm/logistics/shipments",
      tone: "success" as const,
    },
  ];

  const icons: Record<string, LucideIcon> = {
    ready: PackageCheck,
    pre: ClipboardCheck,
    transit: Truck,
    exc: AlertTriangle,
    done: PackageCheck,
  };
  return (
    <ScmDashboardPage
      title="Logistics Dashboard"
      subtitle="Shipments from packing through carrier handover to delivery."
      kpis={cards.map((c) => ({
        id: c.id,
        label: c.label,
        value: c.value,
        href: c.href,
        note: c.note,
        icon: icons[c.id] ?? Truck,
      }))}
      actions={[
        {
          label: "Create Shipment",
          icon: Plus,
          href: "/scm/logistics/deliveries",
        },
        { label: "Shipments", icon: Truck, href: "/scm/logistics/shipments" },
        { label: "Tracking", icon: MapPin, href: "/scm/logistics/tracking" },
        { label: "Carriers", icon: Users, href: "/scm/logistics/carriers" },
      ]}
      activityEmpty="No shipments yet."
      activity={rows.slice(0, 8).map((r) => ({
        key: String(r.id),
        type: "Shipment",
        label: r.shipmentNumber,
        status: r.status,
        at: r.createdAt,
      }))}
    />
  );
}

/** Legacy `ScmDeliveries`: fulfillments with packed goods ready to ship. */
export function DeliveriesView() {
  const query = useShippable();
  const create = useCreateShipment();
  const { toast } = useToast();
  const canWrite = usePermission("scm.logistics.write");
  const [busy, setBusy] = useState<number | null>(null);

  async function ship(f: ShippableFulfillment) {
    setBusy(f.id);
    try {
      const s = await create.mutateAsync({
        fulfillmentId: f.id,
        packingIds: f.unshippedPackings.map((p) => p.id),
      });
      toast({ title: `${s.shipmentNumber} created`, variant: "success" });
    } catch (err) {
      toast({
        title: errorText(err, "Failed to create shipment"),
        variant: "error",
      });
    } finally {
      setBusy(null);
    }
  }

  if (query.isPending) return <Skeleton className="h-64 w-full" />;
  if (query.isError) {
    if (query.error instanceof ApiError && query.error.isPermissionError) {
      return (
        <Alert variant="warning" title="You don't have access to deliveries">
          Ask an administrator for the <code>scm.logistics.read</code>{" "}
          permission.
        </Alert>
      );
    }
    return <ErrorState onRetry={() => void query.refetch()} />;
  }
  const rows = query.data.filter((f) => f.unshippedPackings.length > 0);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        variant="banner"
        icon={Truck}
        title="Deliveries"
        description="Packed fulfillments that still need a shipment."
        badge={
          <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-[#0a3271] dark:bg-gray-800/70 dark:text-sky-100">
            {rows.length} awaiting shipment
          </span>
        }
      />
      {rows.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-theme-sm text-gray-500 dark:border-gray-800 dark:bg-gray-dark">
          Nothing is waiting to ship. Pack and issue a fulfillment first.
        </div>
      ) : (
        <DataTable<ShippableFulfillment>
          caption="Deliveries"
          rows={rows}
          getRowKey={(r) => String(r.id)}
          columns={[
            { header: "Fulfillment", cell: (r) => r.fulfillmentNumber },
            { header: "Sales Order", cell: (r) => r.salesOrderNumber },
            { header: "Customer", cell: (r) => r.customerName },
            {
              header: "Packings",
              cell: (r) =>
                r.unshippedPackings.map((p) => p.packNumber).join(", "),
            },
            {
              header: "Packages",
              align: "right",
              cell: (r) =>
                r.unshippedPackings.reduce((s, p) => s + p.packages, 0),
            },
            {
              header: "Status",
              cell: (r) =>
                r.blockers.length ? (
                  <span className="text-theme-xs text-warning-600">
                    {r.blockers.join("; ")}
                  </span>
                ) : (
                  <StatusBadge label="Ready" colorToken="success" />
                ),
            },
            {
              header: "Actions",
              headerClassName: "text-right",
              className: "text-right",
              cell: (r) =>
                canWrite ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={r.blockers.length > 0 || busy === r.id}
                    onClick={() => void ship(r)}
                  >
                    Create Shipment
                  </Button>
                ) : null,
            },
          ]}
        />
      )}
    </div>
  );
}

/** Legacy `ScmCarriers`. */
export function CarriersView() {
  const c = useListControls();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Carrier | null>(null);
  const { toast } = useToast();
  const canWrite = usePermission("scm.logistics.write");
  const deletingRowRemove = useDeleteCarrier();
  const [deletingRow, setDeletingRow] = useState<Carrier | null>(null);
  const save = useSaveCarrier();
  const query = useCarriers({ page: c.page, limit: c.pageSize, q: c.q });
  const serviceTypes = useMasterListItems({
    category: "shipment_service_type",
    page: 1,
    limit: 100,
  });
  const serviceTypeOptions = serviceTypes.data?.data ?? [];

  return (
    <ScmListView<Carrier>
      title="Carriers"
      description="Shipping carriers and the services they offer."
      icon={Users}
      noun="carriers"
      readPermission="scm.logistics.read"
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
            Add Carrier
          </Button>
        ) : null
      }
      search={{
        value: c.search,
        onChange: c.setSearch,
        placeholder: "Search by carrier name or code...",
      }}
      hasActiveFilters={Boolean(c.search)}
      onResetFilters={() => c.setSearch("")}
      emptyTitle="No carriers yet"
      emptyDescription="Add a carrier before assigning shipments."
      columns={[
        {
          header: "Code",
          cell: (r) => (
            <span className="font-mono text-theme-xs">{r.carrierCode}</span>
          ),
        },
        { header: "Name", cell: (r) => r.carrierName },
        {
          header: "Services",
          cell: (r) =>
            r.serviceTypes.map((s) => formatStatusLabel(s)).join(", ") || "—",
        },
        { header: "Contact", cell: (r) => r.contact ?? r.phone ?? "—" },
        {
          header: "Shipments",
          align: "right",
          cell: (r) => r._count?.shipments ?? 0,
        },
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
                  label="Delete carrier"
                  onClick={() => setDeletingRow(r)}
                />
              </div>
            ) : null,
        },
      ]}
    >
      <ScmDeleteDialog<Carrier>
        target={deletingRow}
        onClose={() => setDeletingRow(null)}
        title="Delete carrier?"
        describe={(r) =>
          `Delete carrier ${r.carrierName} (${r.carrierCode})? This cannot be undone. Blocked automatically if shipments exist for this carrier.`
        }
        confirmText="Delete carrier"
        run={(r) => deletingRowRemove.mutateAsync(r.id)}
        successMessage="Carrier deleted"
        errorFallback="Failed to delete carrier"
      />
      <ScmFormDialog
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        title={editing ? `Edit ${editing.carrierName}` : "Add Carrier"}
        submitLabel={editing ? "Save Changes" : "Add Carrier"}
        initialValues={
          editing
            ? {
                carrierCode: editing.carrierCode,
                carrierName: editing.carrierName,
                services: editing.serviceTypes.join(","),
                contact: editing.contact ?? "",
                phone: editing.phone ?? "",
                email: editing.email ?? "",
                website: editing.website ?? "",
                trackingUrlTemplate: editing.trackingUrlTemplate ?? "",
                status: editing.status,
                notes: editing.notes ?? "",
              }
            : { status: "ACTIVE" }
        }
        fields={[
          {
            name: "carrierCode",
            label: "Carrier code",
            type: "text",
            required: true,
            upper: true,
            mono: true,
          },
          {
            name: "carrierName",
            label: "Carrier name",
            type: "text",
            required: true,
          },
          {
            name: "services",
            label: "Service types",
            type: "text",
            placeholder: serviceTypeOptions.map((x) => x.value).join(", "),
            hint: "Comma separated. Add new service types under Settings → Masters → SCM Master.",
            span: 2,
          },
          { name: "contact", label: "Contact", type: "text" },
          { name: "phone", label: "Phone", type: "text" },
          { name: "email", label: "Email", type: "text" },
          { name: "website", label: "Website", type: "text" },
          {
            name: "trackingUrlTemplate",
            label: "Tracking URL template",
            type: "text",
            placeholder: "https://track.example.com/{trackingNumber}",
            span: 2,
          },
          {
            name: "status",
            label: "Status",
            type: "select",
            options: [
              { value: "ACTIVE", label: "Active" },
              { value: "INACTIVE", label: "Inactive" },
            ],
          },
          { name: "notes", label: "Notes", type: "textarea", span: 2 },
        ]}
        onSubmit={async (v) => {
          const { services, ...rest } = v;
          const serviceTypes = String(services ?? "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
          const input = { ...rest, serviceTypes };
          try {
            await save.mutateAsync({
              ...(editing ? { id: editing.id } : {}),
              input,
            });
          } catch (err) {
            throw new Error(errorText(err, "Failed to save carrier"));
          }
          toast({
            title: editing ? "Carrier updated" : "Carrier added",
            variant: "success",
          });
          setFormOpen(false);
          setEditing(null);
        }}
      />
    </ScmListView>
  );
}

/** Legacy `ScmTracking`: the append-only shipment tracking timeline. */
export function TrackingView() {
  const c = useListControls(20);
  const query = useTrackingEvents({ page: c.page, limit: c.pageSize, q: c.q });
  return (
    <ScmListView<ShipmentTrackingEvent>
      title="Tracking"
      description="Every status change recorded against a shipment, newest first."
      icon={Truck}
      noun="tracking events"
      readPermission="scm.logistics.read"
      query={query}
      page={c.page}
      pageSize={c.pageSize}
      onPageChange={c.setPage}
      getRowKey={(r) => String(r.id)}
      search={{
        value: c.search,
        onChange: c.setSearch,
        placeholder: "Search by shipment or tracking number...",
      }}
      hasActiveFilters={Boolean(c.search)}
      onResetFilters={() => c.setSearch("")}
      emptyTitle="No tracking events yet"
      emptyDescription="Events appear as shipments are created and move."
      columns={[
        { header: "Time", cell: (r) => formatDateTime(r.eventTime) },
        {
          header: "Shipment",
          cell: (r) => (
            <span className="font-mono text-theme-xs">
              {r.shipment?.shipmentNumber ?? "—"}
            </span>
          ),
        },
        {
          header: "Tracking #",
          cell: (r) => r.shipment?.trackingNumber ?? "—",
        },
        {
          header: "Status",
          cell: (r) => (
            <StatusBadge
              label={formatStatusLabel(r.status)}
              colorToken={scmStatusToken(r.status)}
            />
          ),
        },
        { header: "Location", cell: (r) => r.location ?? "—" },
        { header: "Details", cell: (r) => r.description ?? "—" },
      ]}
    />
  );
}
