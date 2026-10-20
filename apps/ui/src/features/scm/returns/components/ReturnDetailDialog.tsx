"use client";

import type { ScmReturn, ScmReturnItem } from "@texawave-erp/api-types";
import {
  RETURN_CONDITIONS,
  RETURN_DISPOSITIONS,
} from "@texawave-erp/api-types";
import {
  Button,
  DataTable,
  Dialog,
  Input,
  Select,
  StatusBadge,
  Textarea,
} from "@texawave-erp/ui-kit";
import { useState } from "react";
import { usePermission } from "@/hooks/usePermission";
import {
  formatDate,
  formatQty,
  formatStatusLabel,
  scmStatusToken,
} from "../../shared/format";
import { errorText } from "../../shared/use-list-controls";
import {
  useDispositionReturn,
  useInspectReturn,
  useReceiveReturn,
  useReturnAction,
  useShipVendorReturn,
} from "../hooks";

type Dlg =
  | "reject"
  | "cancel"
  | "in-transit"
  | "receive"
  | "inspect"
  | "disposition"
  | "ship"
  | null;

const FIELD_ROW = "flex flex-col";
const FIELD_LABEL =
  "text-theme-xs uppercase tracking-wide text-gray-500 dark:text-gray-400";
const FIELD_VALUE = "text-theme-sm text-gray-900 dark:text-white/90";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className={FIELD_ROW}>
      <span className={FIELD_LABEL}>{label}</span>
      <span className={FIELD_VALUE}>{value ?? "—"}</span>
    </div>
  );
}

/** Legacy `ScmReturnDetail`. The detail view and its action dialogs are
 * siblings (never nested `<dialog>` elements — the native dialog's top-layer
 * stacking breaks when one is rendered inside another's open content), the
 * same shape `ShipmentsView` uses for its carrier/label/exception flow. */
export function ReturnDetailDialog({
  ret,
  onClose,
}: {
  ret: ScmReturn | null;
  onClose: () => void;
}) {
  const [dlg, setDlg] = useState<Dlg>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canWrite = usePermission("scm.returns.write");
  const canApprove = usePermission("scm.returns.approve");
  const act = useReturnAction();
  const receive = useReceiveReturn();
  const inspect = useInspectReturn();
  const disposition = useDispositionReturn();
  const ship = useShipVendorReturn();

  function closeAll() {
    setDlg(null);
    onClose();
  }

  async function run(action: Parameters<typeof act.mutateAsync>[0]["action"]) {
    if (!ret) return;
    setErr(null);
    setBusy(true);
    try {
      await act.mutateAsync({ id: ret.id, action });
    } catch (e) {
      setErr(errorText(e, "Action failed"));
    } finally {
      setBusy(false);
    }
  }

  const isCustomer = ret?.returnType === "CUSTOMER_RETURN";
  const openStatus = ret
    ? !["COMPLETED", "CANCELLED", "REJECTED"].includes(ret.status)
    : false;

  const buttons: React.ReactNode[] = [];
  if (ret && canWrite && openStatus) {
    if (ret.status === "REQUESTED") {
      buttons.push(
        <Button
          key="submit"
          variant="secondary"
          onClick={() => void run("submit")}
        >
          Submit
        </Button>,
      );
    }
    if (ret.status === "PENDING_APPROVAL" && canApprove) {
      buttons.push(
        <Button
          key="approve"
          variant="secondary"
          onClick={() => void run("approve")}
        >
          Approve
        </Button>,
        <Button
          key="reject"
          variant="secondary"
          onClick={() => setDlg("reject")}
        >
          Reject
        </Button>,
      );
    }
    if (ret.status === "APPROVED" && isCustomer) {
      buttons.push(
        <Button
          key="transit"
          variant="secondary"
          onClick={() => setDlg("in-transit")}
        >
          Mark In Transit
        </Button>,
      );
    }
    if (ret.status === "APPROVED" && !isCustomer) {
      buttons.push(
        <Button
          key="rts"
          variant="secondary"
          onClick={() => void run("ready-to-ship")}
        >
          Ready to Ship
        </Button>,
      );
    }
    if (ret.status === "IN_TRANSIT") {
      buttons.push(
        <Button
          key="receive"
          variant="secondary"
          onClick={() => setDlg("receive")}
        >
          Receive
        </Button>,
      );
    }
    if (ret.status === "RECEIVED") {
      buttons.push(
        <Button
          key="start"
          variant="secondary"
          onClick={() => void run("start-inspection")}
        >
          Start Inspection
        </Button>,
      );
    }
    if (ret.status === "INSPECTION_PENDING") {
      buttons.push(
        <Button key="inspect" onClick={() => setDlg("inspect")}>
          Record Inspection
        </Button>,
      );
    }
    if (ret.status === "INSPECTED") {
      buttons.push(
        <Button
          key="todisp"
          variant="secondary"
          onClick={() => void run("to-disposition")}
        >
          Move to Disposition
        </Button>,
      );
    }
    if (ret.status === "DISPOSITION_PENDING" && canApprove) {
      buttons.push(
        <Button key="disp" onClick={() => setDlg("disposition")}>
          Disposition a Line
        </Button>,
        <Button
          key="complete"
          variant="secondary"
          onClick={() => void run("complete")}
        >
          Complete
        </Button>,
      );
    }
    if (ret.status === "READY_TO_SHIP" && canApprove) {
      buttons.push(
        <Button key="ship" onClick={() => setDlg("ship")}>
          Ship to Vendor
        </Button>,
      );
    }
    if (ret.status === "SHIPPED") {
      buttons.push(
        <Button
          key="vrecv"
          variant="secondary"
          onClick={() => void run("vendor-received")}
        >
          Vendor Confirmed Receipt
        </Button>,
      );
    }
    if (ret.status === "VENDOR_RECEIVED") {
      buttons.push(
        <Button key="complete-v" onClick={() => void run("complete")}>
          Complete
        </Button>,
      );
    }
    if (
      [
        "REQUESTED",
        "PENDING_APPROVAL",
        "APPROVED",
        "IN_TRANSIT",
        "RECEIVED",
        "INSPECTION_PENDING",
        "INSPECTED",
        "READY_TO_SHIP",
      ].includes(ret.status)
    ) {
      buttons.push(
        <Button
          key="cancel"
          variant="secondary"
          onClick={() => setDlg("cancel")}
        >
          Cancel
        </Button>,
      );
    }
  }

  return (
    <>
      <Dialog
        open={ret !== null}
        onClose={closeAll}
        title={ret?.returnNumber ?? "Return"}
        size="2xl"
        className="sm:max-w-5xl"
      >
        {ret ? (
          <div className="flex flex-col gap-4">
            <div>
              <StatusBadge
                label={formatStatusLabel(ret.status)}
                colorToken={scmStatusToken(ret.status)}
              />
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-4">
              <Field label="Type" value={formatStatusLabel(ret.returnType)} />
              <Field label="Reason" value={formatStatusLabel(ret.reasonCode)} />
              <Field
                label={isCustomer ? "Fulfillment" : "Purchase order"}
                value={
                  isCustomer ? ret.fulfillmentNumber : ret.purchaseOrderNumber
                }
              />
              <Field
                label={isCustomer ? "Sales order" : "GRN"}
                value={isCustomer ? ret.salesOrderNumber : ret.grnNumber}
              />
              <Field
                label={isCustomer ? "Customer" : "Supplier"}
                value={isCustomer ? ret.customerName : ret.supplierName}
              />
              <Field label="Warehouse" value={ret.warehouse?.name} />
              <Field label="Requested" value={formatDate(ret.requestedDate)} />
              <Field label="Approved" value={formatDate(ret.approvedAt)} />
              {ret.rejectionReason ? (
                <Field label="Rejection reason" value={ret.rejectionReason} />
              ) : null}
              {ret.cancellationReason ? (
                <Field
                  label="Cancellation reason"
                  value={ret.cancellationReason}
                />
              ) : null}
              {ret.qualityInspection ? (
                <Field
                  label="QC inspection"
                  value={`${ret.qualityInspection.inspectionNumber} (${formatStatusLabel(ret.qualityInspection.status)})`}
                />
              ) : null}
            </dl>
            <DataTable<ScmReturnItem>
              caption="Lines"
              columns={[
                {
                  header: "Product",
                  cell: (i) => `${i.productName} (${i.productCode})`,
                },
                {
                  header: "Requested",
                  align: "right",
                  cell: (i) => formatQty(i.requestedQty),
                },
                {
                  header: "Received",
                  align: "right",
                  cell: (i) => formatQty(i.receivedReturnQty),
                },
                {
                  header: "Accepted",
                  align: "right",
                  cell: (i) => formatQty(i.acceptedQty),
                },
                {
                  header: "Rejected",
                  align: "right",
                  cell: (i) => formatQty(i.rejectedQty),
                },
                {
                  header: "Condition",
                  cell: (i) =>
                    i.condition ? formatStatusLabel(i.condition) : "—",
                },
                {
                  header: "Dispositioned",
                  cell: (i) =>
                    i.dispositionQuantities &&
                    Object.keys(i.dispositionQuantities).length > 0
                      ? Object.entries(i.dispositionQuantities)
                          .map(
                            ([k, v]) =>
                              `${formatStatusLabel(k)}: ${formatQty(v)}`,
                          )
                          .join(", ")
                      : "—",
                },
              ]}
              rows={ret.items}
              getRowKey={(i) => String(i.id)}
            />
            {ret.ledgerEntries && ret.ledgerEntries.length > 0 ? (
              <p className="text-theme-xs text-gray-500">
                {ret.ledgerEntries.length} stock ledger entr
                {ret.ledgerEntries.length === 1 ? "y" : "ies"} posted.
              </p>
            ) : null}
            {err ? (
              <p
                role="alert"
                className="text-theme-xs text-error-600 dark:text-error-400"
              >
                {err}
              </p>
            ) : null}
            <div className="flex flex-wrap justify-end gap-2">
              {buttons}
              <Button variant="secondary" onClick={closeAll} disabled={busy}>
                Close
              </Button>
            </div>
          </div>
        ) : null}
      </Dialog>

      <ReasonDialog
        open={dlg === "reject"}
        title="Reject Return"
        label="Rejection reason"
        required
        onClose={() => setDlg(null)}
        onSubmit={async (reason) => {
          if (!ret) return;
          await act.mutateAsync({
            id: ret.id,
            action: "reject",
            body: { reason },
          });
          setDlg(null);
        }}
      />
      <ReasonDialog
        open={dlg === "cancel"}
        title="Cancel Return"
        label="Reason (optional)"
        onClose={() => setDlg(null)}
        onSubmit={async (reason) => {
          if (!ret) return;
          await act.mutateAsync({
            id: ret.id,
            action: "cancel",
            body: { reason },
          });
          setDlg(null);
        }}
      />
      <InTransitDialog
        open={dlg === "in-transit"}
        onClose={() => setDlg(null)}
        onSubmit={async (body) => {
          if (!ret) return;
          await act.mutateAsync({ id: ret.id, action: "in-transit", body });
          setDlg(null);
        }}
      />
      <ShipVendorDialog
        open={dlg === "ship"}
        onClose={() => setDlg(null)}
        onSubmit={async (input) => {
          if (!ret) return;
          await ship.mutateAsync({ id: ret.id, input });
          setDlg(null);
        }}
      />
      <ReceiveDialog
        ret={ret}
        open={dlg === "receive"}
        onClose={() => setDlg(null)}
        onSubmit={async (receivedQuantities) => {
          if (!ret) return;
          await receive.mutateAsync({
            id: ret.id,
            input: { receivedQuantities },
          });
          setDlg(null);
        }}
      />
      <InspectDialog
        ret={ret}
        open={dlg === "inspect"}
        onClose={() => setDlg(null)}
        onSubmit={async (itemResults) => {
          if (!ret) return;
          await inspect.mutateAsync({ id: ret.id, input: { itemResults } });
          setDlg(null);
        }}
      />
      <DispositionDialog
        ret={ret}
        open={dlg === "disposition"}
        onClose={() => setDlg(null)}
        onSubmit={async (input) => {
          if (!ret) return;
          await disposition.mutateAsync({ id: ret.id, input });
          setDlg(null);
        }}
      />
    </>
  );
}

function ReasonDialog({
  open,
  title,
  label,
  required,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  label: string;
  required?: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onClose={onClose} title={title} size="md">
      {open ? (
        <div className="flex flex-col gap-4">
          <Textarea
            aria-label={label}
            placeholder={label}
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          {err ? <p className="text-theme-xs text-error-600">{err}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button
              loading={busy}
              onClick={async () => {
                if (required && !reason.trim())
                  return setErr(`${label} is required`);
                setErr(null);
                setBusy(true);
                try {
                  await onSubmit(reason.trim());
                } catch (e) {
                  setErr(errorText(e, "Action failed"));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Confirm
            </Button>
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}

function InTransitDialog({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (body: {
    carrier?: string | undefined;
    trackingNumber?: string | undefined;
  }) => Promise<void>;
}) {
  const [carrier, setCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onClose={onClose} title="Mark In Transit" size="md">
      {open ? (
        <div className="flex flex-col gap-4">
          <Input
            aria-label="Carrier"
            placeholder="Carrier"
            value={carrier}
            onChange={(e) => setCarrier(e.target.value)}
          />
          <Input
            aria-label="Tracking number"
            placeholder="Tracking number"
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
          />
          {err ? <p className="text-theme-xs text-error-600">{err}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button
              loading={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onSubmit({
                    carrier: carrier.trim() || undefined,
                    trackingNumber: trackingNumber.trim() || undefined,
                  });
                } catch (e) {
                  setErr(errorText(e, "Action failed"));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Confirm
            </Button>
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}

function ShipVendorDialog({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: {
    carrier: string;
    trackingNumber: string;
  }) => Promise<void>;
}) {
  const [carrier, setCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onClose={onClose} title="Ship to Vendor" size="md">
      {open ? (
        <div className="flex flex-col gap-4">
          <Input
            aria-label="Carrier"
            placeholder="Carrier"
            value={carrier}
            onChange={(e) => setCarrier(e.target.value)}
          />
          <Input
            aria-label="Tracking number"
            placeholder="Tracking number"
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
          />
          {err ? <p className="text-theme-xs text-error-600">{err}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button
              loading={busy}
              onClick={async () => {
                if (!carrier.trim() || !trackingNumber.trim()) {
                  return setErr("Carrier and tracking number are required");
                }
                setErr(null);
                setBusy(true);
                try {
                  await onSubmit({
                    carrier: carrier.trim(),
                    trackingNumber: trackingNumber.trim(),
                  });
                } catch (e) {
                  setErr(errorText(e, "Action failed"));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Ship
            </Button>
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}

function ReceiveDialog({
  ret,
  open,
  onClose,
  onSubmit,
}: {
  ret: ScmReturn | null;
  open: boolean;
  onClose: () => void;
  onSubmit: (
    receivedQuantities: { itemId: number; quantity: number }[],
  ) => Promise<void>;
}) {
  const [qty, setQty] = useState<Record<number, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open={open && ret !== null}
      onClose={onClose}
      title="Receive Return"
      size="lg"
    >
      {open && ret ? (
        <div className="flex flex-col gap-4">
          {ret.items.map((i) => (
            <div
              key={i.id}
              className="grid grid-cols-[1fr_8rem] items-center gap-3"
            >
              <span className="text-theme-sm">
                {i.productName}{" "}
                <span className="text-gray-500">
                  (requested {formatQty(i.requestedQty)})
                </span>
              </span>
              <Input
                type="number"
                min={0}
                max={Number(i.requestedQty)}
                step={0.001}
                aria-label={`Received quantity for ${i.productName}`}
                value={qty[i.id] ?? String(Number(i.requestedQty))}
                onChange={(e) =>
                  setQty((q) => ({ ...q, [i.id]: e.target.value }))
                }
              />
            </div>
          ))}
          {err ? <p className="text-theme-xs text-error-600">{err}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button
              loading={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onSubmit(
                    ret.items.map((i) => ({
                      itemId: i.id,
                      quantity: Number(qty[i.id] ?? Number(i.requestedQty)),
                    })),
                  );
                } catch (e) {
                  setErr(errorText(e, "Action failed"));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Receive
            </Button>
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}

function InspectDialog({
  ret,
  open,
  onClose,
  onSubmit,
}: {
  ret: ScmReturn | null;
  open: boolean;
  onClose: () => void;
  onSubmit: (
    itemResults: {
      itemId: number;
      condition: (typeof RETURN_CONDITIONS)[number];
      acceptedQuantity: number;
      rejectedQuantity: number;
    }[],
  ) => Promise<void>;
}) {
  const [condition, setCondition] = useState<Record<number, string>>({});
  const [accepted, setAccepted] = useState<Record<number, string>>({});
  const [rejected, setRejected] = useState<Record<number, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open={open && ret !== null}
      onClose={onClose}
      title="Record Inspection"
      size="lg"
    >
      {open && ret ? (
        <div className="flex flex-col gap-4">
          {ret.items.map((i) => {
            const received =
              i.receivedReturnQty === null
                ? Number(i.requestedQty)
                : Number(i.receivedReturnQty);
            return (
              <div
                key={i.id}
                className="grid grid-cols-[1fr_8rem_6rem_6rem] items-center gap-3"
              >
                <span className="text-theme-sm">
                  {i.productName}{" "}
                  <span className="text-gray-500">
                    (received {formatQty(received)})
                  </span>
                </span>
                <Select
                  aria-label={`Condition for ${i.productName}`}
                  value={condition[i.id] ?? RETURN_CONDITIONS[0]}
                  onChange={(e) =>
                    setCondition((c) => ({ ...c, [i.id]: e.target.value }))
                  }
                >
                  {RETURN_CONDITIONS.map((c) => (
                    <option key={c} value={c}>
                      {formatStatusLabel(c)}
                    </option>
                  ))}
                </Select>
                <Input
                  type="number"
                  min={0}
                  step={0.001}
                  aria-label={`Accepted quantity for ${i.productName}`}
                  placeholder="Accepted"
                  value={accepted[i.id] ?? ""}
                  onChange={(e) =>
                    setAccepted((a) => ({ ...a, [i.id]: e.target.value }))
                  }
                />
                <Input
                  type="number"
                  min={0}
                  step={0.001}
                  aria-label={`Rejected quantity for ${i.productName}`}
                  placeholder="Rejected"
                  value={rejected[i.id] ?? ""}
                  onChange={(e) =>
                    setRejected((r) => ({ ...r, [i.id]: e.target.value }))
                  }
                />
              </div>
            );
          })}
          {err ? <p className="text-theme-xs text-error-600">{err}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button
              loading={busy}
              onClick={async () => {
                setErr(null);
                setBusy(true);
                try {
                  await onSubmit(
                    ret.items.map((i) => ({
                      itemId: i.id,
                      condition: (condition[i.id] ??
                        RETURN_CONDITIONS[0]) as (typeof RETURN_CONDITIONS)[number],
                      acceptedQuantity: Number(accepted[i.id] || 0),
                      rejectedQuantity: Number(rejected[i.id] || 0),
                    })),
                  );
                } catch (e) {
                  setErr(errorText(e, "Action failed"));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Save Inspection
            </Button>
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}

function DispositionDialog({
  ret,
  open,
  onClose,
  onSubmit,
}: {
  ret: ScmReturn | null;
  open: boolean;
  onClose: () => void;
  onSubmit: (input: {
    itemId: number;
    disposition: (typeof RETURN_DISPOSITIONS)[number];
    quantity: number;
    notes?: string | undefined;
  }) => Promise<void>;
}) {
  const openItems = (ret?.items ?? []).filter(
    (i) => (i.remainingToDisposition ?? 0) > 0,
  );
  const [itemId, setItemId] = useState("");
  const [disp, setDisp] = useState<(typeof RETURN_DISPOSITIONS)[number]>(
    RETURN_DISPOSITIONS[0],
  );
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const item = openItems.find((i) => String(i.id) === itemId);

  return (
    <Dialog
      open={open && ret !== null}
      onClose={onClose}
      title="Disposition a Line"
      size="md"
    >
      {open && ret ? (
        <div className="flex flex-col gap-4">
          <Select
            aria-label="Line"
            value={itemId}
            onChange={(e) => setItemId(e.target.value)}
          >
            <option value="">Select a line</option>
            {openItems.map((i) => (
              <option key={i.id} value={i.id}>
                {i.productName} ({i.productCode}) — remaining{" "}
                {formatQty(i.remainingToDisposition ?? 0)}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Disposition"
            value={disp}
            onChange={(e) =>
              setDisp(e.target.value as (typeof RETURN_DISPOSITIONS)[number])
            }
          >
            {RETURN_DISPOSITIONS.map((d) => (
              <option key={d} value={d}>
                {formatStatusLabel(d)}
              </option>
            ))}
          </Select>
          <Input
            type="number"
            min={0}
            step={0.001}
            aria-label="Quantity"
            placeholder={
              item
                ? `Up to ${formatQty(item.remainingToDisposition ?? 0)}`
                : "Quantity"
            }
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
          <Textarea
            aria-label="Notes"
            placeholder="Notes (optional)"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          {err ? <p className="text-theme-xs text-error-600">{err}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button
              loading={busy}
              onClick={async () => {
                if (!itemId) return setErr("Select a line");
                if (!(Number(quantity) > 0))
                  return setErr("Quantity must be greater than zero");
                setErr(null);
                setBusy(true);
                try {
                  await onSubmit({
                    itemId: Number(itemId),
                    disposition: disp,
                    quantity: Number(quantity),
                    notes: notes.trim() || undefined,
                  });
                } catch (e) {
                  setErr(errorText(e, "Action failed"));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Save Disposition
            </Button>
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}
