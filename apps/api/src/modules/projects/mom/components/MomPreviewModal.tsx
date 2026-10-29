// src/modules/projects/mom/components/MomPreviewModal.tsx

import React, { useRef, useState } from "react";
import { MomDocument, DEFAULT_MOM_COMPANY_HEADER } from "../types/mom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Printer } from "lucide-react";
import { toast } from "sonner";
import { exportElementAsPdf, toSafeFilenameSegment } from "@/utils/pdfExport";

interface MomPreviewModalProps {
  document: MomDocument | null;
  open: boolean;
  onClose: () => void;
  autoDownload?: boolean;
}

export const MomPreviewModal: React.FC<MomPreviewModalProps> = ({
  document: doc,
  open,
  onClose,
  autoDownload = false,
}) => {
  const documentRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const autoDownloadTriggered = useRef(false);

  React.useEffect(() => {
    if (open && autoDownload && !autoDownloadTriggered.current && doc) {
      autoDownloadTriggered.current = true;
      const timer = setTimeout(() => {
        handleDownloadPDF();
      }, 400);
      return () => clearTimeout(timer);
    }
    if (!open) {
      autoDownloadTriggered.current = false;
    }
  }, [open, autoDownload, doc?.id]);

  if (!doc) return null;

  const handleDownloadPDF = async () => {
    if (!documentRef.current || !doc) return;
    setDownloading(true);
    const toastId = toast.loading("Generating PDF export...");

    try {
      const safeRef = toSafeFilenameSegment(doc.reference || "MOM-DOCUMENT");
      const docRev = doc.currentRevision || 1;
      const safeProject = toSafeFilenameSegment(
        doc.projectCode || doc.projectName || "Project",
        true,
      );
      const filename = `${safeRef}_Rev${docRev}_${safeProject}.pdf`;

      await exportElementAsPdf(documentRef.current, filename, {
        margin: [10, 12, 12, 12],
      });
      toast.success(`Exported ${filename}`, { id: toastId });
    } catch (err: any) {
      console.error("Failed to export MoM PDF:", err);
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

  const isDraft = doc.status === "draft";
  const attendeesPresent = (doc.attendees || []).filter(
    (a) => a.attendance === "present" || a.attendance === "remote",
  );
  const absentees = doc.absentees || [];

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[92vh] flex flex-col p-0 rounded-3xl overflow-hidden shadow-2xl border-slate-200 bg-slate-100 text-slate-900">
        {/* Top Controls Bar - Hidden on PDF/Print */}
        <div className="p-4 sm:px-6 bg-white border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-black text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-lg">
                {doc.reference}
              </span>
              <Badge
                variant="outline"
                className={`text-[10px] font-bold px-2 py-0.5 border ${
                  isDraft
                    ? "bg-amber-100 text-amber-800 border-amber-300"
                    : "bg-emerald-100 text-emerald-800 border-emerald-300"
                }`}
              >
                {doc.status.toUpperCase()}
              </Badge>
              <span className="text-xs font-mono text-slate-500 font-bold">
                Document Revision: Rev {doc.currentRevision}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Project:{" "}
              <strong className="text-slate-700">
                {doc.projectName} ({doc.projectCode || "PRJ"})
              </strong>
              {doc.templateVersion && (
                <span>
                  {" "}
                  • Template Version:{" "}
                  <strong className="text-slate-700">
                    {doc.templateVersion}
                  </strong>
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="rounded-xl text-xs font-bold gap-1.5 h-8 bg-white border-slate-200 hover:bg-slate-50"
            >
              <Printer className="h-3.5 w-3.5 text-slate-600" /> Print
            </Button>
            <Button
              type="button"
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
              {downloading ? "Generating PDF..." : "Download PDF"}
            </Button>
          </div>
        </div>

        {/* Scrollable Document Container - Pure A4 Paper Simulation */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 flex justify-center bg-slate-200/60">
          <div
            ref={documentRef}
            id="printable-mom-document"
            className="bg-white shadow-xl rounded-2xl border border-slate-300 p-8 sm:p-12 flex flex-col space-y-6 max-w-3xl w-full relative text-black"
          >
            {/* Top Brand Accent Gradient Bar */}
            <div
              style={{
                background:
                  "linear-gradient(135deg, #4D9F4B 0%, #72B84A 50%, #9FCA48 100%)",
              }}
              className="h-2 w-full absolute top-0 left-0 right-0 rounded-t-2xl"
            />

            {/* DRAFT Watermark Banner (if draft) */}
            {isDraft && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 text-center py-1 rounded-lg text-xs font-extrabold uppercase tracking-widest">
                ⚠ DRAFT DOCUMENT — NOT FINALIZED
              </div>
            )}

            {/* Official Header */}
            <div className="relative pb-5 border-b border-slate-300 flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-lg font-serif text-black font-bold tracking-normal">
                  {DEFAULT_MOM_COMPANY_HEADER.companyName}
                </p>
                <h1 className="text-xl sm:text-2xl font-serif font-black text-black tracking-tight">
                  MINUTES OF MEETING
                </h1>
                <p className="text-[11px] text-slate-600">
                  Email: {DEFAULT_MOM_COMPANY_HEADER.email} • Phone:{" "}
                  {DEFAULT_MOM_COMPANY_HEADER.phone}
                </p>
                <p className="text-[10px] text-slate-500">
                  {DEFAULT_MOM_COMPANY_HEADER.address}
                </p>
              </div>

              {/* Official Logo */}
              <div className="shrink-0 flex items-center justify-end">
                <img
                  src={DEFAULT_MOM_COMPANY_HEADER.logoUrl}
                  alt="TexaWave Logo"
                  className="h-16 object-contain max-w-[170px]"
                />
              </div>
            </div>

            {/* Document Reference & Metadata Control Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-50/90 rounded-xl border border-slate-300 text-xs text-black">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">
                  MoM Reference
                </span>
                <span className="font-mono font-bold text-emerald-800">
                  {doc.reference}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">
                  Meeting Date
                </span>
                <span className="font-bold text-black">
                  {doc.meetingDate || "—"}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">
                  Time & Timezone
                </span>
                <span className="font-bold text-black">
                  {doc.startTime} - {doc.endTime} ({doc.timezone})
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">
                  Document Revision
                </span>
                <span className="font-mono font-bold text-slate-700">
                  Rev {doc.currentRevision} ({doc.status})
                </span>
              </div>
            </div>

            {/* Project Context & Location */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-white rounded-xl border border-slate-200 text-xs text-black">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">
                  Linked Project
                </span>
                <span className="font-bold text-slate-900">
                  [{doc.projectCode || "PRJ"}] {doc.projectName}
                </span>
                {doc.clientName && (
                  <p className="text-[11px] text-slate-600">
                    Client: {doc.clientName}
                  </p>
                )}
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">
                  Location / Virtual Link
                </span>
                <span className="font-bold text-slate-900">
                  {doc.location || "Online Conference Room"}
                </span>
                {doc.templateVersion && (
                  <p className="text-[10px] text-slate-500">
                    Template Version: {doc.templateVersion}
                  </p>
                )}
              </div>
            </div>

            {/* Meeting Title */}
            <div className="border-b border-slate-300 pb-2">
              <h2 className="text-base sm:text-lg font-bold text-black">
                Subject: {doc.meetingTitle}
              </h2>
            </div>

            {/* Attendance Lists */}
            <div className="space-y-3">
              <h3 className="text-xs uppercase font-extrabold tracking-wider text-slate-700 border-b border-slate-200 pb-1">
                Meeting Attendance
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                {/* Attendees */}
                <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 space-y-1.5">
                  <p className="font-bold text-slate-800 text-[11px] uppercase">
                    Present Attendees ({attendeesPresent.length})
                  </p>
                  {attendeesPresent.length === 0 ? (
                    <p className="text-slate-400 italic text-[11px]">
                      No attendees recorded.
                    </p>
                  ) : (
                    <ul className="space-y-1">
                      {attendeesPresent.map((a) => (
                        <li
                          key={a.id}
                          className="flex items-center justify-between text-slate-800"
                        >
                          <span className="font-semibold">{a.name}</span>
                          <span className="text-slate-500 text-[10px]">
                            {a.role || "Member"}{" "}
                            {a.attendance === "remote" ? "(Remote)" : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Absentees */}
                <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 space-y-1.5">
                  <p className="font-bold text-slate-800 text-[11px] uppercase">
                    Recorded Absentees ({absentees.length})
                  </p>
                  {absentees.length === 0 ? (
                    <p className="text-slate-400 italic text-[11px]">
                      No absentees recorded.
                    </p>
                  ) : (
                    <ul className="space-y-1">
                      {absentees.map((a) => (
                        <li
                          key={a.id}
                          className="flex items-center justify-between text-slate-800"
                        >
                          <span className="font-semibold">{a.name}</span>
                          <span className="text-slate-500 text-[10px]">
                            {a.role || "Member"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>

            {/* Numbered Agenda */}
            {(doc.agenda || []).length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs uppercase font-extrabold tracking-wider text-slate-700 border-b border-slate-200 pb-1">
                  Meeting Agenda
                </h3>
                <ol className="list-decimal pl-5 space-y-1 text-xs text-black">
                  {doc.agenda.map((ag, idx) => (
                    <li key={ag.id || idx} className="pl-1">
                      <span className="font-bold">{ag.topic}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Meeting Notes Table */}
            <div className="space-y-2">
              <h3 className="text-xs uppercase font-extrabold tracking-wider text-slate-700 border-b border-slate-200 pb-1">
                Deliberations & Action Items
              </h3>
              <div className="border border-slate-300 rounded-xl overflow-hidden">
                <table className="w-full text-xs text-black border-collapse">
                  <thead className="bg-slate-100 border-b border-slate-300">
                    <tr>
                      <th className="py-2 px-3 text-left font-bold text-slate-900 w-1/4 border-r border-slate-200">
                        Agenda Item
                      </th>
                      <th className="py-2 px-3 text-left font-bold text-slate-900 w-2/5 border-r border-slate-200">
                        Discussion Points
                      </th>
                      <th className="py-2 px-3 text-left font-bold text-slate-900 w-2/5">
                        Action Items
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {(doc.meetingNotes || []).length === 0 ? (
                      <tr>
                        <td
                          colSpan={3}
                          className="py-4 text-center text-slate-400 italic"
                        >
                          No deliberations or action items logged.
                        </td>
                      </tr>
                    ) : (
                      doc.meetingNotes.map((row, idx) => (
                        <tr key={row.id || idx} className="align-top">
                          <td className="py-2.5 px-3 font-semibold text-slate-900 border-r border-slate-200">
                            {row.agendaItem || `Item ${idx + 1}`}
                          </td>
                          <td className="py-2.5 px-3 whitespace-pre-line leading-relaxed text-slate-800 border-r border-slate-200">
                            {row.discussionPoints || "—"}
                          </td>
                          <td className="py-2.5 px-3 whitespace-pre-line leading-relaxed text-slate-800">
                            {row.actionItems || "—"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Concluding Remarks / Free Text */}
            {doc.freeTextContent &&
              Object.entries(doc.freeTextContent).map(([k, val]) => (
                <div key={k} className="space-y-1.5 pt-1">
                  <h4 className="text-xs uppercase font-extrabold tracking-wider text-slate-700">
                    Remarks & Next Steps
                  </h4>
                  <p className="text-xs leading-relaxed text-slate-800 whitespace-pre-line">
                    {val}
                  </p>
                </div>
              ))}

            {/* Document Footer */}
            <div className="pt-8 border-t border-slate-300 flex flex-col sm:flex-row items-center justify-between text-[10px] text-slate-500 gap-2">
              <p>Confidential — Generated by TexaWave ERP Project Tracker</p>
              <p>
                {doc.reference} • Rev {doc.currentRevision} • Page 1 of 1
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
