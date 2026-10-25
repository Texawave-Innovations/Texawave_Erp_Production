"use client";

import { Button, Dialog } from "@texawave-erp/ui-kit";
import { Printer } from "lucide-react";
import { useEffect, useRef } from "react";
import { usePermission } from "@/hooks/usePermission";
import { printElement, safeFilename } from "@/lib/print-element";
import { useProposalSettings } from "../hooks";
import { PROPOSALS_READ } from "../permissions";
import {
  ProposalDocumentSheet,
  type ProposalSheetData,
} from "./ProposalDocumentSheet";

export interface ProposalPreviewModalProps {
  open: boolean;
  onClose: () => void;
  data: ProposalSheetData | null;
  /** Open the print dialog as soon as the preview renders (hub "Download
   * PDF" — legacy `autoDownload`). */
  autoPrint?: boolean;
}

/** Legacy `proposals/ProposalPreviewModal.tsx` — formal document view with
 * Print / Save as PDF (browser print, no extra dependency). */
export function ProposalPreviewModal({
  open,
  onClose,
  data,
  autoPrint = false,
}: ProposalPreviewModalProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const printedFor = useRef<string | null>(null);
  const canRead = usePermission(PROPOSALS_READ);
  const settings = useProposalSettings({ enabled: canRead });

  function handlePrint() {
    if (!sheetRef.current || !data) return;
    printElement(
      sheetRef.current,
      safeFilename(data.proposalNumber, data.clientName ?? data.projectName),
    );
  }

  useEffect(() => {
    if (!open) {
      printedFor.current = null;
      return undefined;
    }
    if (autoPrint && data && printedFor.current !== data.proposalNumber) {
      printedFor.current = data.proposalNumber;
      const timer = window.setTimeout(handlePrint, 400);
      return () => window.clearTimeout(timer);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reason: fire once per opened document; handlePrint only reads the ref and current data
  }, [open, autoPrint, data]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="5xl"
      title={data ? `Preview — ${data.proposalNumber}` : "Preview"}
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <p className="text-theme-xs text-gray-500 dark:text-gray-400">
            Choose &quot;Save as PDF&quot; in the print dialog to download a PDF
            copy.
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
          {data ? (
            <ProposalDocumentSheet data={data} settings={settings.data} />
          ) : null}
        </div>
      </div>
    </Dialog>
  );
}
