import { useEffect, useState } from "react";
import { Button } from "@/modules/scm/shared/components/ScmButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  SHIPMENT_SERVICE_TYPES,
  DELIVERY_EXCEPTION_CODES,
} from "../logisticsHelpers";
import type {
  DeliveryExceptionCode,
  LogisticsCarrier,
  ScmShipment,
  ShipmentServiceType,
} from "@/types";
import { formatStatusLabel } from "@/modules/scm/shared/format";

interface BaseProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy: boolean;
}

/** Shell shared by every shipment action dialog. */
function ActionDialog({
  open,
  onOpenChange,
  busy,
  title,
  submitLabel,
  onSubmit,
  submitDisabled,
  destructive,
  children,
}: BaseProps & {
  title: string;
  submitLabel: string;
  onSubmit: () => void;
  submitDisabled?: boolean;
  destructive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">{children}</div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={onSubmit}
            disabled={busy || submitDisabled}
          >
            {busy ? "Saving..." : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export interface CarrierDialogValues {
  carrier: LogisticsCarrier;
  serviceType: ShipmentServiceType;
  expectedDeliveryDate?: string;
}

export function CarrierDialog({
  shipment,
  carriers,
  onSubmit,
  ...base
}: BaseProps & {
  shipment: ScmShipment;
  carriers: LogisticsCarrier[];
  onSubmit: (values: CarrierDialogValues) => void;
}) {
  const [carrierId, setCarrierId] = useState("");
  const [serviceType, setServiceType] =
    useState<ShipmentServiceType>("STANDARD");
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState("");
  useEffect(() => {
    if (!base.open) return;
    setCarrierId(shipment.carrierId || "");
    setServiceType(shipment.serviceType || "STANDARD");
    setExpectedDeliveryDate(shipment.expectedDeliveryDate || "");
  }, [base.open, shipment]);

  const activeCarriers = carriers.filter((c) => c.status === "ACTIVE");
  const selected = activeCarriers.find((c) => c.id === carrierId);
  const submit = () => {
    if (!selected) {
      toast.error("Select an active carrier");
      return;
    }
    onSubmit({
      carrier: selected,
      serviceType,
      expectedDeliveryDate: expectedDeliveryDate || undefined,
    });
  };

  return (
    <ActionDialog
      {...base}
      title="Assign Carrier"
      submitLabel="Assign Carrier"
      onSubmit={submit}
      submitDisabled={!selected}
    >
      <div className="space-y-1.5">
        <Label>Carrier *</Label>
        <Select value={carrierId} onValueChange={setCarrierId}>
          <SelectTrigger>
            <SelectValue placeholder="Select carrier" />
          </SelectTrigger>
          <SelectContent>
            {activeCarriers.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.carrierName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Service Type *</Label>
        <Select
          value={serviceType}
          onValueChange={(v) => setServiceType(v as ShipmentServiceType)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(selected?.serviceTypes?.length
              ? selected.serviceTypes
              : SHIPMENT_SERVICE_TYPES
            ).map((st) => (
              <SelectItem key={st} value={st}>
                {formatStatusLabel(st)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Estimated Delivery Date</Label>
        <Input
          type="date"
          value={expectedDeliveryDate}
          onChange={(e) => setExpectedDeliveryDate(e.target.value)}
        />
      </div>
    </ActionDialog>
  );
}

export function LabelDialog({
  initialTrackingNumber,
  onSubmit,
  ...base
}: BaseProps & {
  initialTrackingNumber?: string;
  onSubmit: (trackingNumber: string) => void;
}) {
  const [trackingNumber, setTrackingNumber] = useState("");
  useEffect(() => {
    if (base.open) setTrackingNumber(initialTrackingNumber || "");
  }, [base.open, initialTrackingNumber]);
  return (
    <ActionDialog
      {...base}
      title="Add Tracking Number / Create Label"
      submitLabel="Create Label"
      onSubmit={() => onSubmit(trackingNumber)}
      submitDisabled={!trackingNumber.trim()}
    >
      <div className="space-y-1.5">
        <Label>Tracking Number *</Label>
        <Input
          value={trackingNumber}
          onChange={(e) => setTrackingNumber(e.target.value)}
          placeholder="Carrier-generated or manually entered"
        />
      </div>
    </ActionDialog>
  );
}

export type TransitStatus = "IN_TRANSIT" | "OUT_FOR_DELIVERY";

export function TransitDialog({
  status,
  onSubmit,
  ...base
}: BaseProps & {
  status: TransitStatus | null;
  onSubmit: (values: { location?: string; description?: string }) => void;
}) {
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  useEffect(() => {
    if (base.open) {
      setLocation("");
      setDescription("");
    }
  }, [base.open]);
  return (
    <ActionDialog
      {...base}
      title={`Mark ${status ? formatStatusLabel(status) : ""}`}
      submitLabel="Update"
      onSubmit={() =>
        onSubmit({
          location: location || undefined,
          description: description || undefined,
        })
      }
    >
      <div className="space-y-1.5">
        <Label>Location</Label>
        <Input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Optional"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Description</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional"
        />
      </div>
    </ActionDialog>
  );
}

export function DeliveredDialog({
  onSubmit,
  ...base
}: BaseProps & {
  onSubmit: (values: {
    recipientName?: string;
    deliveryNotes?: string;
  }) => void;
}) {
  const [recipientName, setRecipientName] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  useEffect(() => {
    if (base.open) {
      setRecipientName("");
      setDeliveryNotes("");
    }
  }, [base.open]);
  return (
    <ActionDialog
      {...base}
      title="Mark Delivered"
      submitLabel="Confirm Delivered"
      onSubmit={() =>
        onSubmit({
          recipientName: recipientName || undefined,
          deliveryNotes: deliveryNotes || undefined,
        })
      }
    >
      <div className="space-y-1.5">
        <Label>Recipient Name</Label>
        <Input
          value={recipientName}
          onChange={(e) => setRecipientName(e.target.value)}
          placeholder="Optional"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Delivery Notes</Label>
        <Textarea
          value={deliveryNotes}
          onChange={(e) => setDeliveryNotes(e.target.value)}
          placeholder="Optional"
        />
      </div>
    </ActionDialog>
  );
}

export function ExceptionDialog({
  onSubmit,
  ...base
}: BaseProps & {
  onSubmit: (values: {
    code: DeliveryExceptionCode;
    description: string;
  }) => void;
}) {
  const [code, setCode] = useState<DeliveryExceptionCode>("OTHER");
  const [description, setDescription] = useState("");
  useEffect(() => {
    if (base.open) {
      setCode("OTHER");
      setDescription("");
    }
  }, [base.open]);
  const submit = () => {
    if (!description.trim()) {
      toast.error("Description is required");
      return;
    }
    onSubmit({ code, description });
  };
  return (
    <ActionDialog
      {...base}
      title="Record Delivery Exception"
      submitLabel="Record Exception"
      onSubmit={submit}
    >
      <div className="space-y-1.5">
        <Label>Exception Type *</Label>
        <Select
          value={code}
          onValueChange={(v) => setCode(v as DeliveryExceptionCode)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DELIVERY_EXCEPTION_CODES.map((c) => (
              <SelectItem key={c} value={c}>
                {formatStatusLabel(c)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Description *</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
    </ActionDialog>
  );
}

/** Free-text reason dialog — used for failed delivery (required) and cancellation (optional). */
export function ReasonDialog({
  title,
  submitLabel,
  hint,
  required,
  onSubmit,
  ...base
}: BaseProps & {
  title: string;
  submitLabel: string;
  hint?: string;
  required?: boolean;
  onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  useEffect(() => {
    if (base.open) setReason("");
  }, [base.open]);
  const submit = () => {
    if (required && !reason.trim()) {
      toast.error("Reason is required");
      return;
    }
    onSubmit(reason.trim());
  };
  return (
    <ActionDialog
      {...base}
      title={title}
      submitLabel={submitLabel}
      onSubmit={submit}
      destructive
    >
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      <div className="space-y-1.5">
        <Label>Reason{required ? " *" : ""}</Label>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason"
        />
      </div>
    </ActionDialog>
  );
}
