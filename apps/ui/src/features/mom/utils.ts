"use client";

import type {
  MomAdditionalSection,
  MomAgendaItem,
  MomAttendee,
  MomNoteRow,
  MomDocument,
  MomSectionConfig,
  MomStatus,
} from "@texawave-erp/api-types";
import { usePermission } from "@/hooks/usePermission";
import { useProposalSettings } from "@/features/proposals/hooks";
import { PROPOSALS_READ } from "@/features/proposals/permissions";

let uidCounter = 0;
/** Stable client-side row id for attendee/agenda/note rows (legacy used
 * `att_${Date.now()}_${random}` the same way — ids only need to be unique
 * within one document's JSON column). */
export function rowId(prefix: string): string {
  uidCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${uidCounter}`;
}

export type MomStatusTone = "brand" | "gray" | "success" | "warning" | "error";

export function momStatusLabel(
  doc: Pick<MomDocument, "status" | "workingRevision">,
): string {
  if (doc.status === "finalized" && doc.workingRevision) {
    return `Revision ${doc.workingRevision} in progress`;
  }
  return doc.status.charAt(0).toUpperCase() + doc.status.slice(1);
}

export function momStatusTone(
  doc: Pick<MomDocument, "status" | "workingRevision">,
): MomStatusTone {
  if (doc.status === "finalized" && doc.workingRevision) return "warning";
  const map: Record<MomStatus, MomStatusTone> = {
    draft: "brand",
    finalized: "success",
    archived: "gray",
  };
  return map[doc.status];
}

/** Attendees saved before the `attendance` field existed count as present. */
export function attendanceOf(a: MomAttendee): "present" | "remote" | "absent" {
  return a.attendance ?? "present";
}

/** Legacy `OFFICIAL_TEXAWAVE_MOM_TEMPLATE.sections` — what a document renders
 * when it wasn't issued from a template (mirrors the API's
 * `DEFAULT_MOM_SECTIONS` in apps/api/.../mom/rules/mom-rules.ts). */
export const FALLBACK_MOM_SECTIONS: MomSectionConfig[] = [
  {
    id: "sec_header",
    type: "company_header",
    title: "Company Header",
    order: 1,
    visible: true,
    required: true,
  },
  {
    id: "sec_details",
    type: "meeting_details",
    title: "Meeting Details & Context",
    order: 2,
    visible: true,
    required: true,
  },
  {
    id: "sec_people",
    type: "people_lists",
    title: "Meeting Attendance & Quorum",
    order: 3,
    visible: true,
    required: true,
  },
  {
    id: "sec_agenda",
    type: "agenda_list",
    title: "Numbered Agenda Topics",
    order: 4,
    visible: true,
    required: true,
  },
  {
    id: "sec_notes",
    type: "meeting_notes_table",
    title: "Deliberations & Action Items",
    order: 5,
    visible: true,
    required: true,
  },
  {
    id: "sec_summary",
    type: "free_text",
    title: "Executive Summary & Next Steps",
    order: 6,
    visible: true,
    required: false,
  },
];

/** A document's section layout: the template snapshot frozen at issue time,
 * else the fallback set. Always sorted and limited to visible sections. */
export function documentSections(snapshot: unknown): MomSectionConfig[] {
  const source =
    Array.isArray(snapshot) && snapshot.length > 0
      ? (snapshot as MomSectionConfig[])
      : FALLBACK_MOM_SECTIONS;
  return [...source].filter((s) => s.visible).sort((a, b) => a.order - b.order);
}

export interface MomCompanyHeader {
  companyName: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  logoUrl: string | null;
}

/** Company branding for the MoM sheet. Reuses the organization's
 * Proposal Settings branding (the only company-profile record the Projects
 * module has) when the viewer may read it; otherwise just the org name. */
export function useMomCompanyHeader(): MomCompanyHeader {
  const canReadProposals = usePermission(PROPOSALS_READ);
  const settings = useProposalSettings({ enabled: canReadProposals });
  const s = settings.data;
  return {
    companyName: s?.companyName || "TexaWave Innovations",
    email: s?.email ?? null,
    phone: s?.phone ?? null,
    website: s?.website ?? null,
    address: s?.address ?? null,
    logoUrl: s?.logoUrl ?? null,
  };
}

export function formatTimeRange(
  start: string | null | undefined,
  end: string | null | undefined,
  timezone: string | null | undefined,
): string {
  if (!start && !end) return "—";
  const range = `${start || "—"} – ${end || "—"}`;
  return timezone ? `${range} (${timezone})` : range;
}

/** Free-text section values keyed by section id. The first `free_text`
 * section is stored in `freeTextContent`; any further ones (legacy kept a
 * `Record<sectionId, string>`) are stored as `rich_text` entries in
 * `additionalSectionsJson`, so no schema change is needed. */
export function readFreeText(
  sections: MomSectionConfig[],
  freeTextContent: string | null | undefined,
  additionalSections: unknown,
): Record<string, string> {
  const extras = Array.isArray(additionalSections)
    ? (additionalSections as Array<{ id?: unknown; content?: unknown }>)
    : [];
  const result: Record<string, string> = {};
  sections
    .filter((s) => s.type === "free_text")
    .forEach((s, index) => {
      if (index === 0) {
        result[s.id] = freeTextContent ?? "";
      } else {
        const match = extras.find((e) => e.id === s.id);
        result[s.id] = typeof match?.content === "string" ? match.content : "";
      }
    });
  return result;
}

export function writeFreeText(
  sections: MomSectionConfig[],
  values: Record<string, string>,
): {
  freeTextContent: string | undefined;
  additionalSectionsJson: MomAdditionalSection[];
} {
  const freeSections = sections.filter((s) => s.type === "free_text");
  const [first, ...rest] = freeSections;
  return {
    freeTextContent: first ? values[first.id]?.trim() || undefined : undefined,
    additionalSectionsJson: rest.map((s) => ({
      id: s.id,
      title: s.title,
      contentType: "rich_text" as const,
      order: s.order,
      content: values[s.id] ?? "",
    })),
  };
}

/** View model for `MomDocumentSheet` (the printable document). */
export interface MomSheetData {
  reference: string;
  statusLabel: string;
  isDraft: boolean;
  revision: number;
  templateTitle: string | null;
  templateVersion: number | null;
  meetingTitle: string;
  meetingDate: string;
  startTime: string | null;
  endTime: string | null;
  timezone: string | null;
  location: string | null;
  projectCode: string | null;
  projectName: string | null;
  clientName: string | null;
  attendees: MomAttendee[];
  absentees: MomAttendee[];
  agenda: MomAgendaItem[];
  notes: MomNoteRow[];
  freeText: Record<string, string>;
  sections: MomSectionConfig[];
}

/** Fields a revision snapshot carries (what `POST /mom/:id/revisions/start`
 * freezes — see MomDocumentsService.startRevision). */
export interface MomRevisionSnapshot {
  meetingTitle?: string;
  meetingDate?: string;
  startTime?: string | null;
  endTime?: string | null;
  timezone?: string | null;
  location?: string | null;
  attendeesJson?: MomAttendee[];
  absenteesJson?: MomAttendee[];
  agendaJson?: MomDocument["agendaJson"];
  meetingNotesJson?: MomDocument["meetingNotesJson"];
  additionalSectionsJson?: unknown[];
  freeTextContent?: string | null;
  currentRevision?: number;
}

/** Builds the printable sheet model from a saved document, optionally
 * overlaid with an older revision's snapshot. */
export function toSheetData(
  doc: MomDocument,
  snapshot?: MomRevisionSnapshot,
): MomSheetData {
  const sections = documentSections(doc.templateSnapshot);
  const src = { ...doc, ...(snapshot ?? {}) };
  const revision = snapshot?.currentRevision ?? doc.currentRevision;
  return {
    reference: doc.reference,
    statusLabel: snapshot ? "Superseded" : momStatusLabel(doc),
    isDraft:
      !snapshot && (doc.status === "draft" || Boolean(doc.workingRevision)),
    revision,
    templateTitle: doc.templateTitle,
    templateVersion: doc.templateVersion,
    meetingTitle: src.meetingTitle,
    meetingDate: src.meetingDate,
    startTime: src.startTime ?? null,
    endTime: src.endTime ?? null,
    timezone: src.timezone ?? null,
    location: src.location ?? null,
    projectCode: doc.projectCode,
    projectName: doc.projectName,
    clientName: doc.clientName,
    attendees: src.attendeesJson ?? [],
    absentees: src.absenteesJson ?? [],
    agenda: src.agendaJson ?? [],
    notes: src.meetingNotesJson ?? [],
    freeText: readFreeText(
      sections,
      src.freeTextContent,
      src.additionalSectionsJson,
    ),
    sections,
  };
}
