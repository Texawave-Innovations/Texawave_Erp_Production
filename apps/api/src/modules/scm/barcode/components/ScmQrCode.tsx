// Phase 12 — reusable QR renderer, thin wrapper around qrcode.react so every SCM page that
// needs a QR code (locations, documents, labels) shares one component and one visual style.
import { QRCodeSVG } from "qrcode.react";

export interface ScmQrCodeProps {
  value: string;
  size?: number;
  className?: string;
}

export default function ScmQrCode({
  value,
  size = 120,
  className,
}: ScmQrCodeProps) {
  return (
    <QRCodeSVG
      value={value || " "}
      size={size}
      level="M"
      marginSize={2}
      fgColor="#0f172a"
      bgColor="transparent"
      className={className}
      role="img"
      aria-label={`QR code ${value}`}
    />
  );
}
