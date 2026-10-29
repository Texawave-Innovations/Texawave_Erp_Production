"use client";

import { Button, Dialog } from "@texawave-erp/ui-kit";
import { Printer } from "lucide-react";
import { useEffect, useRef } from "react";
import { printElement, safeFilename } from "@/lib/print-element";
import { MomDocumentSheet, type MomSheetData } from "./MomDocumentSheet";

export interface MomPreviewModalProps {
  open: boolean;
  onClose: () => void;
  data: MomSheetData | null;
  /** Open the print dialog as soon as the preview renders (register's
   * "Download PDF" action — legacy `autoDownload`). */
  autoPrint?: boolean;
}

/** Legacy `mom/components/MomPreviewModal.tsx` — the formal document view
 * with Print / Save as PDF. */
export function MomPreviewModal({
  open,
  onClose,
  data,
  autoPrint = false,
}: MomPreviewModalProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const autoPrinted = useRef(false);

  function handlePrint() {
    if (!sheetRef.current || !data) return;
    printElement(
      sheetRef.current,
      safeFilename(
        data.reference,
        `Rev${data.revision}`,
        data.projectCode ?? data.projectName,
      ),
    );
  }

  useEffect(() => {
    if (!open) {
      autoPrinted.current = false;
      return;
    }
    if (autoPrint && data && !autoPrinted.current) {
      autoPrinted.current = true;
      const timer = window.setTimeout(handlePrint, 400);
      return () => window.clearTimeout(timer);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reason: fire once per open; handlePrint only reads the ref and current data
  }, [open, autoPrint, data]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="5xl"
      title={data ? `Preview — ${data.reference}` : "Preview"}
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <p className="text-theme-xs text-gray-500 dark:text-gray-400">
            Use your browser&apos;s &quot;Save as PDF&quot; destination to
            download a PDF copy.
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            <Button onClick={handlePrint} disabled={!data}>
              <Printer className="h-4 w-4" />
              Print / Save PDF
            </Button>
          </div>
        </div>
      }
    >
      <div className="rounded-xl bg-gray-100 p-3 dark:bg-gray-800">
        <div ref={sheetRef} className="shadow-theme-sm">
          {data ? <MomDocumentSheet data={data} /> : null}
        </div>
      </div>
    </Dialog>
  );
}
