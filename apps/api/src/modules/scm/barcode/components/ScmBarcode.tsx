// Phase 12 — reusable Code128 / EAN-13 renderer. Used everywhere SCM needs to render a linear
// barcode instead of every page hand-rolling its own JsBarcode call.
import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
import { toEan13 } from "../barcodeHelpers";

export interface ScmBarcodeProps {
  value: string;
  format?: "CODE128" | "EAN13";
  width?: number;
  height?: number;
  fontSize?: number;
  displayValue?: boolean;
  className?: string;
}

export default function ScmBarcode({
  value,
  format = "CODE128",
  width = 2,
  height = 60,
  fontSize = 14,
  displayValue = true,
  className,
}: ScmBarcodeProps) {
  const ref = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!ref.current || !value) return;
    try {
      const renderValue = format === "EAN13" ? toEan13(value) : value;
      JsBarcode(ref.current, renderValue, {
        format: format === "EAN13" ? "EAN13" : "CODE128",
        width,
        height,
        fontSize,
        displayValue,
        margin: 8,
        background: "transparent",
        lineColor: "#0f172a",
      });
    } catch {
      // Invalid value for the chosen symbology (e.g. non-numeric EAN-13 fallback that still
      // failed checksum encoding) — leave the SVG empty rather than throwing during render.
    }
  }, [value, format, width, height, fontSize, displayValue]);

  return (
    <svg
      ref={ref}
      className={className}
      role="img"
      aria-label={`Barcode ${value}`}
    />
  );
}
