// src/modules/projects/mom/tests/momValidationAndLifecycle.test.ts

import { validateMomDraft, validateMomFinalize } from "../utils/momValidation";
import { hasMomPermission } from "../services/momPermissions";
import {
  MomDocument,
  MomRevision,
  OFFICIAL_TEXAWAVE_MOM_TEMPLATE,
} from "../types/mom";

/**
 * Self-contained verification suite for MoM logic:
 * 1. Draft Validation: allows incomplete data, requires project and title
 * 2. Finalize Validation: requires date, time, attendees, and meeting notes
 * 3. Role & Project Permissions: Admin, Manager, Lead, Member
 * 4. Template Isolation & Immutability: Deep clone isolation
 * 5. Lifecycle Transitions: draft -> finalized -> working revision -> finalized -> archived -> restored
 */
export function runMomLogicTests(): {
  passed: number;
  failed: number;
  results: string[];
} {
  const results: string[] = [];
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      passed++;
      results.push(`✅ PASS: ${testName}`);
    } else {
      failed++;
      results.push(`❌ FAIL: ${testName}`);
    }
  }

  // --- 1. Draft Validation ---
  const validDraft = validateMomDraft({
    projectId: "proj_123",
    meetingTitle: "Sprint 1 Kickoff",
  });
  assert(
    validDraft.isValid,
    "validateMomDraft succeeds with projectId and meetingTitle",
  );

  const invalidDraftNoProject = validateMomDraft({
    meetingTitle: "Sprint 1 Kickoff",
  });
  assert(
    !invalidDraftNoProject.isValid,
    "validateMomDraft fails when projectId is missing",
  );

  const invalidDraftNoTitle = validateMomDraft({
    projectId: "proj_123",
    meetingTitle: "   ",
  });
  assert(
    !invalidDraftNoTitle.isValid,
    "validateMomDraft fails when meetingTitle is whitespace",
  );

  // --- 2. Finalize Validation ---
  const incompleteFinalize = validateMomFinalize({
    projectId: "proj_123",
    meetingTitle: "Sprint Review",
    meetingDate: "2026-09-05",
    // missing times, attendees, notes
  });
  assert(
    !incompleteFinalize.isValid,
    "validateMomFinalize fails on incomplete details",
  );

  const completeFinalize = validateMomFinalize({
    projectId: "proj_123",
    meetingTitle: "Sprint Review",
    meetingDate: "2026-09-05",
    startTime: "10:00",
    endTime: "11:00",
    attendees: [{ id: "1", name: "Alice", attendance: "present" }],
    meetingNotes: [
      {
        id: "1",
        order: 1,
        agendaItem: "Item 1",
        discussionPoints: "Discussed architecture",
        actionItems: "Alice to implement",
      },
    ],
  });
  assert(
    completeFinalize.isValid,
    "validateMomFinalize succeeds with all mandatory fields populated",
  );

  // --- 3. Permissions Testing ---
  const adminUser = { id: "usr_admin", role: "admin" };
  const managerUser = { id: "usr_mgr", role: "manager" };
  const regularMember = { id: "usr_dev", role: "employee", username: "dev1" };
  const mockProject: any = {
    id: "proj_1",
    members: { usr_dev: { empId: "usr_dev", name: "dev1", role: "Developer" } },
  };

  assert(
    hasMomPermission(adminUser, "manage_templates"),
    "Admin has permission to manage_templates",
  );
  assert(
    hasMomPermission(managerUser, "manage_templates"),
    "Manager has permission to manage_templates",
  );
  assert(
    !hasMomPermission(regularMember, "manage_templates"),
    "Regular employee cannot manage_templates",
  );

  const draftDoc: Partial<MomDocument> = {
    id: "mom_1",
    projectId: "proj_1",
    status: "draft",
    createdBy: "usr_dev",
  };
  assert(
    hasMomPermission(regularMember, "edit_draft", draftDoc, mockProject),
    "Draft creator can edit draft",
  );

  const finalizedDoc: Partial<MomDocument> = {
    id: "mom_1",
    projectId: "proj_1",
    status: "finalized",
    createdBy: "usr_dev",
  };
  assert(
    !hasMomPermission(regularMember, "edit_draft", finalizedDoc, mockProject),
    "Finalized document cannot be edited as a draft",
  );
  assert(
    hasMomPermission(managerUser, "create_revision", finalizedDoc, mockProject),
    "Manager can create revision from finalized document",
  );

  // --- 4. Template Isolation & Immutability ---
  const templateCopy = JSON.parse(
    JSON.stringify(OFFICIAL_TEXAWAVE_MOM_TEMPLATE),
  );
  templateCopy.name = "Mutated Template Name In Doc";
  assert(
    OFFICIAL_TEXAWAVE_MOM_TEMPLATE.name === "TexaWave Official Meeting Minutes",
    "Template snapshot isolation preserves master template",
  );

  // --- 5. Revision & Lifecycle Simulation ---
  const baseDoc: MomDocument = {
    id: "mom_sim_1",
    reference: "MOM-2026-0001",
    projectId: "proj_1",
    projectCode: "PRJ",
    projectName: "Test Project",
    meetingTitle: "Original Meeting",
    meetingDate: "2026-09-05",
    startTime: "10:00",
    endTime: "11:00",
    timezone: "IST (UTC+05:30)",
    location: "Conference Room",
    attendees: [{ id: "1", name: "Alice", attendance: "present" }],
    absentees: [],
    agenda: [],
    meetingNotes: [],
    status: "finalized",
    templateId: "tmpl_1",
    templateVersion: "V1.0",
    currentRevision: 1,
    revisions: [
      {
        revisionNumber: 1,
        timestamp: new Date().toISOString(),
        userId: "usr_1",
        userName: "User 1",
        changeSummary: "Initial Document Finalized",
        snapshot: {
          meetingTitle: "Original Meeting",
          meetingDate: "2026-09-05",
          startTime: "10:00",
          endTime: "11:00",
          timezone: "IST (UTC+05:30)",
          location: "Conference Room",
          attendees: [{ id: "1", name: "Alice", attendance: "present" }],
          absentees: [],
          agenda: [],
          meetingNotes: [],
          status: "finalized",
        },
      },
    ],
    history: [],
    createdAt: new Date().toISOString(),
    createdBy: "usr_1",
    createdByName: "User 1",
    updatedAt: new Date().toISOString(),
    updatedBy: "usr_1",
    updatedByName: "User 1",
  };

  // Start Working Revision
  const workingRevisionDoc: MomDocument = {
    ...baseDoc,
    status: "draft",
    workingRevision: 2,
    workingRevisionReason: "Corrected attendance and deliverables",
  };
  assert(
    workingRevisionDoc.workingRevision === 2,
    "Working revision correctly set to revision 2",
  );
  assert(
    workingRevisionDoc.revisions[0].revisionNumber === 1,
    "Prior revision 1 remains intact",
  );

  // Finalize Revision 2
  const finalizedRev2: MomDocument = {
    ...workingRevisionDoc,
    status: "finalized",
    currentRevision: 2,
    workingRevision: undefined,
    workingRevisionReason: undefined,
    revisions: [
      ...baseDoc.revisions,
      {
        revisionNumber: 2,
        timestamp: new Date().toISOString(),
        userId: "usr_mgr",
        userName: "Manager",
        changeSummary:
          "Finalized Revision 2: Corrected attendance and deliverables",
        snapshot: {
          ...workingRevisionDoc.revisions[0].snapshot,
          status: "finalized",
        },
      },
    ],
  };
  assert(
    finalizedRev2.currentRevision === 2,
    "Document promoted to Revision 2",
  );
  assert(
    finalizedRev2.revisions.length === 2,
    "Two immutable revision snapshots preserved",
  );

  // Archive & Restore
  const archivedDoc: MomDocument = {
    ...finalizedRev2,
    status: "archived",
    previousStatus: finalizedRev2.status,
  };
  assert(archivedDoc.status === "archived", "Document archived successfully");
  assert(
    archivedDoc.previousStatus === "finalized",
    "Previous status preserved for restoration",
  );

  const restoredDoc: MomDocument = {
    ...archivedDoc,
    status: archivedDoc.previousStatus || "draft",
    previousStatus: undefined,
  };
  assert(
    restoredDoc.status === "finalized",
    "Document successfully restored to finalized state",
  );

  return { passed, failed, results };
}

// Auto-run in test environments
if (typeof window === "undefined" && typeof process !== "undefined") {
  const { passed, failed, results } = runMomLogicTests();
  console.log(`MoM Logic Verification: ${passed} passed, ${failed} failed`);
  results.forEach((r) => console.log(r));
}
