// Phase 12 — the one printable SCM label used everywhere a product, location, batch, serial or
// document needs a physical/PDF label: Products, Locations, Batches, Serials, Shipments, Returns,
// Quality. Print uses the browser's native print dialog (react-to-print); Download rasterizes the
// same label to a PNG via html2canvas — both already project dependencies, nothing new added
// beyond the barcode/QR renderers themselves.
import { useRef, useState } from "react";
import html2canvas from "html2canvas";
import { saveAs } from "file-saver";
import { useReactToPrint } from "react-to-print";
import { Button } from "@/modules/scm/shared/components/ScmButton";
import { Printer, Download } from "lucide-react";
import ScmBarcode from "./ScmBarcode";
import ScmQrCode from "./ScmQrCode";
import type { BarcodeFormat } from "../barcodeTypes";

export interface ScmBarcodeLabelProps {
  format: BarcodeFormat;
  value: string;
  title: string;
  subtitle?: string;
  lines?: string[];
  /** Shown below the code area, e.g. "Warehouse: WH-01 · Location: A-02-03-05". */
  footer?: string;
  showActions?: boolean;
}

export default function ScmBarcodeLabel({
  format,
  value,
  title,
  subtitle,
  lines = [],
  footer,
  showActions = true,
}: ScmBarcodeLabelProps) {
  const labelRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const print = useReactToPrint({
    contentRef: labelRef,
    documentTitle: `${title} — Label`,
  });

  const download = async () => {
    if (!labelRef.current) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(labelRef.current, {
        scale: 3,
        backgroundColor: "#ffffff",
        useCORS: true,
      });
      canvas.toBlob((blob) => {
        if (blob)
          saveAs(
            blob,
            `${(title || value).replace(/[^a-z0-9-_]+/gi, "_")}_label.png`,
          );
      });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div
        ref={labelRef}
        className="mx-auto w-full max-w-[320px] rounded-lg border border-border bg-white p-4 text-center shadow-sm"
      >
        <div className="text-[10px] font-bold tracking-widest text-brand-600">
          TEXA ERP
        </div>
        <div className="mt-1 text-sm font-semibold text-foreground leading-tight break-words">
          {title}
        </div>
        {subtitle && (
          <div className="text-xs text-muted-foreground">{subtitle}</div>
        )}
        {lines.map((line) => (
          <div key={line} className="text-[11px] text-muted-foreground">
            {line}
          </div>
        ))}
        <div className="mt-3 flex items-center justify-center">
          {format === "QR" ? (
            <ScmQrCode value={value} size={128} />
          ) : (
            <ScmBarcode value={value} format={format} />
          )}
        </div>
        {footer && (
          <div className="mt-2 text-[11px] text-muted-foreground border-t pt-2">
            {footer}
          </div>
        )}
      </div>
      {showActions && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" onClick={() => print()}>
            <Printer className="h-3.5 w-3.5 mr-1.5" /> Print
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={download}
            disabled={downloading}
          >
            <Download className="h-3.5 w-3.5 mr-1.5" />{" "}
            {downloading ? "Preparing..." : "Download"}
          </Button>
        </div>
      )}
    </div>
  );
}
