/**
 * Pure MoM business rules — ported from legacy `mom/utils/momValidation.ts`
 * and `mom/types/mom.ts` (`OFFICIAL_TEXAWAVE_MOM_TEMPLATE`). No I/O here so
 * they are unit-testable without Prisma (see mom-rules.spec.ts).
 */

export type MomAttendance = "present" | "remote" | "absent";

interface AttendeeLike {
  name?: unknown;
  attendance?: unknown;
}

interface NoteRowLike {
  agendaItem?: unknown;
  discussionPoints?: unknown;
  actionItems?: unknown;
}

export interface MomFinalizeInput {
  projectId: number | null;
  meetingTitle: string;
  meetingDate: Date | string | null;
  startTime: string | null;
  endTime: string | null;
  location?: string | null;
  attendeesJson: unknown;
  meetingNotesJson: unknown;
}

function hasText(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed as T[];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Legacy `validateMomFinalize` — a MoM can only be finalized once it is a
 * complete record: linked project, title, date, start/end time, at least one
 * attendee present or remote, and at least one non-empty notes row.
 * Attendees saved before the `attendance` field existed count as present.
 * Returns the list of human-readable problems (empty = valid).
 */
export function validateMomFinalize(doc: MomFinalizeInput): string[] {
  const errors: string[] = [];

  if (!doc.projectId) errors.push("A linked project must be selected.");
  if (!hasText(doc.meetingTitle)) errors.push("Meeting title is required.");
  if (!doc.meetingDate) errors.push("Meeting date is required to finalize.");
  if (!hasText(doc.startTime)) {
    errors.push("Meeting start time is required to finalize.");
  }
  if (!hasText(doc.endTime)) {
    errors.push("Meeting end time is required to finalize.");
  }
  if (
    hasText(doc.startTime) &&
    hasText(doc.endTime) &&
    (doc.endTime as string) <= (doc.startTime as string)
  ) {
    errors.push("Meeting end time must be after the start time.");
  }
  if (!hasText(doc.location)) {
    errors.push("Meeting location or virtual link is required to finalize.");
  }

  const present = asArray<AttendeeLike>(doc.attendeesJson).filter(
    (a) =>
      hasText(a.name) &&
      (a.attendance === undefined ||
        a.attendance === "present" ||
        a.attendance === "remote"),
  );
  if (present.length === 0) {
    errors.push("At least one attendee must be marked as present or remote.");
  }

  const hasNotes = asArray<NoteRowLike>(doc.meetingNotesJson).some(
    (n) =>
      hasText(n.agendaItem) ||
      hasText(n.discussionPoints) ||
      hasText(n.actionItems),
  );
  if (!hasNotes) {
    errors.push(
      "At least one meeting notes row with discussion points or action items is required.",
    );
  }

  return errors;
}

/** Legacy `OFFICIAL_TEXAWAVE_MOM_TEMPLATE.sections` — used when a template is
 * created without an explicit section schema (legacy `createMomTemplate`
 * cloned the official template's sections the same way). */
export const DEFAULT_MOM_SECTIONS = [
  {
    id: "sec_header",
    type: "company_header",
    title: "Company Header",
    order: 1,
    visible: true,
    required: true,
    description: "Official corporate branding, contact details, and logo.",
  },
  {
    id: "sec_details",
    type: "meeting_details",
    title: "Meeting Details & Context",
    order: 2,
    visible: true,
    required: true,
    description:
      "Title, linked project, date, start/end time, timezone, and location.",
  },
  {
    id: "sec_people",
    type: "people_lists",
    title: "Meeting Attendance & Quorum",
    order: 3,
    visible: true,
    required: true,
    description: "List of attendees present or remote, and recorded absentees.",
  },
  {
    id: "sec_agenda",
    type: "agenda_list",
    title: "Numbered Agenda Topics",
    order: 4,
    visible: true,
    required: true,
    description:
      "Sequential order of agenda items to be addressed during the meeting.",
  },
  {
    id: "sec_notes",
    type: "meeting_notes_table",
    title: "Deliberations & Action Items",
    order: 5,
    visible: true,
    required: true,
    description:
      "Structured record of discussion points and action items mapped to agenda topics.",
  },
  {
    id: "sec_summary",
    type: "free_text",
    title: "Executive Summary & Next Steps",
    order: 6,
    visible: true,
    required: false,
    description:
      "Concluding remarks, agreed milestones, and next meeting scheduling note.",
    defaultContent:
      "All decisions recorded during this meeting were reviewed and acknowledged by the attending members. Progress on assigned action items will be reviewed at the subsequent checkpoint.",
  },
];

export const DEFAULT_MOM_AGENDA = [
  {
    id: "ag_1",
    order: 1,
    topic: "Review of Previous Action Items & Milestones",
  },
  { id: "ag_2", order: 2, topic: "Technical Progress & Engineering Updates" },
  { id: "ag_3", order: 3, topic: "Risk Mitigation & Schedule Dependencies" },
  { id: "ag_4", order: 4, topic: "Next Steps & Next Meeting Scheduling" },
];

export const DEFAULT_MOM_NOTE_ROWS = [
  {
    id: "nr_1",
    order: 1,
    agendaItem: "Review of Previous Action Items & Milestones",
    discussionPoints: "",
    actionItems: "",
  },
  {
    id: "nr_2",
    order: 2,
    agendaItem: "Technical Progress & Engineering Updates",
    discussionPoints: "",
    actionItems: "",
  },
  {
    id: "nr_3",
    order: 3,
    agendaItem: "Next Steps & Next Meeting Scheduling",
    discussionPoints: "",
    actionItems: "",
  },
];
