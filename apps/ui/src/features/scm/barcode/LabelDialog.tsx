"use client";

import { Dialog } from "@texawave-erp/ui-kit";
import { BarcodeLabel, type BarcodeLabelProps } from "./BarcodeLabel";
import { barcodeSvg, qrSvg } from "./label-svg";

/** Small inline QR code (table thumbnails, result cards). */
export function QrCodeImage({
  value,
  size = 36,
  className,
}: {
  value: string;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={className}
      style={{ display: "inline-block", lineHeight: 0 }}
      // Generated locally from the value — never user HTML.
      dangerouslySetInnerHTML={{ __html: qrSvg(value, size) }}
    />
  );
}

/** Small inline linear barcode. */
export function BarcodeImage({
  value,
  format = "CODE128",
  width = 160,
  height = 44,
  className,
}: {
  value: string;
  format?: "CODE128" | "EAN13";
  width?: number;
  height?: number;
  className?: string;
}) {
  return (
    <span
      className={className}
      style={{ display: "inline-block", lineHeight: 0 }}
      dangerouslySetInnerHTML={{
        __html: barcodeSvg(value, format, width, height),
      }}
    />
  );
}

/** A printable label in a dialog. */
export function LabelDialog({
  open,
  onClose,
  dialogTitle,
  label,
}: {
  open: boolean;
  onClose: () => void;
  dialogTitle: string;
  label: BarcodeLabelProps | null;
}) {
  return (
    <Dialog
      open={open && label !== null}
      onClose={onClose}
      title={dialogTitle}
      size="sm"
    >
      {open && label ? <BarcodeLabel {...label} /> : null}
    </Dialog>
  );
}
