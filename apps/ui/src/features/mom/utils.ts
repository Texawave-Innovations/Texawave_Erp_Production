"use client";

import type {
  MomAdditionalSection,
  MomAgendaItem,
  MomAttendance,
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
/** Safely checks whether two person names match (case-insensitive, whitespace-trimmed).
 * Never throws on undefined, null, or malformed values; returns false if either
 * name is missing, empty, or whitespace-only. */
export function isSamePersonName(a: unknown, b: unknown): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const trimmedA = a.trim();
  const trimmedB = b.trim();
  if (!trimmedA || !trimmedB) return false;
  return trimmedA.toLowerCase() === trimmedB.toLowerCase();
}

/** Normalizes a raw attendee record (e.g. from legacy JSON or API envelopes)
 * so that it always has a valid string id, a string name, and well-formed
 * optional fields without losing data or crashing. */
export function normalizeAttendee(
  raw: unknown,
  fallbackPrefix = "att",
  idx = 0,
): MomAttendee {
  if (!raw || typeof raw !== "object") {
    return {
      id: `${fallbackPrefix}_${idx}_${rowId(fallbackPrefix)}`,
      name: "",
      attendance: "present",
    };
  }
  const obj = raw as Record<string, unknown>;
  const resolvedName =
    typeof obj.name === "string"
      ? obj.name
      : typeof obj.fullName === "string"
        ? obj.fullName
        : typeof obj.attendeeName === "string"
          ? obj.attendeeName
          : "";

  const resolvedRole =
    typeof obj.role === "string"
      ? obj.role
      : typeof obj.designation === "string"
        ? obj.designation
        : undefined;

  const resolvedOrg =
    typeof obj.organization === "string"
      ? obj.organization
      : typeof obj.company === "string"
        ? obj.company
        : undefined;

  const rawAttendance =
    typeof obj.attendance === "string"
      ? obj.attendance.trim().toLowerCase()
      : undefined;

  const resolvedAttendance: MomAttendance =
    rawAttendance === "remote"
      ? "remote"
      : rawAttendance === "absent"
        ? "absent"
        : "present";

  const resolvedId =
    typeof obj.id === "string" && obj.id.trim()
      ? obj.id
      : typeof obj.id === "number"
        ? String(obj.id)
        : `${fallbackPrefix}_${idx}_${(resolvedName || "").replace(/\s+/g, "_") || rowId(fallbackPrefix)}`;

  return {
    ...obj,
    id: resolvedId,
    name: resolvedName,
    role: resolvedRole,
    organization: resolvedOrg,
    attendance: resolvedAttendance,
  };
}

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

/** Attendees saved before the `attendance` field existed count as present.
 * Normalizes case-insensitively so "Present", "Remote", "Absent" match. */
export function attendanceOf(a: MomAttendee): "present" | "remote" | "absent" {
  const att =
    typeof a.attendance === "string" ? a.attendance.trim().toLowerCase() : "";
  if (att === "remote") return "remote";
  if (att === "absent") return "absent";
  return "present";
}

/** Normalizes a raw meeting notes row so that it always has a valid, stable,
 * and unique string `id`, consistent with the existing model and lifecycle,
 * along with string fields and numeric order. */
export function normalizeNoteRow(
  raw: unknown,
  index = 0,
  seenIds: Set<string> = new Set<string>(),
): MomNoteRow {
  if (!raw || typeof raw !== "object") {
    const fallbackId = `nr_${index + 1}`;
    const id = seenIds.has(fallbackId)
      ? `${fallbackId}_${rowId("nr")}`
      : fallbackId;
    seenIds.add(id);
    return {
      id,
      order: index + 1,
      agendaItem: "",
      discussionPoints: "",
      actionItems: "",
    };
  }

  const obj = raw as Record<string, unknown>;
  const order =
    typeof obj.order === "number" && Number.isFinite(obj.order)
      ? obj.order
      : index + 1;

  const agendaItem = typeof obj.agendaItem === "string" ? obj.agendaItem : "";
  const discussionPoints =
    typeof obj.discussionPoints === "string" ? obj.discussionPoints : "";
  const actionItems =
    typeof obj.actionItems === "string" ? obj.actionItems : "";

  let resolvedId =
    typeof obj.id === "string" && obj.id.trim()
      ? obj.id.trim()
      : typeof obj.id === "number"
        ? `nr_${obj.id}`
        : "";

  if (!resolvedId || seenIds.has(resolvedId)) {
    const slug = (agendaItem || discussionPoints || "")
      .trim()
      .slice(0, 16)
      .replace(/\s+/g, "_");
    const candidate = resolvedId
      ? `${resolvedId}_${index + 1}`
      : slug
        ? `nr_${order}_${slug}`
        : `nr_${order}`;
    resolvedId = seenIds.has(candidate)
      ? `${candidate}_${rowId("nr")}`
      : candidate;
  }

  seenIds.add(resolvedId);

  return {
    ...obj,
    id: resolvedId,
    order,
    agendaItem,
    discussionPoints,
    actionItems,
  };
}

export function normalizeNoteRows(rows: unknown): MomNoteRow[] {
  if (!Array.isArray(rows)) return [];
  const seenIds = new Set<string>();
  return rows.map((r, i) => normalizeNoteRow(r, i, seenIds));
}

/** Normalizes a raw agenda item so that it always has a stable, unique ID
 * and numeric order. */
export function normalizeAgendaItem(
  raw: unknown,
  index = 0,
  seenIds: Set<string> = new Set<string>(),
): MomAgendaItem {
  if (!raw || typeof raw !== "object") {
    const fallbackId = `ag_${index + 1}`;
    const id = seenIds.has(fallbackId)
      ? `${fallbackId}_${rowId("ag")}`
      : fallbackId;
    seenIds.add(id);
    return {
      id,
      order: index + 1,
      topic: "",
    };
  }

  const obj = raw as Record<string, unknown>;
  const order =
    typeof obj.order === "number" && Number.isFinite(obj.order)
      ? obj.order
      : index + 1;
  const topic = typeof obj.topic === "string" ? obj.topic : "";

  let resolvedId =
    typeof obj.id === "string" && obj.id.trim()
      ? obj.id.trim()
      : typeof obj.id === "number"
        ? `ag_${obj.id}`
        : "";

  if (!resolvedId || seenIds.has(resolvedId)) {
    const slug = topic.trim().slice(0, 16).replace(/\s+/g, "_");
    const candidate = resolvedId
      ? `${resolvedId}_${index + 1}`
      : slug
        ? `ag_${order}_${slug}`
        : `ag_${order}`;
    resolvedId = seenIds.has(candidate)
      ? `${candidate}_${rowId("ag")}`
      : candidate;
  }

  seenIds.add(resolvedId);

  return {
    ...obj,
    id: resolvedId,
    order,
    topic,
    presenter: typeof obj.presenter === "string" ? obj.presenter : undefined,
    durationMinutes:
      typeof obj.durationMinutes === "number" ? obj.durationMinutes : undefined,
  };
}

export function normalizeAgendaItems(items: unknown): MomAgendaItem[] {
  if (!Array.isArray(items)) return [];
  const seenIds = new Set<string>();
  return items.map((item, i) => normalizeAgendaItem(item, i, seenIds));
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
    attendees: (src.attendeesJson ?? []).map((a, idx) =>
      normalizeAttendee(a, "att", idx),
    ),
    absentees: (src.absenteesJson ?? []).map((a, idx) =>
      normalizeAttendee(a, "abs", idx),
    ),
    agenda: normalizeAgendaItems(src.agendaJson),
    notes: normalizeNoteRows(src.meetingNotesJson),
    freeText: readFreeText(
      sections,
      src.freeTextContent,
      src.additionalSectionsJson,
    ),
    sections,
  };
}
