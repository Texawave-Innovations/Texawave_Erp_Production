"use client";

import { formatDate } from "@/features/projects/format";
import {
  attendanceOf,
  formatTimeRange,
  type MomSheetData,
  useMomCompanyHeader,
} from "../utils";

export type { MomSheetData };

/** Read-only, print-friendly rendering of one MoM (legacy
 * `MomPreviewModal.tsx` document body). Sections follow the document's
 * template snapshot order/visibility. Uses plain light-surface colors on
 * purpose: this is the paper copy, printed or saved as PDF. */
/**
 * Resolves a stable, guaranteed unique React key for an item in a list.
 * Prefers the item's persisted `id`.
 * Falls back to a deterministic string constructed from model fields (e.g. name, role, topic).
 * Disambiguates duplicate keys with the index if already seen in the current render.
 */
function getUniqueItemKey(
  id: unknown,
  fallbackText: unknown,
  index: number,
  prefix: string,
  seen: Set<string>,
): string {
  const cleanId =
    id !== null && id !== undefined && String(id).trim()
      ? String(id).trim()
      : null;
  const cleanText =
    fallbackText !== null &&
    fallbackText !== undefined &&
    String(fallbackText).trim()
      ? String(fallbackText).trim().replace(/\s+/g, "_")
      : null;

  const baseKey = cleanId
    ? `${prefix}-${cleanId}`
    : cleanText
      ? `${prefix}-${cleanText}`
      : `${prefix}-${index}`;

  if (!seen.has(baseKey)) {
    seen.add(baseKey);
    return baseKey;
  }

  const uniqueKey = `${baseKey}-${index}`;
  seen.add(uniqueKey);
  return uniqueKey;
}

export function MomDocumentSheet({ data }: { data: MomSheetData }) {
  const company = useMomCompanyHeader();
  const present = data.attendees.filter((a) => attendanceOf(a) !== "absent");
  const seenSectionKeys = new Set<string>();
  const seenPresentKeys = new Set<string>();
  const seenAbsentKeys = new Set<string>();
  const seenAgendaKeys = new Set<string>();
  const seenNotesKeys = new Set<string>();

  return (
    <article className="relative mx-auto w-full max-w-4xl bg-white p-6 text-gray-900 sm:p-10">
      <div className="relative flex flex-col gap-6">
        {data.sections.map((section, sIdx) => {
          const sectionKey = getUniqueItemKey(
            section.id,
            section.type,
            sIdx,
            "sec",
            seenSectionKeys,
          );
          switch (section.type) {
            case "company_header":
              return (
                <header
                  key={sectionKey}
                  className="flex flex-col items-start justify-between gap-4 border-b-2 border-brand-600 pb-4 sm:flex-row sm:items-center"
                >
                  <div>
                    <h1 className="text-xl font-extrabold tracking-tight">
                      {company.companyName}
                    </h1>
                    {company.email || company.phone ? (
                      <p className="text-theme-xs text-gray-600">
                        {[
                          company.email && `Email: ${company.email}`,
                          company.phone && `Phone: ${company.phone}`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    ) : null}
                    {company.address ? (
                      <p className="text-theme-xs text-gray-500">
                        {company.address}
                      </p>
                    ) : null}
                  </div>
                  {company.logoUrl ? (
                    // Plain <img>: a tenant-configured logo URL of unknown host
                    // (next/image would need every host allow-listed).
                    <img
                      src={company.logoUrl}
                      alt={`${company.companyName} logo`}
                      className="h-12 max-w-[160px] object-contain"
                    />
                  ) : null}
                </header>
              );
            case "meeting_details":
              return (
                <section key={sectionKey} className="flex flex-col gap-3">
                  <div className="text-center">
                    <p className="text-theme-xs font-bold uppercase tracking-widest text-brand-700">
                      Minutes of Meeting
                    </p>
                    <h2 className="mt-1 text-2xl font-extrabold">
                      {data.meetingTitle || "Untitled Meeting"}
                    </h2>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4 text-theme-sm sm:grid-cols-4">
                    <SheetField label="MoM Reference" value={data.reference} />
                    <SheetField
                      label="Meeting Date"
                      value={formatDate(data.meetingDate)}
                    />
                    <SheetField
                      label="Time"
                      value={formatTimeRange(
                        data.startTime,
                        data.endTime,
                        data.timezone,
                      )}
                    />
                    <SheetField
                      label="Document Revision"
                      value={`Rev ${data.revision} · ${data.statusLabel}`}
                    />
                    <SheetField
                      label="Linked Project"
                      value={
                        data.projectName
                          ? `${data.projectName}${data.projectCode ? ` (${data.projectCode})` : ""}`
                          : "—"
                      }
                    />
                    <SheetField label="Client" value={data.clientName || "—"} />
                    <SheetField
                      label="Location / Link"
                      value={data.location || "—"}
                    />
                    <SheetField
                      label="Template"
                      value={
                        data.templateTitle
                          ? `${data.templateTitle}${data.templateVersion ? ` (V${data.templateVersion})` : ""}`
                          : "Standard"
                      }
                    />
                  </dl>
                </section>
              );
            case "people_lists":
              return (
                <section key={sectionKey} className="flex flex-col gap-2">
                  <SheetHeading>{section.title}</SheetHeading>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <p className="mb-1 text-theme-xs font-semibold uppercase text-gray-500">
                        Present ({present.length})
                      </p>
                      {present.length === 0 ? (
                        <p className="text-theme-sm italic text-gray-500">
                          None recorded.
                        </p>
                      ) : (
                        <ul className="list-disc pl-5 text-theme-sm">
                          {present.map((p, pIdx) => (
                            <li
                              key={getUniqueItemKey(
                                p.id,
                                `${p.name}_${p.role || ""}_${p.organization || ""}`,
                                pIdx,
                                "pres",
                                seenPresentKeys,
                              )}
                            >
                              <span className="font-semibold">{p.name}</span>
                              {p.role ? `, ${p.role}` : ""}
                              {p.organization ? ` (${p.organization})` : ""}
                              {attendanceOf(p) === "remote" ? " — remote" : ""}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div>
                      <p className="mb-1 text-theme-xs font-semibold uppercase text-gray-500">
                        Absent ({data.absentees.length})
                      </p>
                      {data.absentees.length === 0 ? (
                        <p className="text-theme-sm italic text-gray-500">
                          None recorded.
                        </p>
                      ) : (
                        <ul className="list-disc pl-5 text-theme-sm">
                          {data.absentees.map((p, aIdx) => (
                            <li
                              key={getUniqueItemKey(
                                p.id,
                                `${p.name}_${p.role || ""}_${p.organization || ""}`,
                                aIdx,
                                "abs",
                                seenAbsentKeys,
                              )}
                            >
                              <span className="font-semibold">{p.name}</span>
                              {p.role ? `, ${p.role}` : ""}
                              {p.organization ? ` (${p.organization})` : ""}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </section>
              );
            case "agenda_list": {
              const agenda = [...data.agenda].sort((a, b) => a.order - b.order);
              return (
                <section key={sectionKey} className="flex flex-col gap-2">
                  <SheetHeading>{section.title}</SheetHeading>
                  {agenda.length === 0 ? (
                    <p className="text-theme-sm italic text-gray-500">
                      No agenda topics recorded.
                    </p>
                  ) : (
                    <ol className="list-decimal pl-5 text-theme-sm">
                      {agenda.map((a, agIdx) => (
                        <li
                          key={getUniqueItemKey(
                            a.id,
                            a.topic,
                            agIdx,
                            "agenda",
                            seenAgendaKeys,
                          )}
                        >
                          {a.topic}
                          {a.presenter ? ` — ${a.presenter}` : ""}
                          {a.durationMinutes
                            ? ` (${a.durationMinutes} min)`
                            : ""}
                        </li>
                      ))}
                    </ol>
                  )}
                </section>
              );
            }
            case "meeting_notes_table": {
              const notes = [...data.notes].sort((a, b) => a.order - b.order);
              return (
                <section key={sectionKey} className="flex flex-col gap-2">
                  <SheetHeading>{section.title}</SheetHeading>
                  <table className="w-full border-collapse text-left text-theme-sm">
                    <thead>
                      <tr className="bg-gray-100 text-theme-xs uppercase text-gray-600">
                        <th className="w-12 border border-gray-300 px-2 py-1.5 text-center">
                          S.No
                        </th>
                        <th className="w-1/4 border border-gray-300 px-2 py-1.5">
                          Agenda Item
                        </th>
                        <th className="border border-gray-300 px-2 py-1.5">
                          Discussion Points
                        </th>
                        <th className="border border-gray-300 px-2 py-1.5">
                          Action Items
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {notes.length === 0 ? (
                        <tr>
                          <td
                            colSpan={4}
                            className="border border-gray-300 px-2 py-3 text-center italic text-gray-500"
                          >
                            No meeting notes recorded.
                          </td>
                        </tr>
                      ) : (
                        notes.map((n, i) => (
                          <tr
                            key={getUniqueItemKey(
                              n.id,
                              n.agendaItem || n.discussionPoints,
                              i,
                              "note",
                              seenNotesKeys,
                            )}
                            className="align-top"
                          >
                            <td className="border border-gray-300 px-2 py-1.5 text-center">
                              {i + 1}
                            </td>
                            <td className="whitespace-pre-wrap border border-gray-300 px-2 py-1.5 font-semibold">
                              {n.agendaItem || "—"}
                            </td>
                            <td className="whitespace-pre-wrap border border-gray-300 px-2 py-1.5">
                              {n.discussionPoints || "—"}
                            </td>
                            <td className="whitespace-pre-wrap border border-gray-300 px-2 py-1.5">
                              {n.actionItems || "—"}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </section>
              );
            }
            case "free_text":
              return (
                <section key={sectionKey} className="flex flex-col gap-2">
                  <SheetHeading>{section.title}</SheetHeading>
                  <p className="whitespace-pre-wrap text-theme-sm text-gray-800">
                    {data.freeText[section.id]?.trim() || "—"}
                  </p>
                </section>
              );
            default:
              return null;
          }
        })}

        <footer className="mt-4 border-t border-gray-200 pt-3 text-center text-theme-xs text-gray-500">
          {data.reference} · Revision {data.revision} · {company.companyName}
          {company.website ? ` · ${company.website}` : ""}
        </footer>
      </div>
    </article>
  );
}

function SheetHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="border-b border-gray-200 pb-1 text-theme-xs font-extrabold uppercase tracking-wider text-gray-700">
      {children}
    </h3>
  );
}

function SheetField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-theme-xs font-semibold uppercase text-gray-500">
        {label}
      </dt>
      <dd className="break-words font-semibold text-gray-900">{value}</dd>
    </div>
  );
}
