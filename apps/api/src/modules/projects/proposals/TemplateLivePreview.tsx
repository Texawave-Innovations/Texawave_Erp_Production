import React from "react";
import { ProposalTemplate, ProposalSectionConfig } from "../proposalTypes";
import { CONTENT_TYPE_INFO } from "./SectionConfigDrawer";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Building2,
  Calendar,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";

interface TemplateLivePreviewProps {
  template: ProposalTemplate;
  sections: ProposalSectionConfig[];
}

export default function TemplateLivePreview({
  template,
  sections,
}: TemplateLivePreviewProps) {
  const activeSections = sections.filter((s) => s.isEnabled !== false);

  return (
    <div className="bg-slate-100 rounded-3xl p-6 border border-slate-200/80 flex flex-col">
      {/* Top Preview Bar (Static Header) */}
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200 text-xs text-slate-500 font-medium">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-bold text-slate-700">
            Live Document Preview
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-white text-[10px] font-mono">
            {template.code} • {template.version}
          </Badge>
          <span className="text-[11px] text-slate-400">
            A4 Document Simulation
          </span>
        </div>
      </div>

      {/* Scrollable Preview Area */}
      <div className="max-h-[calc(100vh-210px)] overflow-y-auto scroll-smooth pr-1">
        {/* Simulated A4 Page */}
        <div className="bg-white shadow-xl rounded-2xl border border-slate-300 p-8 sm:p-10 flex-1 flex flex-col space-y-8 max-w-2xl mx-auto w-full relative overflow-hidden text-black">
          {/* Document Header Accent */}
          <div
            style={{
              background:
                "linear-gradient(135deg, #4D9F4B 0%, #72B84A 50%, #9FCA48 100%)",
            }}
            className="h-2 w-full absolute top-0 left-0 right-0"
          />

          {/* Company & Proposal Header matching Official Clean Specification */}
          <div className="relative pb-5 border-b border-slate-300">
            {/* Center: Company Name & Proposal Title */}
            <div className="text-center px-20 space-y-1">
              <p className="text-base font-serif text-black font-bold tracking-normal">
                TexaWave Innovations Pvt Ltd
              </p>
              <h1 className="text-xl font-serif font-black text-black tracking-tight">
                {template.name || "Client Proposal & Statement of Work"}
              </h1>
            </div>

            {/* Right Aligned Official Logo */}
            <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center justify-end">
              <img
                src="/Texa_Logo.jpeg"
                alt="TexaWave Logo"
                className="h-16 object-contain max-w-[170px]"
              />
            </div>
          </div>

          {/* Sections Simulation */}
          {activeSections.length === 0 ? (
            <div className="py-24 text-center space-y-3">
              <div className="h-12 w-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <FileText className="h-6 w-6" />
              </div>
              <p className="text-sm font-bold text-black">
                No sections configured yet
              </p>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Add your first section on the left to watch this live proposal
                document preview update in real-time.
              </p>
            </div>
          ) : (
            <div className="space-y-6 text-black">
              {activeSections.map((sec, idx) => {
                const typeInfo =
                  CONTENT_TYPE_INFO[sec.contentType] ||
                  CONTENT_TYPE_INFO.rich_text;
                const sectionNumber =
                  sec.showSectionNumber !== false ? `${idx + 1}.0 ` : "";

                if (sec.contentType === "page_break") {
                  return (
                    <div
                      key={sec.id}
                      id={`template-preview-sec-${sec.id}`}
                      className="py-4 my-2 border-y border-dashed border-emerald-300 bg-emerald-50/40 text-center text-xs font-mono text-emerald-800 flex items-center justify-center gap-2 rounded-lg"
                    >
                      <span>✂ ─── PAGE BREAK (PDF Page {idx + 2}) ───</span>
                    </div>
                  );
                }

                if (sec.contentType === "spacer") {
                  return (
                    <div
                      key={sec.id}
                      id={`template-preview-sec-${sec.id}`}
                      className="h-8 border-b border-dashed border-slate-300 flex items-center justify-center text-[10px] text-slate-400 font-mono"
                    >
                      ↕ Spacer (2rem)
                    </div>
                  );
                }

                return (
                  <div
                    key={sec.id}
                    id={`template-preview-sec-${sec.id}`}
                    className="space-y-2.5 p-2 rounded-xl transition-all duration-300 text-black"
                  >
                    {/* Section Title */}
                    <div className="flex items-center justify-between border-b border-slate-300 pb-1.5">
                      <h3 className="text-sm font-bold text-black tracking-tight flex items-center gap-1.5">
                        <span className="text-emerald-700 font-bold">
                          {sectionNumber}
                        </span>
                        {sec.title}
                        {sec.isRequired && (
                          <span className="text-rose-500 text-xs">*</span>
                        )}
                      </h3>
                      <Badge
                        variant="outline"
                        className="text-[9px] font-bold text-black border-slate-300"
                      >
                        {typeInfo.label}
                      </Badge>
                    </div>

                    {/* Section Content Preview Renderer */}
                    <div className="text-xs text-black pl-2">
                      {sec.contentType === "rich_text" ||
                      sec.contentType === "paragraph" ? (
                        <div className="space-y-2">
                          <p className="text-black leading-relaxed">
                            {sec.defaultContent ||
                              sec.placeholder ||
                              "Sample descriptive content formatted according to this section. Users will enter proposal-specific rich formatted text when creating documents from this template."}
                          </p>
                        </div>
                      ) : sec.contentType === "short_text" ? (
                        <div className="p-2 bg-slate-50 border border-slate-300 rounded-lg text-black font-bold text-[11px]">
                          {sec.defaultContent ||
                            sec.placeholder ||
                            "[ Single-line short text input ]"}
                        </div>
                      ) : sec.contentType === "long_text" ? (
                        <div className="p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-black text-[11px] leading-relaxed">
                          {sec.defaultContent ||
                            sec.placeholder ||
                            "[ Multi-line narrative entered during proposal creation ]"}
                        </div>
                      ) : sec.contentType === "bullet_list" ? (
                        <ul className="list-disc pl-5 space-y-1 text-black">
                          {sec.defaultItems && sec.defaultItems.length > 0 ? (
                            sec.defaultItems.map((it, i) => (
                              <li key={i}>{it}</li>
                            ))
                          ) : (
                            <>
                              <li>
                                Comprehensive technical requirements & system
                                architecture specifications
                              </li>
                              <li>
                                High-precision fabrication and quality assurance
                                standards
                              </li>
                              <li>
                                Deliverables validation and client sign-off
                                protocol
                              </li>
                            </>
                          )}
                        </ul>
                      ) : sec.contentType === "numbered_list" ? (
                        <ol className="list-decimal pl-5 space-y-1 text-black">
                          {sec.defaultItems && sec.defaultItems.length > 0 ? (
                            sec.defaultItems.map((it, i) => (
                              <li key={i}>{it}</li>
                            ))
                          ) : (
                            <>
                              <li>
                                Phase 1: Project kickoff and baseline
                                requirements discovery
                              </li>
                              <li>
                                Phase 2: Detailed engineering design and
                                prototype modeling
                              </li>
                              <li>
                                Phase 3: Integration testing, deployment and
                                handover
                              </li>
                            </>
                          )}
                        </ol>
                      ) : sec.contentType === "key_value" ? (
                        <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-300 text-black">
                          {sec.keyValueFields &&
                          sec.keyValueFields.length > 0 ? (
                            sec.keyValueFields.map((field) => (
                              <div key={field.id} className="text-[11px]">
                                <span className="font-bold text-black">
                                  {field.label}:
                                </span>{" "}
                                <span className="text-black">
                                  {field.defaultValue ||
                                    field.placeholder ||
                                    "[Value]"}
                                </span>
                                {field.required && (
                                  <span className="text-rose-500 text-[10px] ml-0.5">
                                    *
                                  </span>
                                )}
                              </div>
                            ))
                          ) : (
                            <>
                              <div>
                                <span className="font-bold text-black">
                                  Project Title:
                                </span>{" "}
                                Mechanical Engineering Proposal
                              </div>
                              <div>
                                <span className="font-bold text-black">
                                  Client:
                                </span>{" "}
                                Industrial Dynamics Ltd
                              </div>
                              <div>
                                <span className="font-bold text-black">
                                  Version:
                                </span>{" "}
                                V1.0
                              </div>
                              <div>
                                <span className="font-bold text-black">
                                  Date:
                                </span>{" "}
                                {new Date().toLocaleDateString("en-GB")}
                              </div>
                            </>
                          )}
                        </div>
                      ) : sec.contentType === "table" ? (
                        <div className="space-y-1.5 mt-1">
                          {sec.tableTitle && sec.tableTitle !== sec.title && (
                            <h4 className="text-xs font-bold text-black">
                              {sec.tableTitle}
                            </h4>
                          )}
                          <div className="border border-slate-300 rounded-xl overflow-hidden shadow-xs">
                            <table className="w-full text-[11px] text-black">
                              <thead className="bg-slate-100 text-black font-extrabold border-b border-slate-300">
                                <tr>
                                  {(sec.tableColumns &&
                                  sec.tableColumns.length > 0
                                    ? sec.tableColumns
                                    : [
                                        {
                                          id: "1",
                                          name: "Milestone",
                                          type: "text",
                                        },
                                        {
                                          id: "2",
                                          name: "Duration",
                                          type: "text",
                                        },
                                        {
                                          id: "3",
                                          name: "End Date",
                                          type: "date",
                                        },
                                        {
                                          id: "4",
                                          name: "Amount (₹)",
                                          type: "currency",
                                        },
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
                              <tbody className="divide-y divide-slate-200 text-black bg-white">
                                <tr>
                                  <td className="py-2 px-3">
                                    Kickoff & System Architecture
                                  </td>
                                  <td className="py-2 px-3">2 Weeks</td>
                                  <td className="py-2 px-3">15/10/2026</td>
                                  <td className="py-2 px-3 font-bold text-black">
                                    ₹1,50,000
                                  </td>
                                </tr>
                                <tr>
                                  <td className="py-2 px-3">
                                    Fabrication & Prototype Assembly
                                  </td>
                                  <td className="py-2 px-3">4 Weeks</td>
                                  <td className="py-2 px-3">15/11/2026</td>
                                  <td className="py-2 px-3 font-bold text-black">
                                    ₹2,85,000
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : sec.contentType === "section_group" ? (
                        <div className="space-y-4 pt-1">
                          {sec.subsections && sec.subsections.length > 0 ? (
                            sec.subsections.map((sub, sIdx) => (
                              <div
                                key={sub.id}
                                className="p-3.5 bg-slate-50/70 rounded-xl border border-slate-300 space-y-2 text-black"
                              >
                                <h4 className="text-xs font-bold text-black flex items-center gap-1.5">
                                  <span className="text-emerald-700 font-mono text-[11px] font-bold">{`${idx + 1}.${sIdx + 1}`}</span>
                                  {sub.title}
                                </h4>
                                {sub.contentType === "bullet_list" ? (
                                  <ul className="list-disc pl-5 space-y-1 text-black text-[11px]">
                                    {sub.defaultItems &&
                                    sub.defaultItems.length > 0 ? (
                                      sub.defaultItems.map((it, i) => (
                                        <li key={i}>{it}</li>
                                      ))
                                    ) : (
                                      <>
                                        <li>
                                          Core functional deliverable module
                                        </li>
                                        <li>
                                          Engineering design documentation
                                        </li>
                                      </>
                                    )}
                                  </ul>
                                ) : (
                                  <p className="text-[11px] text-black">
                                    {sub.defaultContent ||
                                      "Nested subsection content block."}
                                  </p>
                                )}
                              </div>
                            ))
                          ) : (
                            <div className="p-3 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-slate-500 text-center text-[11px]">
                              No subsections defined in this section group.
                            </div>
                          )}
                        </div>
                      ) : sec.contentType === "checklist" ? (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 text-black">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            <span>
                              Design and structural safety compliance verified
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-slate-700">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            <span>
                              Environmental & raw material certifications
                              attached
                            </span>
                          </div>
                        </div>
                      ) : sec.contentType === "signature" ? (
                        <div className="grid grid-cols-2 gap-6 pt-4 mt-2 border-t border-slate-100">
                          <div className="space-y-2">
                            <p className="text-[10px] font-bold uppercase text-slate-400">
                              Authorized Signatory (Provider)
                            </p>
                            <div className="h-12 border-b-2 border-slate-300 flex items-end pb-1 font-serif italic text-slate-700">
                              TexaWave Innovations Signatory
                            </div>
                            <div className="text-[10px] text-slate-500 space-y-0.5">
                              {sec.signatureFields &&
                              sec.signatureFields.length > 0 ? (
                                sec.signatureFields.map((f) => (
                                  <span key={f.id} className="mr-2">
                                    <strong>{f.label}:</strong>{" "}
                                    {f.type === "date"
                                      ? new Date().toLocaleDateString("en-GB")
                                      : "[Entry]"}
                                  </span>
                                ))
                              ) : (
                                <p>
                                  Name: Lead Project Engineer | Date:{" "}
                                  {new Date().toLocaleDateString("en-GB")}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <p className="text-[10px] font-bold uppercase text-slate-400">
                              Client Acceptance Authorization
                            </p>
                            <div className="h-12 border-b-2 border-slate-300 flex items-end pb-1 text-slate-300 text-[10px]">
                              Sign Here / Company Seal
                            </div>
                            <div className="text-[10px] text-slate-500 space-y-0.5">
                              {sec.signatureFields &&
                              sec.signatureFields.length > 0 ? (
                                sec.signatureFields.map((f) => (
                                  <span key={f.id} className="mr-2">
                                    <strong>{f.label}:</strong> [Client{" "}
                                    {f.label}]
                                  </span>
                                ))
                              ) : (
                                <p>
                                  Name: Client Authorized Signatory | Date:
                                  DD/MM/YYYY
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : sec.contentType === "image" ? (
                        <div
                          className={`space-y-1.5 flex flex-col ${
                            sec.imageAlignment === "left"
                              ? "items-start"
                              : sec.imageAlignment === "right"
                                ? "items-end"
                                : "items-center"
                          }`}
                        >
                          {sec.imageUrl ? (
                            <img
                              src={sec.imageUrl}
                              alt={sec.imageCaption || "Diagram"}
                              style={{ maxWidth: sec.imageMaxWidth || "100%" }}
                              className="rounded-xl border border-slate-200 shadow-xs max-h-56 object-contain"
                            />
                          ) : (
                            <div
                              style={{
                                width: sec.imageMaxWidth || "100%",
                                maxWidth: "100%",
                              }}
                              className="h-28 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-slate-400 gap-1"
                            >
                              <Building2 className="h-6 w-6" />
                              <span className="text-[11px]">
                                Dynamic Image Placeholder / Schematic
                              </span>
                            </div>
                          )}
                          {sec.imageCaption && (
                            <p className="text-[10px] text-slate-400 italic text-center">
                              {sec.imageCaption}
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-slate-500 italic">
                          Section content configured for this block.
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer */}
          <div className="pt-8 mt-auto border-t border-slate-100 text-center text-[10px] text-slate-400 flex items-center justify-between">
            <span>
              {template.name} ({template.code})
            </span>
            <span>Confidential • Prepared with TexaWave Proposal Builder</span>
          </div>
        </div>
      </div>
    </div>
  );
}
