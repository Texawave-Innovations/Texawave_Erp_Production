// src/modules/projects/mom/types/mom.ts

export type MomStatus = "draft" | "finalized" | "archived";

export type AttendanceType = "present" | "absent" | "remote";

export type MomSectionType =
  | "company_header"
  | "meeting_details"
  | "people_lists"
  | "agenda_list"
  | "free_text"
  | "meeting_notes_table";

export interface MomSectionConfig {
  id: string; // Stable ID
  type: MomSectionType;
  title: string;
  order: number;
  visible: boolean;
  required: boolean;
  description?: string;
  defaultContent?: string;
  defaultItems?: string[];
  isListOrdered?: boolean;
}

export interface MomAttendee {
  id: string; // Stable ID
  name: string;
  role?: string;
  organization?: string;
  attendance: AttendanceType;
}

export interface MomAgendaItem {
  id: string; // Stable ID
  order: number;
  topic: string;
  presenter?: string;
  durationMinutes?: number;
}

export interface MomNoteRow {
  id: string; // Stable ID
  order: number;
  agendaItem: string;
  discussionPoints: string;
  actionItems: string;
}

export interface MomAdditionalSection {
  id: string;
  title: string;
  contentType: "rich_text" | "bullet_list" | "key_value" | "table";
  order: number;
  content: any;
}

export interface MomDocumentSnapshot {
  meetingTitle: string;
  meetingDate: string;
  startTime: string;
  endTime: string;
  timezone: string;
  location: string;
  attendees: MomAttendee[];
  absentees: MomAttendee[];
  agenda: MomAgendaItem[];
  meetingNotes: MomNoteRow[];
  additionalSections?: MomAdditionalSection[];
  freeTextContent?: Record<string, string>;
  status: MomStatus;
}

export interface MomRevision {
  revisionNumber: number;
  timestamp: string; // ISO 8601
  userId: string;
  userName: string;
  changeSummary: string;
  snapshot: MomDocumentSnapshot;
}

export interface MomHistoryEvent {
  id: string;
  timestamp: string; // ISO 8601
  userId: string;
  userName: string;
  action:
    | "created"
    | "saved_draft"
    | "finalized"
    | "revision_started"
    | "revised_version_finalized"
    | "archived"
    | "restored";
  details?: string;
}

export interface MomTemplate {
  id: string;
  code: string;
  name: string;
  description?: string;
  category?: string;
  version: string; // e.g. "V1.0", "V2.0"
  version_number: number;
  parent_version_id?: string;
  status: "active" | "draft" | "archived";
  isDefault?: boolean;
  sections: MomSectionConfig[];
  defaultAgenda?: MomAgendaItem[];
  defaultNoteRows?: MomNoteRow[];
  additionalSections?: MomAdditionalSection[];
  createdAt: string;
  createdBy: string;
  publishedAt?: string;
  updatedAt?: string;
}

export interface MomTemplateVersion {
  id: string;
  templateId: string;
  version: string;
  schemaSnapshot: any;
  createdAt: string;
  createdBy: string;
}

export interface MomCompanyHeader {
  companyName: string;
  logoUrl: string;
  email: string;
  phone: string;
  website?: string;
  address?: string;
}

export const DEFAULT_MOM_COMPANY_HEADER: MomCompanyHeader = {
  companyName: "TexaWave Innovations Pvt Ltd",
  logoUrl: "/Texa_Logo.jpeg",
  email: "info@texawave.com",
  phone: "+91 98765 43210",
  website: "www.texawave.com",
  address:
    "Plot 42, Tech Innovation Corridor, Bengaluru, Karnataka, India - 560100",
};

export interface MomDocument {
  id: string; // Stable internal database ID
  reference: string; // Unique human-readable business reference (e.g. MOM-2026-0001)
  projectId: string; // Project ID (mandatory)
  projectCode: string;
  projectName: string;
  clientName?: string;
  meetingTitle: string;
  meetingDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  timezone: string; // e.g. IST (UTC+05:30)
  location: string; // Physical meeting room or Virtual link
  attendees: MomAttendee[];
  absentees: MomAttendee[];
  agenda: MomAgendaItem[];
  meetingNotes: MomNoteRow[];
  additionalSections?: MomAdditionalSection[];
  freeTextContent?: Record<string, string>;
  status: MomStatus;
  previousStatus?: MomStatus; // For restore operations
  templateId: string;
  templateTitle?: string;
  templateVersion: string;
  templateSnapshot?: MomTemplate;
  currentRevision: number;
  workingRevision?: number; // Linked working revision in progress
  workingRevisionReason?: string; // Stored reason required before finalizing revision
  versionToken?: number; // Optimistic concurrency tracking to prevent silent lost updates
  revisions: MomRevision[];
  history: MomHistoryEvent[];
  createdAt: string;
  createdBy: string;
  createdByName: string;
  updatedAt: string;
  updatedBy: string;
  updatedByName: string;
}

export interface MomRegisterItem {
  id: string;
  reference: string;
  meetingTitle: string;
  projectId: string;
  projectCode: string;
  projectName: string;
  clientName?: string;
  meetingDate: string;
  startTime: string;
  endTime: string;
  status: MomStatus;
  templateVersion?: string;
  currentRevision: number;
  attendeesCount: number;
  updatedAt: string;
  updatedByName: string;
}

export const OFFICIAL_TEXAWAVE_MOM_TEMPLATE: MomTemplate = {
  id: "tmpl_texawave_standard_mom_v1",
  code: "MOM-STD",
  name: "TexaWave Official Meeting Minutes",
  description:
    "Standard minutes of meeting template with structured agenda, deliberations, decisions, and action items table.",
  category: "Engineering & Project Operations",
  version: "V1.0",
  version_number: 1,
  status: "active",
  isDefault: true,
  createdAt: "2026-09-01T00:00:00.000Z",
  publishedAt: "2026-09-01T00:00:00.000Z",
  createdBy: "system",
  sections: [
    {
      id: "sec_header",
      type: "company_header",
      title: "Company Header",
      order: 1,
      visible: true,
      required: true,
      description:
        "Official TexaWave corporate branding, contact details, and logo.",
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
      description:
        "List of attendees present or remote, and recorded absentees.",
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
        "Structured record of discussion points and manual action items mapped to agenda topics.",
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
        "All decisions recorded during this meeting were reviewed and acknowledged by the attending members. Progress on assigned action items will be reviewed at the subsequent sprint checkpoint.",
    },
  ],
  defaultAgenda: [
    {
      id: "ag_1",
      order: 1,
      topic: "Review of Previous Action Items & Milestones",
    },
    {
      id: "ag_2",
      order: 2,
      topic: "Technical Architecture & Engineering Progress",
    },
    { id: "ag_3", order: 3, topic: "Risk Mitigation & Schedule Dependencies" },
    { id: "ag_4", order: 4, topic: "Next Steps & Next Meeting Scheduling" },
  ],
  defaultNoteRows: [
    {
      id: "nr_1",
      order: 1,
      agendaItem: "Review of Previous Action Items & Milestones",
      discussionPoints:
        "Reviewed progress on sprint deliverables and validated milestone sign-off criteria with technical leads.",
      actionItems:
        "Submit finalized BOM drawings to manufacturing team by Friday.",
    },
    {
      id: "nr_2",
      order: 2,
      agendaItem: "Technical Architecture & Engineering Progress",
      discussionPoints:
        "Evaluated mechanical CAD fitment and enclosure thermal dissipation tolerances.",
      actionItems:
        "Complete CFD simulation test runs and document temperature contour maps.",
    },
    {
      id: "nr_3",
      order: 3,
      agendaItem: "Next Steps & Next Meeting Scheduling",
      discussionPoints:
        "Agreed on scheduled progress checkpoints and stakeholder review cadences.",
      actionItems:
        "Organize sprint review with client POC for next Tuesday at 11:00 AM.",
    },
  ],
};
