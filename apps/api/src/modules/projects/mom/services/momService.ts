// src/modules/projects/mom/services/momService.ts

import {
  ref,
  get,
  set,
  update,
  remove,
  push,
  onValue,
} from "firebase/database";
import { database } from "@/services/firebase";
import {
  MomDocument,
  MomRegisterItem,
  MomRevision,
  MomHistoryEvent,
  MomDocumentSnapshot,
  OFFICIAL_TEXAWAVE_MOM_TEMPLATE,
} from "../types/mom";
import { generateNextMomReference } from "./momReferenceService";

/**
 * Validates whether the authenticated user has authorization to access the given project.
 * - Admin and Manager roles have global visibility across all projects.
 * - Other users (e.g. Employee, Sales) must be listed as project members, assigned resources, or client handler.
 */
export function canUserAccessProject(user: any, project: any): boolean {
  if (!user) return false;
  const role = (user.role || "").toLowerCase();
  if (role === "admin" || role === "manager") return true;

  if (!project) return false;

  const userId = user.id || user.uid || user.username || "";
  const userName = (user.name || user.username || "").toLowerCase();

  // Check project members map
  if (project.members && typeof project.members === "object") {
    const memberKeys = Object.keys(project.members);
    if (memberKeys.includes(userId)) return true;

    const memberMatches = Object.values(project.members).some((m: any) => {
      const empId = (m?.empId || "").toLowerCase();
      const mName = (m?.name || "").toLowerCase();
      return empId === userId.toLowerCase() || (userName && mName === userName);
    });
    if (memberMatches) return true;
  }

  // Check resources array
  if (Array.isArray(project.resources)) {
    const inResources = project.resources.some((r: string) => {
      const res = String(r).toLowerCase();
      return res === userId.toLowerCase() || (userName && res === userName);
    });
    if (inResources) return true;
  }

  // Check client handling person
  if (project.clientHandlingPerson) {
    const handler = String(project.clientHandlingPerson).toLowerCase();
    if (handler === userId.toLowerCase() || (userName && handler === userName))
      return true;
  }

  // If project has no members explicitly defined yet, allow team member
  if (!project.members || Object.keys(project.members).length === 0) {
    return true;
  }

  return false;
}

/**
 * Creates a clean snapshot of the editable document content for revision preservation.
 */
export function createDocumentSnapshot(
  doc: Partial<MomDocument>,
): MomDocumentSnapshot {
  return {
    meetingTitle: doc.meetingTitle || "",
    meetingDate: doc.meetingDate || "",
    startTime: doc.startTime || "",
    endTime: doc.endTime || "",
    timezone: doc.timezone || "IST (UTC+05:30)",
    location: doc.location || "",
    attendees: Array.isArray(doc.attendees)
      ? JSON.parse(JSON.stringify(doc.attendees))
      : [],
    absentees: Array.isArray(doc.absentees)
      ? JSON.parse(JSON.stringify(doc.absentees))
      : [],
    agenda: Array.isArray(doc.agenda)
      ? JSON.parse(JSON.stringify(doc.agenda))
      : [],
    meetingNotes: Array.isArray(doc.meetingNotes)
      ? JSON.parse(JSON.stringify(doc.meetingNotes))
      : [],
    additionalSections: Array.isArray(doc.additionalSections)
      ? JSON.parse(JSON.stringify(doc.additionalSections))
      : [],
    status: doc.status || "draft",
  };
}

/**
 * Fetches lightweight items for the MoM Register view.
 * Avoids loading massive full revision snapshots into memory when listing.
 * Filters out projects the user cannot access.
 */
export async function getMomRegisterList(
  currentUser: any,
): Promise<MomRegisterItem[]> {
  // Fetch all MoM records
  const momsSnap = await get(ref(database, "mom_documents"));
  if (!momsSnap.exists()) return [];

  // Fetch projects to verify authorization
  const projectsSnap = await get(ref(database, "projects"));
  const projectsMap: Record<string, any> = projectsSnap.exists()
    ? projectsSnap.val()
    : {};

  const rawMoms = momsSnap.val();
  const registerItems: MomRegisterItem[] = [];

  for (const [id, raw] of Object.entries<any>(rawMoms)) {
    const projectId = raw.projectId || "";
    const project = projectsMap[projectId];

    // Authorize access
    if (currentUser && !canUserAccessProject(currentUser, project)) {
      continue; // Skip records user is not authorized to view
    }

    const attendeesCount = Array.isArray(raw.attendees)
      ? raw.attendees.filter(
          (a: any) => a.attendance === "present" || a.attendance === "remote",
        ).length
      : 0;

    registerItems.push({
      id,
      reference: raw.reference || `MOM-${id.slice(-4).toUpperCase()}`,
      meetingTitle: raw.meetingTitle || "Untitled Meeting",
      projectId,
      projectCode: raw.projectCode || project?.projectCode || "",
      projectName: raw.projectName || project?.name || "Unknown Project",
      clientName:
        raw.clientName || project?.customerName || project?.client || "",
      meetingDate: raw.meetingDate || "",
      startTime: raw.startTime || "",
      endTime: raw.endTime || "",
      status: raw.status || "draft",
      currentRevision: raw.currentRevision || 1,
      attendeesCount,
      updatedAt: raw.updatedAt || raw.createdAt || new Date().toISOString(),
      updatedByName: raw.updatedByName || raw.createdByName || "Team Member",
    });
  }

  // Sort by meeting date descending, then updated at
  registerItems.sort((a, b) => {
    const dateComp = (b.meetingDate || "").localeCompare(a.meetingDate || "");
    if (dateComp !== 0) return dateComp;
    return (b.updatedAt || "").localeCompare(a.updatedAt || "");
  });

  return registerItems;
}

/**
 * Real-time listener for MoM records under a specific project.
 * Used inside ProjectDetail.tsx Meeting History section.
 */
export function subscribeToProjectMoms(
  projectId: string,
  callback: (items: MomRegisterItem[]) => void,
): () => void {
  const momsRef = ref(database, "mom_documents");
  return onValue(momsRef, (snap) => {
    if (!snap.exists()) {
      callback([]);
      return;
    }

    const data = snap.val();
    const list: MomRegisterItem[] = [];

    for (const [id, raw] of Object.entries<any>(data)) {
      if (raw.projectId !== projectId) continue;

      const attendeesCount = Array.isArray(raw.attendees)
        ? raw.attendees.filter(
            (a: any) => a.attendance === "present" || a.attendance === "remote",
          ).length
        : 0;

      list.push({
        id,
        reference: raw.reference || `MOM-${id.slice(-4).toUpperCase()}`,
        meetingTitle: raw.meetingTitle || "Untitled Meeting",
        projectId,
        projectCode: raw.projectCode || "",
        projectName: raw.projectName || "",
        clientName: raw.clientName || "",
        meetingDate: raw.meetingDate || "",
        startTime: raw.startTime || "",
        endTime: raw.endTime || "",
        status: raw.status || "draft",
        currentRevision: raw.currentRevision || 1,
        attendeesCount,
        updatedAt: raw.updatedAt || raw.createdAt || new Date().toISOString(),
        updatedByName: raw.updatedByName || raw.createdByName || "Team Member",
      });
    }

    list.sort((a, b) =>
      (b.meetingDate || "").localeCompare(a.meetingDate || ""),
    );
    callback(list);
  });
}

/**
 * Retrieves a full single MoM document by ID, checking authorization.
 */
export async function getMomById(
  id: string,
  currentUser?: any,
): Promise<MomDocument | null> {
  const docRef = ref(database, `mom_documents/${id}`);
  const snap = await get(docRef);
  if (!snap.exists()) return null;

  const doc = snap.val() as MomDocument;
  doc.id = id;

  // Verify access if user supplied
  if (currentUser) {
    const projectSnap = await get(ref(database, `projects/${doc.projectId}`));
    const project = projectSnap.exists() ? projectSnap.val() : null;
    if (!canUserAccessProject(currentUser, project)) {
      throw new Error(
        "Unauthorized: You do not have permission to access this project meeting record.",
      );
    }
  }

  // Ensure arrays are initialized
  doc.attendees = Array.isArray(doc.attendees) ? doc.attendees : [];
  doc.absentees = Array.isArray(doc.absentees) ? doc.absentees : [];
  doc.agenda = Array.isArray(doc.agenda) ? doc.agenda : [];
  doc.meetingNotes = Array.isArray(doc.meetingNotes) ? doc.meetingNotes : [];
  doc.revisions = Array.isArray(doc.revisions) ? doc.revisions : [];
  doc.history = Array.isArray(doc.history) ? doc.history : [];

  return doc;
}

/**
 * Creates or updates an MoM document with automatic technical operations:
 * - Reference number generation under concurrent safety
 * - Document revision preservation
 * - History audit recording
 * - Timestamps and actor attribution
 */
export async function saveMom(
  formData: Partial<MomDocument>,
  currentUser: any,
  isFinalize: boolean = false,
  changeSummary?: string,
): Promise<MomDocument> {
  const now = new Date().toISOString();
  const userId =
    currentUser?.id || currentUser?.uid || currentUser?.username || "user";
  const userName = currentUser?.name || currentUser?.username || "Team Member";

  let docId = formData.id;
  const isNew = !docId;

  // Retrieve project details for caching
  const projectSnap = await get(
    ref(database, `projects/${formData.projectId}`),
  );
  if (!projectSnap.exists()) {
    throw new Error("Associated project does not exist.");
  }
  const projectData = projectSnap.val();

  // Enforce project authorization
  if (!canUserAccessProject(currentUser, projectData)) {
    throw new Error(
      "Unauthorized: You are not authorized to record meetings for this project.",
    );
  }

  const projectCode = projectData.projectCode || "";
  const projectName = projectData.name || "";
  const clientName =
    projectData.customerName || projectData.client || formData.clientName || "";

  const targetStatus = isFinalize ? "finalized" : formData.status || "draft";

  if (isNew) {
    const newRef = push(ref(database, "mom_documents"));
    docId = newRef.key!;

    // Generate safe business reference
    const reference = await generateNextMomReference();

    const snapshot = createDocumentSnapshot({
      ...formData,
      status: targetStatus,
    });

    const initialRevision: MomRevision = {
      revisionNumber: 1,
      timestamp: now,
      userId,
      userName,
      changeSummary:
        changeSummary ||
        (isFinalize
          ? "Initial Document (Finalized)"
          : "Initial Draft Creation"),
      snapshot,
    };

    const initialHistory: MomHistoryEvent = {
      id: `hist_${Date.now()}`,
      timestamp: now,
      userId,
      userName,
      action: isFinalize ? "finalized" : "created",
      details: `Meeting minutes initialized with reference ${reference}`,
    };

    const newDoc: MomDocument = {
      id: docId,
      reference,
      projectId: formData.projectId!,
      projectCode,
      projectName,
      clientName,
      meetingTitle: (formData.meetingTitle || "").trim(),
      meetingDate: formData.meetingDate || now.split("T")[0],
      startTime: formData.startTime || "10:00",
      endTime: formData.endTime || "11:00",
      timezone: formData.timezone || "IST (UTC+05:30)",
      location: formData.location || "Online Conference Room",
      attendees: formData.attendees || [],
      absentees: formData.absentees || [],
      agenda:
        formData.agenda || OFFICIAL_TEXAWAVE_MOM_TEMPLATE.defaultAgenda || [],
      meetingNotes:
        formData.meetingNotes ||
        OFFICIAL_TEXAWAVE_MOM_TEMPLATE.defaultNoteRows ||
        [],
      additionalSections: formData.additionalSections || [],
      status: targetStatus,
      templateId: formData.templateId || OFFICIAL_TEXAWAVE_MOM_TEMPLATE.id,
      templateVersion:
        formData.templateVersion || OFFICIAL_TEXAWAVE_MOM_TEMPLATE.version,
      templateSnapshot:
        formData.templateSnapshot || OFFICIAL_TEXAWAVE_MOM_TEMPLATE,
      currentRevision: 1,
      revisions: [initialRevision],
      history: [initialHistory],
      createdAt: now,
      createdBy: userId,
      createdByName: userName,
      updatedAt: now,
      updatedBy: userId,
      updatedByName: userName,
    };

    await set(ref(database, `mom_documents/${docId}`), newDoc);
    return newDoc;
  } else {
    // Existing document update
    const existingSnap = await get(ref(database, `mom_documents/${docId}`));
    if (!existingSnap.exists()) {
      throw new Error(`MoM record ${docId} does not exist.`);
    }

    const existingDoc = existingSnap.val() as MomDocument;

    // Concurrency / Stale-save conflict check:
    // If formData provided an expected versionToken and the remote document has advanced,
    // prevent silent overwrite and throw StaleSaveConflictError with the remote copy.
    if (
      formData.versionToken !== undefined &&
      existingDoc.versionToken !== undefined &&
      existingDoc.versionToken > formData.versionToken
    ) {
      throw new StaleSaveConflictError(
        `Conflict detected: This meeting record was updated remotely by ${existingDoc.updatedByName || "another user"} at ${new Date(existingDoc.updatedAt).toLocaleTimeString()}. Your changes have NOT been overwritten.`,
        existingDoc,
      );
    }

    const nextRevNumber = (existingDoc.currentRevision || 1) + 1;
    const snapshot = createDocumentSnapshot({
      ...existingDoc,
      ...formData,
      status: targetStatus,
    });

    const newRevision: MomRevision = {
      revisionNumber: nextRevNumber,
      timestamp: now,
      userId,
      userName,
      changeSummary:
        changeSummary ||
        (isFinalize
          ? "Document Finalized"
          : `Revision ${nextRevNumber} updates`),
      snapshot,
    };

    const existingRevisions = Array.isArray(existingDoc.revisions)
      ? existingDoc.revisions
      : [];
    const updatedRevisions = [...existingRevisions, newRevision];

    const historyAction: MomHistoryEvent["action"] = isFinalize
      ? "finalized"
      : "saved_draft";

    const newHistoryEvent: MomHistoryEvent = {
      id: `hist_${Date.now()}`,
      timestamp: now,
      userId,
      userName,
      action: historyAction,
      details:
        changeSummary || `Updated document content (Revision ${nextRevNumber})`,
    };

    const existingHistory = Array.isArray(existingDoc.history)
      ? existingDoc.history
      : [];
    const updatedHistory = [...existingHistory, newHistoryEvent];

    const updatedPayload: Partial<MomDocument> = {
      projectId: formData.projectId || existingDoc.projectId,
      projectCode,
      projectName,
      clientName,
      meetingTitle: (formData.meetingTitle !== undefined
        ? formData.meetingTitle
        : existingDoc.meetingTitle
      ).trim(),
      meetingDate: formData.meetingDate || existingDoc.meetingDate,
      startTime: formData.startTime || existingDoc.startTime,
      endTime: formData.endTime || existingDoc.endTime,
      timezone: formData.timezone || existingDoc.timezone,
      location:
        formData.location !== undefined
          ? formData.location
          : existingDoc.location,
      attendees: formData.attendees || existingDoc.attendees || [],
      absentees: formData.absentees || existingDoc.absentees || [],
      agenda: formData.agenda || existingDoc.agenda || [],
      meetingNotes: formData.meetingNotes || existingDoc.meetingNotes || [],
      additionalSections:
        formData.additionalSections || existingDoc.additionalSections || [],
      status: targetStatus,
      currentRevision: isFinalize
        ? nextRevNumber
        : existingDoc.currentRevision || 1,
      versionToken: (existingDoc.versionToken || 1) + 1,
      revisions: updatedRevisions,
      history: updatedHistory,
      updatedAt: now,
      updatedBy: userId,
      updatedByName: userName,
    };

    await update(ref(database, `mom_documents/${docId}`), updatedPayload);
    return { ...existingDoc, ...updatedPayload };
  }
}

/**
 * Custom error class for handling stale-save conflicts when another user updated the document.
 */
export class StaleSaveConflictError extends Error {
  remoteDoc: MomDocument;
  constructor(message: string, remoteDoc: MomDocument) {
    super(message);
    this.name = "StaleSaveConflictError";
    this.remoteDoc = remoteDoc;
  }
}

/**
 * Creates a linked editable working revision from an existing finalized MoM.
 * Preserves the previous finalized revision as the official current document.
 * Requires a revision reason before finalizing the correction.
 */
export async function startWorkingRevision(
  docId: string,
  currentUser: any,
  revisionReason: string,
): Promise<MomDocument> {
  const doc = await getMomById(docId, currentUser);
  if (!doc) {
    throw new Error(`MoM record ${docId} not found.`);
  }

  if (doc.status !== "finalized") {
    throw new Error(
      "Working revisions can only be created for Finalized documents.",
    );
  }

  const now = new Date().toISOString();
  const userId =
    currentUser?.id || currentUser?.uid || currentUser?.username || "user";
  const userName = currentUser?.name || currentUser?.username || "Team Member";

  const nextWorkingRevision = (doc.currentRevision || 1) + 1;

  const historyEvent: MomHistoryEvent = {
    id: `hist_${Date.now()}`,
    timestamp: now,
    userId,
    userName,
    action: "revision_started",
    details: `Created working revision ${nextWorkingRevision}. Reason: ${revisionReason}`,
  };

  const existingHistory = Array.isArray(doc.history) ? doc.history : [];

  const updatePayload: Partial<MomDocument> = {
    status: "draft",
    workingRevision: nextWorkingRevision,
    workingRevisionReason: revisionReason,
    versionToken: (doc.versionToken || 1) + 1,
    history: [...existingHistory, historyEvent],
    updatedAt: now,
    updatedBy: userId,
    updatedByName: userName,
  };

  await update(ref(database, `mom_documents/${docId}`), updatePayload);
  return { ...doc, ...updatePayload };
}

/**
 * Finalizes an MoM document (either initial draft or working revision).
 * Once finalized, increments currentRevision to the working revision number,
 * updates official status to 'finalized', clears working revision pointer, and records revision snapshot.
 */
export async function finalizeMom(
  docId: string,
  formData: Partial<MomDocument>,
  currentUser: any,
  changeSummary?: string,
): Promise<MomDocument> {
  const existingDoc = await getMomById(docId, currentUser);
  if (!existingDoc) {
    throw new Error(`MoM record ${docId} not found.`);
  }

  const now = new Date().toISOString();
  const userId =
    currentUser?.id || currentUser?.uid || currentUser?.username || "user";
  const userName = currentUser?.name || currentUser?.username || "Team Member";

  const isWorkingRevision = Boolean(existingDoc.workingRevision);
  const targetRevisionNumber = isWorkingRevision
    ? existingDoc.workingRevision!
    : existingDoc.currentRevision || 1;

  const snapshot = createDocumentSnapshot({
    ...existingDoc,
    ...formData,
    status: "finalized",
  });

  const finalSummary =
    changeSummary ||
    (isWorkingRevision
      ? `Finalized Revision ${targetRevisionNumber}: ${existingDoc.workingRevisionReason || "Correction"}`
      : `Finalized Revision ${targetRevisionNumber}`);

  const newRevision: MomRevision = {
    revisionNumber: targetRevisionNumber,
    timestamp: now,
    userId,
    userName,
    changeSummary: finalSummary,
    snapshot,
  };

  const existingRevisions = Array.isArray(existingDoc.revisions)
    ? existingDoc.revisions
    : [];
  const updatedRevisions = [...existingRevisions, newRevision];

  const newHistoryEvent: MomHistoryEvent = {
    id: `hist_${Date.now()}`,
    timestamp: now,
    userId,
    userName,
    action: isWorkingRevision ? "revised_version_finalized" : "finalized",
    details: finalSummary,
  };

  const existingHistory = Array.isArray(existingDoc.history)
    ? existingDoc.history
    : [];

  const updatePayload: Record<string, any> = {
    meetingTitle: (formData.meetingTitle !== undefined
      ? formData.meetingTitle
      : existingDoc.meetingTitle
    ).trim(),
    meetingDate: formData.meetingDate || existingDoc.meetingDate,
    startTime: formData.startTime || existingDoc.startTime,
    endTime: formData.endTime || existingDoc.endTime,
    timezone: formData.timezone || existingDoc.timezone,
    location:
      formData.location !== undefined
        ? formData.location
        : existingDoc.location,
    attendees: formData.attendees || existingDoc.attendees || [],
    absentees: formData.absentees || existingDoc.absentees || [],
    agenda: formData.agenda || existingDoc.agenda || [],
    meetingNotes: formData.meetingNotes || existingDoc.meetingNotes || [],
    additionalSections:
      formData.additionalSections || existingDoc.additionalSections || [],
    status: "finalized",
    currentRevision: targetRevisionNumber,
    workingRevision: null,
    workingRevisionReason: null,
    versionToken: (existingDoc.versionToken || 1) + 1,
    revisions: updatedRevisions,
    history: [...existingHistory, newHistoryEvent],
    updatedAt: now,
    updatedBy: userId,
    updatedByName: userName,
  };

  await update(ref(database, `mom_documents/${docId}`), updatePayload);
  return {
    ...existingDoc,
    ...updatePayload,
    workingRevision: undefined,
    workingRevisionReason: undefined,
  } as MomDocument;
}

/**
 * Archives an MoM document (Draft or Finalized).
 * Preserves the previous status so the document can be safely restored.
 */
export async function archiveMom(
  docId: string,
  currentUser: any,
): Promise<MomDocument> {
  const doc = await getMomById(docId, currentUser);
  if (!doc) {
    throw new Error(`MoM record ${docId} not found.`);
  }

  const now = new Date().toISOString();
  const userId =
    currentUser?.id || currentUser?.uid || currentUser?.username || "user";
  const userName = currentUser?.name || currentUser?.username || "Team Member";

  const historyEvent: MomHistoryEvent = {
    id: `hist_${Date.now()}`,
    timestamp: now,
    userId,
    userName,
    action: "archived",
    details: `Meeting minutes ${doc.reference} archived from ${doc.status} state.`,
  };

  const existingHistory = Array.isArray(doc.history) ? doc.history : [];

  const updatePayload: Partial<MomDocument> = {
    status: "archived",
    previousStatus: doc.status,
    versionToken: (doc.versionToken || 1) + 1,
    history: [...existingHistory, historyEvent],
    updatedAt: now,
    updatedBy: userId,
    updatedByName: userName,
  };

  await update(ref(database, `mom_documents/${docId}`), updatePayload);
  return { ...doc, ...updatePayload };
}

/**
 * Restores an archived MoM document to its previous state (Draft or Finalized).
 */
export async function restoreMom(
  docId: string,
  currentUser: any,
): Promise<MomDocument> {
  const doc = await getMomById(docId, currentUser);
  if (!doc) {
    throw new Error(`MoM record ${docId} not found.`);
  }

  if (doc.status !== "archived") {
    throw new Error("Only archived documents can be restored.");
  }

  const now = new Date().toISOString();
  const userId =
    currentUser?.id || currentUser?.uid || currentUser?.username || "user";
  const userName = currentUser?.name || currentUser?.username || "Team Member";

  const restoredStatus = doc.previousStatus || "draft";

  const historyEvent: MomHistoryEvent = {
    id: `hist_${Date.now()}`,
    timestamp: now,
    userId,
    userName,
    action: "restored",
    details: `Meeting minutes ${doc.reference} restored to ${restoredStatus} state.`,
  };

  const existingHistory = Array.isArray(doc.history) ? doc.history : [];

  const updatePayload: Record<string, any> = {
    status: restoredStatus,
    previousStatus: null,
    versionToken: (doc.versionToken || 1) + 1,
    history: [...existingHistory, historyEvent],
    updatedAt: now,
    updatedBy: userId,
    updatedByName: userName,
  };

  await update(ref(database, `mom_documents/${docId}`), updatePayload);
  return { ...doc, ...updatePayload, previousStatus: undefined } as MomDocument;
}

/**
 * Deletes an MoM document. Allowed only for drafts by authorized user or admin.
 */
export async function deleteMom(id: string, currentUser: any): Promise<void> {
  const doc = await getMomById(id, currentUser);
  if (!doc) return;

  const role = (currentUser?.role || "").toLowerCase();
  const userId = currentUser?.id || currentUser?.uid || currentUser?.username;

  if (doc.status === "finalized" && role !== "admin") {
    throw new Error(
      "Finalized meeting records can only be removed by an Administrator.",
    );
  }

  if (role !== "admin" && doc.createdBy !== userId) {
    throw new Error(
      "Unauthorized: You can only delete meeting records created by you.",
    );
  }

  await remove(ref(database, `mom_documents/${id}`));
}
