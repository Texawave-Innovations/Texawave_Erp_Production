"use client";

import type { Shipment } from "@texawave-erp/api-types";
import {
  SHIPMENT_EXCEPTION_CODES,
  SHIPMENT_SERVICE_TYPES,
  SHIPMENT_STATUSES,
} from "@texawave-erp/api-types";
import { Button, Select, StatusBadge, useToast } from "@texawave-erp/ui-kit";
import { Truck } from "lucide-react";
import { useState } from "react";
import { usePermission } from "@/hooks/usePermission";
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatStatusLabel,
  scmStatusToken,
} from "../../shared/format";
import { ScmDetailDialog } from "../../shared/ScmDetailDialog";
import { ScmFormDialog } from "../../shared/ScmFormDialog";
import { ScmListView } from "../../shared/ScmListView";
import { errorText, useListControls } from "../../shared/use-list-controls";
import {
  useCarrierOptions,
  useShipment,
  useShipmentAction,
  useShipments,
} from "../hooks";

type Dlg =
  | "carrier"
  | "label"
  | "transit"
  | "deliver"
  | "exception"
  | "resolve"
  | "fail"
  | "cancel"
  | null;

/** Legacy `ScmShipments`: shipment list with the full lifecycle driven from
 * the detail dialog (carrier -> label -> dispatch -> transit -> delivery). */
export function ShipmentsView() {
  const c = useListControls();
  const [status, setStatus] = useState("");
  const [viewingId, setViewingId] = useState<number | null>(null);
  const [dlg, setDlg] = useState<Dlg>(null);
  const { toast } = useToast();
  const canWrite = usePermission("scm.logistics.write");
  const act = useShipmentAction();
  const carriers = useCarrierOptions();
  const detail = useShipment(viewingId);
  const query = useShipments({
    page: c.page,
    limit: c.pageSize,
    q: c.q,
    status: status || undefined,
  });
  const s = detail.data;

  async function run(
    action: string,
    body: object | undefined,
    ok: string,
    close = true,
  ) {
    if (!s) return;
    try {
      await act.mutateAsync({ id: s.id, action, ...(body ? { body } : {}) });
      toast({ title: ok, variant: "success" });
      if (close) setDlg(null);
    } catch (err) {
      throw new Error(errorText(err, "Action failed"));
    }
  }
  async function quick(action: string, ok: string) {
    try {
      await run(action, undefined, ok, false);
    } catch (err) {
      toast({ title: (err as Error).message, variant: "error" });
    }
  }

  const openException = s?.exceptions.find((e) => !e.resolvedAt);
  const st = s?.status ?? "";
  const buttons =
    !s || !canWrite ? null : (
      <>
        {["READY_TO_SHIP", "CARRIER_ASSIGNED"].includes(st) ? (
          <Button variant="secondary" onClick={() => setDlg("carrier")}>
            {st === "READY_TO_SHIP" ? "Assign Carrier" : "Change Carrier"}
          </Button>
        ) : null}
        {st === "CARRIER_ASSIGNED" ? (
          <Button variant="secondary" onClick={() => setDlg("label")}>
            Create Label
          </Button>
        ) : null}
        {st === "LABEL_CREATED" ? (
          <Button onClick={() => void quick("dispatch", "Shipment dispatched")}>
            Dispatch
          </Button>
        ) : null}
        {[
          "DISPATCHED",
          "IN_TRANSIT",
          "DELIVERY_EXCEPTION",
          "FAILED_DELIVERY",
        ].includes(st) ? (
          <Button variant="secondary" onClick={() => setDlg("transit")}>
            Update Status
          </Button>
        ) : null}
        {["DISPATCHED", "IN_TRANSIT", "OUT_FOR_DELIVERY"].includes(st) ? (
          <Button variant="secondary" onClick={() => setDlg("exception")}>
            Report Exception
          </Button>
        ) : null}
        {openException ? (
          <Button variant="secondary" onClick={() => setDlg("resolve")}>
            Resolve Exception
          </Button>
        ) : null}
        {["OUT_FOR_DELIVERY", "DELIVERY_EXCEPTION"].includes(st) ? (
          <>
            <Button variant="secondary" onClick={() => setDlg("fail")}>
              Failed Delivery
            </Button>
            <Button onClick={() => setDlg("deliver")}>Mark Delivered</Button>
          </>
        ) : null}
        {["READY_TO_SHIP", "CARRIER_ASSIGNED", "LABEL_CREATED"].includes(st) ? (
          <Button variant="secondary" onClick={() => setDlg("cancel")}>
            Cancel Shipment
          </Button>
        ) : null}
      </>
    );

  const reasonField = (label: string) => [
    {
      name: "reason",
      label,
      type: "textarea" as const,
      required: true,
      span: 2 as const,
    },
  ];

  return (
    <ScmListView<Shipment>
      title="Shipments"
      description="Shipments from carrier assignment through delivery."
      icon={Truck}
      noun="shipments"
      readPermission="scm.logistics.read"
      query={query}
      page={c.page}
      pageSize={c.pageSize}
      onPageChange={c.setPage}
      getRowKey={(r) => String(r.id)}
      onRowClick={(r) => setViewingId(r.id)}
      search={{
        value: c.search,
        onChange: c.setSearch,
        placeholder: "Search by shipment, order, customer or tracking...",
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
            {SHIPMENT_STATUSES.map((x) => (
              <option key={x} value={x}>
                {formatStatusLabel(x)}
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
      emptyTitle="No shipments yet"
      emptyDescription="Create a shipment from packed goods on the Deliveries page."
      columns={[
        {
          header: "Shipment #",
          cell: (r) => (
            <span className="font-mono text-theme-xs">{r.shipmentNumber}</span>
          ),
        },
        { header: "Sales Order", cell: (r) => r.salesOrderNumber },
        { header: "Customer", cell: (r) => r.customerName },
        { header: "Carrier", cell: (r) => r.carrierName ?? "—" },
        { header: "Tracking #", cell: (r) => r.trackingNumber ?? "—" },
        { header: "Packages", align: "right", cell: (r) => r.totalPackages },
        { header: "Expected", cell: (r) => formatDate(r.expectedDeliveryDate) },
        {
          header: "Status",
          cell: (r) => (
            <StatusBadge
              label={formatStatusLabel(r.status)}
              colorToken={scmStatusToken(r.status)}
            />
          ),
        },
      ]}
    >
      <ScmDetailDialog
        open={viewingId !== null}
        onClose={() => {
          setViewingId(null);
          setDlg(null);
        }}
        title={s?.shipmentNumber ?? "Shipment"}
        status={s?.status ?? ""}
        footer={buttons}
        fields={[
          ["Sales order", s?.salesOrderNumber],
          ["Fulfillment", s?.fulfillment?.fulfillmentNumber],
          ["Customer", s?.customerName],
          ["Ship to", s?.shippingAddress],
          ["Carrier", s?.carrierName],
          ["Service", s?.serviceType ? formatStatusLabel(s.serviceType) : null],
          ["Tracking #", s?.trackingNumber],
          ["Packages", s?.totalPackages],
          ["Weight", s?.totalWeight],
          [
            "Shipping cost",
            s?.shippingCost ? formatMoney(s.shippingCost) : null,
          ],
          ["Dispatched", formatDateTime(s?.shipmentDate)],
          ["Expected", formatDate(s?.expectedDeliveryDate)],
          ["Delivered", formatDateTime(s?.actualDeliveryDate)],
          ["Recipient", s?.recipientName],
          ["Cancellation reason", s?.cancellationReason],
          [
            "Tracking link",
            s?.trackingUrl ? (
              <a
                href={s.trackingUrl}
                target="_blank"
                rel="noreferrer"
                className="text-brand-700 hover:underline dark:text-brand-300"
              >
                Open
              </a>
            ) : null,
          ],
        ]}
        lineCaption="Tracking timeline"
        lineRows={s?.trackingEvents ?? []}
        getLineKey={(e) => String(e.id)}
        lineColumns={[
          { header: "Time", cell: (e) => formatDateTime(e.eventTime) },
          {
            header: "Status",
            cell: (e) => (
              <StatusBadge
                label={formatStatusLabel(e.status)}
                colorToken={scmStatusToken(e.status)}
              />
            ),
          },
          { header: "Location", cell: (e) => e.location ?? "—" },
          { header: "Details", cell: (e) => e.description ?? "—" },
        ]}
      >
        {s && s.exceptions.length > 0 ? (
          <div className="flex flex-col gap-1 rounded-lg bg-gray-50 p-3 text-theme-sm dark:bg-gray-800/60">
            <span className="font-medium">Exceptions</span>
            {s.exceptions.map((e) => (
              <span key={e.id}>
                {formatStatusLabel(e.exceptionCode)} — {e.description}{" "}
                {e.resolvedAt ? `(resolved: ${e.resolution ?? ""})` : "(open)"}
              </span>
            ))}
          </div>
        ) : null}
      </ScmDetailDialog>

      <ScmFormDialog
        open={dlg === "carrier"}
        onClose={() => setDlg(null)}
        title="Assign Carrier"
        submitLabel="Assign"
        initialValues={
          s?.carrierId
            ? {
                carrierId: String(s.carrierId),
                serviceType: s.serviceType ?? "",
              }
            : {}
        }
        fields={[
          {
            name: "carrierId",
            label: "Carrier",
            type: "select",
            required: true,
            options: (carriers.data ?? []).map((x) => ({
              value: String(x.id),
              label: x.carrierName,
            })),
          },
          {
            name: "serviceType",
            label: "Service type",
            type: "select",
            required: true,
            options: SHIPMENT_SERVICE_TYPES.map((x) => ({
              value: x,
              label: formatStatusLabel(x),
            })),
          },
          {
            name: "expectedDeliveryDate",
            label: "Expected delivery",
            type: "date",
          },
          {
            name: "shippingCost",
            label: "Shipping cost",
            type: "number",
            min: 0,
            step: 0.01,
          },
        ]}
        onSubmit={(v) =>
          run(
            "carrier",
            { ...v, carrierId: Number(v.carrierId) },
            "Carrier assigned",
          )
        }
      />
      <ScmFormDialog
        open={dlg === "label"}
        onClose={() => setDlg(null)}
        title="Create Shipping Label"
        submitLabel="Create Label"
        fields={[
          {
            name: "trackingNumber",
            label: "Tracking number",
            type: "text",
            required: true,
            span: 2,
          },
        ]}
        onSubmit={(v) => run("label", v, "Label created")}
      />
      <ScmFormDialog
        open={dlg === "transit"}
        onClose={() => setDlg(null)}
        title="Update Shipment Status"
        submitLabel="Update"
        fields={[
          {
            name: "status",
            label: "New status",
            type: "select",
            required: true,
            options: [
              { value: "IN_TRANSIT", label: "In transit" },
              { value: "OUT_FOR_DELIVERY", label: "Out for delivery" },
            ],
          },
          { name: "location", label: "Location", type: "text" },
          { name: "description", label: "Details", type: "textarea", span: 2 },
        ]}
        onSubmit={(v) => run("status", v, "Status updated")}
      />
      <ScmFormDialog
        open={dlg === "deliver"}
        onClose={() => setDlg(null)}
        title="Mark Delivered"
        submitLabel="Confirm Delivery"
        fields={[
          { name: "recipientName", label: "Received by", type: "text" },
          {
            name: "proofOfDeliveryUrl",
            label: "Proof of delivery URL",
            type: "text",
          },
          { name: "deliveryNotes", label: "Notes", type: "textarea", span: 2 },
        ]}
        onSubmit={(v) => run("deliver", v, "Shipment delivered")}
      />
      <ScmFormDialog
        open={dlg === "exception"}
        onClose={() => setDlg(null)}
        title="Report Delivery Exception"
        submitLabel="Report"
        fields={[
          {
            name: "exceptionCode",
            label: "Exception",
            type: "select",
            required: true,
            options: SHIPMENT_EXCEPTION_CODES.map((x) => ({
              value: x,
              label: formatStatusLabel(x),
            })),
          },
          {
            name: "description",
            label: "Description",
            type: "textarea",
            required: true,
            span: 2,
          },
        ]}
        onSubmit={(v) => run("exception", v, "Exception recorded")}
      />
      <ScmFormDialog
        open={dlg === "resolve"}
        onClose={() => setDlg(null)}
        title="Resolve Exception"
        submitLabel="Resolve"
        fields={[
          {
            name: "resolution",
            label: "Resolution",
            type: "textarea",
            required: true,
            span: 2,
          },
        ]}
        onSubmit={(v) =>
          run(
            `exceptions/${openException?.id ?? 0}/resolve`,
            v,
            "Exception resolved",
          )
        }
      />
      <ScmFormDialog
        open={dlg === "fail"}
        onClose={() => setDlg(null)}
        title="Failed Delivery"
        submitLabel="Mark Failed"
        fields={reasonField("Reason")}
        onSubmit={(v) => run("fail", v, "Marked as failed delivery")}
      />
      <ScmFormDialog
        open={dlg === "cancel"}
        onClose={() => setDlg(null)}
        title="Cancel Shipment"
        description="Packings become available to ship again."
        submitLabel="Cancel Shipment"
        fields={reasonField("Reason")}
        onSubmit={(v) => run("cancel", v, "Shipment cancelled")}
      />
    </ScmListView>
  );
}
