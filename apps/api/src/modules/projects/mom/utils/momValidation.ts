// src/modules/projects/mom/utils/momValidation.ts

import { MomDocument } from "../types/mom";

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validates criteria to save a draft.
 * Specifically requires project binding and meeting title.
 * Allows partial, incomplete meeting details for work-in-progress drafts.
 */
export function validateMomDraft(data: Partial<MomDocument>): ValidationResult {
  const errors: string[] = [];

  if (!data.projectId || !data.projectId.trim()) {
    errors.push("A valid Project must be selected.");
  }

  if (!data.meetingTitle || !data.meetingTitle.trim()) {
    errors.push("Meeting Title is required to save a draft.");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates criteria to finalize an MoM.
 * Requires complete meeting details, at least one attendee, and populated notes.
 */
export function validateMomFinalize(
  data: Partial<MomDocument>,
): ValidationResult {
  const errors: string[] = [];

  // Project & Title
  if (!data.projectId || !data.projectId.trim()) {
    errors.push("Project must be selected.");
  }
  if (!data.meetingTitle || !data.meetingTitle.trim()) {
    errors.push("Meeting Title is required.");
  }

  // Schedule & Location
  if (!data.meetingDate || !data.meetingDate.trim()) {
    errors.push("Meeting Date is required to finalize.");
  }
  if (!data.startTime || !data.startTime.trim()) {
    errors.push("Meeting Start Time is required to finalize.");
  }
  if (!data.endTime || !data.endTime.trim()) {
    errors.push("Meeting End Time is required to finalize.");
  }

  // Attendees
  const presentAttendees = (data.attendees || []).filter(
    (a) => a.attendance === "present" || a.attendance === "remote",
  );
  if (presentAttendees.length === 0) {
    errors.push("At least one attendee must be marked as present or remote.");
  }

  // Meeting Notes rows
  const hasNotes = (data.meetingNotes || []).some(
    (n) =>
      (n.agendaItem && n.agendaItem.trim()) ||
      (n.discussionPoints && n.discussionPoints.trim()) ||
      (n.actionItems && n.actionItems.trim()),
  );
  if (!hasNotes) {
    errors.push(
      "At least one meeting notes row with discussion points or action items is required.",
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
