"use client";

import { Button, useToast } from "@texawave-erp/ui-kit";
import { Download, Printer } from "lucide-react";
import { useState } from "react";
import {
  buildLabelSvg,
  printLabels,
  svgToPngBlob,
  type LabelOptions,
} from "./label-svg";

export type BarcodeLabelProps = LabelOptions & {
  showActions?: boolean;
};

/** The one printable SCM label (product, bin, warehouse, batch, serial,
 * document...). Print uses the browser's native print dialog; Download
 * rasterises the same SVG to a PNG. */
export function BarcodeLabel({
  showActions = true,
  ...options
}: BarcodeLabelProps) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  // Cheap to build (a few ms), so it is derived on every render.
  const label = buildLabelSvg(options);

  async function download() {
    setBusy(true);
    try {
      const blob = await svgToPngBlob(label.svg, label.width, label.height, 3);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(options.title || options.value).replace(/[^a-z0-9-_]+/gi, "_")}_label.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast({
        title:
          err instanceof Error ? err.message : "Could not download the label",
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        className="mx-auto w-full max-w-[320px] overflow-hidden rounded-xl shadow-sm"
        // The SVG is generated locally from escaped text — never user HTML.
        dangerouslySetInnerHTML={{ __html: label.svg }}
      />
      {showActions ? (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => printLabels([label.svg], `${options.title} — Label`)}
          >
            <Printer className="mr-1.5 h-3.5 w-3.5" /> Print
          </Button>
          <Button
            variant="secondary"
            size="sm"
            loading={busy}
            onClick={() => void download()}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" /> Download
          </Button>
        </div>
      ) : null}
    </div>
  );
}
