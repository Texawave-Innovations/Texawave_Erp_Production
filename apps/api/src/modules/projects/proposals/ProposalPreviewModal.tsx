import React, { useRef, useState, useEffect } from "react";
import {
  ProposalDocument,
  ProposalSectionConfig,
  DEFAULT_PROPOSAL_SETTINGS,
  ProposalSettings,
} from "../proposalTypes";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Printer, Edit, X } from "lucide-react";
import { toast } from "sonner";
import { exportElementAsPdf, toSafeFilenameSegment } from "@/utils/pdfExport";

interface ProposalPreviewModalProps {
  proposal: ProposalDocument | null;
  open: boolean;
  onClose: () => void;
  onEdit?: (proposal: ProposalDocument) => void;
  autoDownload?: boolean;
}

export function ProposalPreviewModal({
  proposal,
  open,
  onClose,
  onEdit,
  autoDownload,
}: ProposalPreviewModalProps) {
  const documentRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const autoDownloadTriggered = useRef(false);

  const handleDownloadPDF = async () => {
    if (!documentRef.current || !proposal) return;
    setDownloading(true);
    const toastId = toast.loading("Exporting proposal PDF...");

    try {
      const safePropNum = toSafeFilenameSegment(
        proposal.proposalNumber || "TXW-PROP",
      );
      const safeClient = toSafeFilenameSegment(
        proposal.clientName || "Client",
        true,
      );
      const filename = `${safePropNum}_${safeClient}.pdf`;

      await exportElementAsPdf(documentRef.current, filename);
      toast.success(`Exported ${filename}`, { id: toastId });
    } catch (err: any) {
      toast.error(
        err?.message ||
          "Failed to generate PDF. Falling back to browser print...",
        { id: toastId },
      );
      window.print();
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  useEffect(() => {
    if (open && autoDownload && !autoDownloadTriggered.current && proposal) {
      autoDownloadTriggered.current = true;
      const timer = setTimeout(() => {
        handleDownloadPDF();
      }, 350);
      return () => clearTimeout(timer);
    }
    if (!open) {
      autoDownloadTriggered.current = false;
    }
  }, [open, autoDownload, proposal?.id]);

  if (!proposal) return null;

  const sections: ProposalSectionConfig[] =
    proposal.templateSnapshot?.sections || [];
  const sectionValues = proposal.sectionValues || proposal.proposal_data || {};
  const settings: ProposalSettings = DEFAULT_PROPOSAL_SETTINGS;

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[92vh] flex flex-col p-0 rounded-3xl overflow-hidden shadow-2xl border-slate-200 bg-slate-100">
        {/* Top Floating Modal Bar */}
        <div className="p-4 sm:px-6 bg-white border-b border-slate-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-black text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-lg">
                {proposal.proposalNumber}
              </span>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 truncate max-w-sm sm:max-w-md">
                {proposal.title || "Client Proposal & Statement of Work"}
              </h2>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Client:{" "}
              <strong className="text-slate-700">
                {proposal.clientName || "N/A"}
              </strong>{" "}
              • Project:{" "}
              <strong className="text-slate-700">
                {proposal.projectName || "N/A"}
              </strong>
            </p>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {onEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onClose();
                  onEdit(proposal);
                }}
                className="rounded-xl text-xs font-bold gap-1.5 h-8 bg-white border-slate-200 hover:bg-slate-50"
              >
                <Edit className="h-3.5 w-3.5 text-slate-600" /> Edit Document
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="rounded-xl text-xs font-bold gap-1.5 h-8 bg-white border-slate-200 hover:bg-slate-50"
            >
              <Printer className="h-3.5 w-3.5 text-slate-600" /> Print
            </Button>

            <Button
              size="sm"
              onClick={handleDownloadPDF}
              disabled={downloading}
              style={{
                background:
                  "linear-gradient(135deg, #4D9F4B 0%, #72B84A 50%, #9FCA48 100%)",
              }}
              className="rounded-xl text-xs font-bold gap-1.5 h-8 text-white shadow-xs"
            >
              <Download className="h-3.5 w-3.5" />
              {downloading ? "Exporting..." : "Download PDF"}
            </Button>
          </div>
        </div>

        {/* Scrollable Document Body - Pure A4 Simulation Sheet */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 flex justify-center">
          <div
            ref={documentRef}
            id="printable-proposal-document"
            className="bg-white shadow-xl rounded-2xl border border-slate-300 p-8 sm:p-12 flex flex-col space-y-8 max-w-3xl w-full relative text-black"
          >
            {/* Top Accent Gradient Line */}
            <div
              style={{
                background:
                  "linear-gradient(135deg, #4D9F4B 0%, #72B84A 50%, #9FCA48 100%)",
              }}
              className="h-2 w-full absolute top-0 left-0 right-0 rounded-t-2xl"
            />

            {/* Official Header */}
            <div className="relative pb-5 border-b border-slate-300">
              <div className="text-center px-24 space-y-1">
                <p className="text-lg font-serif text-black font-bold tracking-normal">
                  TexaWave Innovations Pvt Ltd
                </p>
                <h1 className="text-xl sm:text-2xl font-serif font-black text-black tracking-tight">
                  {proposal.title || "Client Proposal & Statement of Work"}
                </h1>
              </div>

              {/* Official Logo */}
              <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center justify-end">
                <img
                  src="/Texa_Logo.jpeg"
                  alt="TexaWave Logo"
                  className="h-16 object-contain max-w-[170px]"
                />
              </div>
            </div>

            {/* Proposal Key Meta Info Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50/80 rounded-2xl border border-slate-300 text-xs text-black">
              <div>
                <span className="text-[10px] uppercase font-bold text-black block">
                  Proposal No
                </span>
                <span className="font-mono font-bold text-emerald-800">
                  {proposal.proposalNumber}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-black block">
                  Date
                </span>
                <span className="font-bold text-black">
                  {proposal.proposalDate ||
                    (proposal.createdAt
                      ? new Date(proposal.createdAt).toLocaleDateString("en-GB")
                      : "-")}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-black block">
                  Client
                </span>
                <span className="font-bold text-black truncate block">
                  {proposal.clientName || "N/A"}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-black block">
                  Prepared By
                </span>
                <span className="font-bold text-black truncate block">
                  {proposal.preparedBy || "TexaWave Team"}
                </span>
              </div>
            </div>

            {/* Sections Flow */}
            <div className="space-y-6 text-black">
              {sections
                .filter((s) => s.isEnabled !== false)
                .map((sec, secIdx) => {
                  const secVal = sectionValues[sec.id];
                  const sectionNum =
                    sec.showSectionNumber !== false ? `${secIdx + 1}.0 ` : "";

                  if (sec.contentType === "page_break") {
                    return (
                      <div
                        key={sec.id}
                        className="py-3 border-y border-dashed border-slate-300 text-center text-[10px] font-mono text-slate-500 pdf-page-break-before"
                        style={{ pageBreakBefore: "always" }}
                      >
                        <span>─── PAGE BREAK ───</span>
                      </div>
                    );
                  }

                  const shouldBreakBefore = sec.pageBreakBefore;

                  return (
                    <div
                      key={sec.id}
                      className={`space-y-2 ${shouldBreakBefore ? "pdf-page-break-before pt-6" : ""}`}
                      style={
                        shouldBreakBefore ? { pageBreakBefore: "always" } : {}
                      }
                    >
                      {/* Section Title */}
                      <div className="border-b border-slate-300 pb-1 flex items-center justify-between">
                        <h3 className="text-sm font-bold text-black tracking-tight flex items-center gap-1.5">
                          <span className="text-emerald-700 font-bold">
                            {sectionNum}
                          </span>
                          {sec.title}
                        </h3>
                      </div>

                      {/* Section Content */}
                      <div className="text-black pl-1 text-xs">
                        {sec.contentType === "rich_text" ||
                        sec.contentType === "paragraph" ||
                        sec.contentType === "long_text" ? (
                          <p className="whitespace-pre-line leading-relaxed text-black">
                            {secVal ||
                              sec.defaultContent ||
                              "No text content provided."}
                          </p>
                        ) : sec.contentType === "short_text" ? (
                          <p className="font-bold text-black">
                            {secVal || "-"}
                          </p>
                        ) : sec.contentType === "bullet_list" ? (
                          <ul className="list-disc pl-5 space-y-1 text-black">
                            {(Array.isArray(secVal) && secVal.length > 0
                              ? secVal
                              : sec.defaultItems || []
                            ).map((it: string, i: number) => (
                              <li key={i}>{it}</li>
                            ))}
                          </ul>
                        ) : sec.contentType === "numbered_list" ? (
                          <ol className="list-decimal pl-5 space-y-1 text-black">
                            {(Array.isArray(secVal) && secVal.length > 0
                              ? secVal
                              : sec.defaultItems || []
                            ).map((it: string, i: number) => (
                              <li key={i}>{it}</li>
                            ))}
                          </ol>
                        ) : sec.contentType === "key_value" ? (
                          <div className="grid grid-cols-2 gap-2.5 bg-slate-50 p-3.5 rounded-xl border border-slate-300 text-xs text-black">
                            {(
                              sec.keyValueFields || [
                                { id: "f1", label: "Project Title" },
                                { id: "f2", label: "PRD Code" },
                                { id: "f3", label: "Client" },
                                { id: "f4", label: "Version" },
                                { id: "f5", label: "Prepared By" },
                                { id: "f6", label: "Reviewed By" },
                                { id: "f7", label: "Approved By" },
                                { id: "f8", label: "Date" },
                              ]
                            ).map((f) => (
                              <div key={f.id}>
                                <span className="font-bold text-black">
                                  {f.label}:
                                </span>{" "}
                                <span className="text-black">
                                  {(secVal && secVal[f.id]) || "-"}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : sec.contentType === "table" ? (
                          <div className="space-y-1.5 mt-1">
                            {sec.tableTitle && (
                              <h4 className="text-xs font-bold text-black">
                                {sec.tableTitle}
                              </h4>
                            )}
                            <div className="border border-slate-300 rounded-xl overflow-hidden shadow-xs">
                              <table className="w-full text-xs text-black">
                                <thead className="bg-slate-100 text-black font-bold border-b border-slate-300">
                                  <tr>
                                    {(
                                      sec.tableColumns || [
                                        { id: "col1", name: "Milestone" },
                                        { id: "col2", name: "Duration" },
                                        { id: "col3", name: "End Date" },
                                      ]
                                    ).map((col) => (
                                      <th
                                        key={col.id}
                                        className="py-2 px-3 text-left font-bold text-black"
                                      >
                                        {col.name}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 bg-white text-black">
                                  {Array.isArray(secVal) &&
                                  secVal.length > 0 ? (
                                    secVal.map((row: any, rIdx: number) => (
                                      <tr key={rIdx}>
                                        {(
                                          sec.tableColumns || [
                                            { id: "col1", name: "Milestone" },
                                            { id: "col2", name: "Duration" },
                                            { id: "col3", name: "End Date" },
                                          ]
                                        ).map((col) => (
                                          <td
                                            key={col.id}
                                            className="py-2 px-3 text-black"
                                          >
                                            {row[col.id] || "-"}
                                          </td>
                                        ))}
                                      </tr>
                                    ))
                                  ) : (
                                    <tr>
                                      <td
                                        colSpan={sec.tableColumns?.length || 3}
                                        className="py-3 px-3 text-center text-slate-500 italic"
                                      >
                                        No table rows entered.
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ) : sec.contentType === "signature" ? (
                          <div className="pt-6 grid grid-cols-2 gap-8 text-black">
                            <div className="border-t border-slate-400 pt-2 text-center">
                              <p className="font-bold text-black">
                                Authorized Signature (TexaWave)
                              </p>
                              <p className="text-[10px] text-black">
                                Sign & Seal
                              </p>
                            </div>
                            <div className="border-t border-slate-400 pt-2 text-center">
                              <p className="font-bold text-black">
                                Client Acceptance (
                                {proposal.clientName || "Client"})
                              </p>
                              <p className="text-[10px] text-black">
                                Sign & Seal
                              </p>
                            </div>
                          </div>
                        ) : (
                          <p className="text-black">{String(secVal || "-")}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
