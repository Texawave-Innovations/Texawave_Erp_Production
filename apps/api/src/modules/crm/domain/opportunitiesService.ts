// CRM Core Domain — Opportunities + Sales Pipeline + Stage History.
// Isolated Firebase paths: `crm/opportunities` (current state) and
// `crm/opportunityStageHistory/{opportunityId}` (append-only audit trail — the current stage is
// never overwritten without recording where it came from, per the "don't just overwrite the
// current stage" requirement).
import { get, onValue, push, ref, set } from "firebase/database";
import { database } from "@/services/firebase";
import { CRM_OPPORTUNITIES_PATH, CRM_STAGE_HISTORY_PATH } from "./config";
import {
  createInCollection,
  subscribeCollection,
  updateInCollection,
} from "./firebaseCollection";
import {
  CrmHoldReason,
  CrmLostReason,
  CrmOpportunity,
  CrmOpportunityInput,
  CrmStageHistoryEntry,
  CrmStuckReason,
} from "./types";
import { writeCrmAuditLog } from "../intelligence/auditService";
import { logCrmActivitySilently } from "./activitiesService";
import { liveStageLabel as stageLabel } from "./pipelineStagesService";
import { softDeleteCrmRecordWithRelated } from "./recycleBinService";
import { User } from "@/types";

export function subscribeCrmOpportunities(
  callback: (opportunities: CrmOpportunity[]) => void,
): () => void {
  return subscribeCollection<CrmOpportunity>(
    CRM_OPPORTUNITIES_PATH,
    (items) => {
      items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      callback(items);
    },
  );
}

export function subscribeCrmStageHistory(
  opportunityId: string,
  callback: (entries: CrmStageHistoryEntry[]) => void,
): () => void {
  const historyRef = ref(
    database,
    `${CRM_STAGE_HISTORY_PATH}/${opportunityId}`,
  );
  const unsubscribe = onValue(historyRef, (snap) => {
    const val = (snap.val() || {}) as Record<
      string,
      Omit<CrmStageHistoryEntry, "id" | "opportunityId">
    >;
    const entries = Object.entries(val).map(([id, e]) => ({
      id,
      opportunityId,
      ...e,
    }));
    entries.sort((a, b) => b.changedAt - a.changedAt);
    callback(entries);
  });
  return () => unsubscribe();
}

/** Flattens every opportunity's stage-history sub-node in one read — used by Analytics' Stage
 *  Duration chart, which needs transition timestamps across ALL opportunities, not just one. */
export function subscribeAllCrmStageHistory(
  callback: (entries: CrmStageHistoryEntry[]) => void,
): () => void {
  const historyRef = ref(database, CRM_STAGE_HISTORY_PATH);
  const unsubscribe = onValue(historyRef, (snap) => {
    const val = (snap.val() || {}) as Record<
      string,
      Record<string, Omit<CrmStageHistoryEntry, "id" | "opportunityId">>
    >;
    const entries: CrmStageHistoryEntry[] = [];
    Object.entries(val).forEach(([opportunityId, nodes]) => {
      Object.entries(nodes || {}).forEach(([id, e]) =>
        entries.push({ id, opportunityId, ...e }),
      );
    });
    entries.sort((a, b) => a.changedAt - b.changedAt);
    callback(entries);
  });
  return () => unsubscribe();
}

export async function createCrmOpportunity(
  input: CrmOpportunityInput,
  createdBy: string,
): Promise<string> {
  const now = Date.now();
  const id = await createInCollection<CrmOpportunity>(CRM_OPPORTUNITIES_PATH, {
    ...input,
    status: input.status || "OPEN",
    stageEnteredAt: now,
    createdBy,
    createdAt: now,
  } as Omit<CrmOpportunity, "id">);

  const opportunityNumber = `OPP-${id.slice(-6).toUpperCase()}`;
  await updateInCollection(CRM_OPPORTUNITIES_PATH, id, { opportunityNumber });
  await appendStageHistory(
    id,
    null,
    input.stage,
    createdBy,
    "Opportunity created",
  );
  await writeCrmAuditLog({
    action: "opportunity_created",
    entityType: "opportunity",
    entityId: id,
    companyKey: input.accountId,
    details: `Opportunity "${input.title}" (${opportunityNumber}) created`,
    by: createdBy,
    at: now,
  });
  return id;
}

/**
 * Moves an opportunity to a new stage. Always appends a `CrmStageHistoryEntry` recording the
 * transition — the current stage on the opportunity record itself is only ever a pointer to
 * "where things stand now"; the full history lives in `crm/opportunityStageHistory`.
 */
export async function changeCrmOpportunityStage(
  opportunity: Pick<CrmOpportunity, "id" | "stage">,
  toStage: string,
  changedBy: string,
  remarks?: string,
): Promise<void> {
  if (opportunity.stage === toStage) return;
  const now = Date.now();
  // The live record update and the append-only history entry must land as if atomic — the current
  // stage on the opportunity record is only ever a pointer, and `crm/opportunityStageHistory` is
  // the source of truth for "what actually happened". Firing them via Promise.all let one succeed
  // while the other failed, desyncing the two; they're awaited sequentially instead so a failure
  // partway through never leaves a stage change with no history entry (or vice versa). The audit
  // log and activity-feed writes are side information, not part of that invariant, so they still
  // run in parallel with each other for latency.
  await updateInCollection(CRM_OPPORTUNITIES_PATH, opportunity.id, {
    stage: toStage,
    stageEnteredAt: now,
    lastActivityAt: now,
  });
  await appendStageHistory(
    opportunity.id,
    opportunity.stage,
    toStage,
    changedBy,
    remarks,
  );
  await Promise.all([
    writeCrmAuditLog({
      action: "opportunity_stage_changed",
      entityType: "opportunity",
      entityId: opportunity.id,
      previousValue: opportunity.stage,
      newValue: toStage,
      details: `Stage changed from "${opportunity.stage}" to "${toStage}"${remarks ? ` — ${remarks}` : ""}`,
      by: changedBy,
      at: now,
    }),
    logCrmActivitySilently({
      relatedType: "opportunity",
      relatedId: opportunity.id,
      type: "Stage Change",
      subject: `${stageLabel(opportunity.stage)} → ${stageLabel(toStage)}`,
      notes: remarks,
      occurredAt: now,
      createdBy: changedBy,
    }),
  ]);
}

/** Reads the opportunity's stage as it stands right now (before the caller's update lands), so
 *  `appendStageHistory`'s `fromStage` records where the deal actually came from instead of `null`
 *  — the Analytics Stage Duration chart relies on that value for every transition, not just the
 *  ones that go through `changeCrmOpportunityStage`. */
async function currentStageOf(id: string): Promise<string | null> {
  const snap = await get(
    ref(database, `${CRM_OPPORTUNITIES_PATH}/${id}/stage`),
  );
  return snap.exists() ? (snap.val() as string) : null;
}

async function appendStageHistory(
  opportunityId: string,
  fromStage: string | null,
  toStage: string,
  changedBy: string,
  remarks?: string,
): Promise<void> {
  const newRef = push(
    ref(database, `${CRM_STAGE_HISTORY_PATH}/${opportunityId}`),
  );
  await set(newRef, {
    fromStage,
    toStage,
    changedBy,
    changedAt: Date.now(),
    remarks: remarks || "",
  });
}

/**
 * Marks an opportunity Won. `closingAmount`/`closingDate` come from the Won verification modal —
 * they default to the deal's current `estimatedValue`/`expectedCloseDate` when the caller doesn't
 * override them, and are what Dashboard/Analytics revenue figures read (falling back to
 * `estimatedValue` for older deals won before this modal existed).
 */
export async function markCrmOpportunityWon(
  id: string,
  changedBy: string,
  options?: {
    closingAmount?: number;
    closingDate?: string;
    remarks?: string;
    fromStage?: string;
  },
): Promise<void> {
  const now = Date.now();
  // Callers that already hold the opportunity in memory (OpportunityDrawer) can pass its current
  // `stage` directly, skipping this extra round trip and shrinking the read-then-write race window
  // against a concurrent stage change; callers that don't (or might be stale) fall back to a fresh read.
  const fromStage =
    options?.fromStage !== undefined
      ? options.fromStage
      : await currentStageOf(id);
  const wonDetails =
    options?.closingAmount !== undefined
      ? `Opportunity marked Won — ₹${options.closingAmount.toLocaleString("en-IN")}${options.remarks ? ` — ${options.remarks}` : ""}`
      : options?.remarks || "Opportunity marked Won";
  // Record update and history append must land as-if-atomic (see changeCrmOpportunityStage) —
  // sequential, not Promise.all. Audit/activity logging stays parallel for latency.
  await updateInCollection(CRM_OPPORTUNITIES_PATH, id, {
    status: "WON",
    stage: "won",
    stageEnteredAt: now,
    wonAt: now,
    ...(options?.closingAmount !== undefined
      ? { closingAmount: options.closingAmount }
      : {}),
    ...(options?.closingDate ? { closingDate: options.closingDate } : {}),
  });
  await appendStageHistory(
    id,
    fromStage,
    "won",
    changedBy,
    options?.remarks || "Marked Won",
  );
  await Promise.all([
    writeCrmAuditLog({
      action: "opportunity_won",
      entityType: "opportunity",
      entityId: id,
      details: wonDetails,
      by: changedBy,
      at: now,
    }),
    logCrmActivitySilently({
      relatedType: "opportunity",
      relatedId: id,
      type: "Stage Change",
      subject: "Deal Won",
      notes: wonDetails,
      occurredAt: now,
      createdBy: changedBy,
    }),
  ]);
}

export async function markCrmOpportunityLost(
  id: string,
  reason: CrmLostReason,
  changedBy: string,
  reasonOther?: string,
  remarks?: string,
  competitor?: string,
  fromStage?: string,
): Promise<void> {
  const resolvedFromStage =
    fromStage !== undefined ? fromStage : await currentStageOf(id);
  const now = Date.now();
  const lostDetails = `Opportunity marked Lost — ${reason}${competitor ? ` (competitor: ${competitor})` : ""}${reasonOther ? `: ${reasonOther}` : ""}`;
  await updateInCollection(CRM_OPPORTUNITIES_PATH, id, {
    status: "LOST",
    stage: "lost",
    stageEnteredAt: now,
    lostReason: reason,
    lostReasonOther: reasonOther || "",
    lostAt: now,
    ...(competitor ? { competitor } : {}),
  });
  await appendStageHistory(
    id,
    resolvedFromStage,
    "lost",
    changedBy,
    remarks || `Marked Lost — ${reason}`,
  );
  await Promise.all([
    writeCrmAuditLog({
      action: "opportunity_lost",
      entityType: "opportunity",
      entityId: id,
      newValue: reason,
      details: lostDetails,
      by: changedBy,
      at: now,
    }),
    logCrmActivitySilently({
      relatedType: "opportunity",
      relatedId: id,
      type: "Stage Change",
      subject: "Deal Lost",
      notes: lostDetails,
      occurredAt: now,
      createdBy: changedBy,
    }),
  ]);
}

export async function setCrmOpportunityOnHold(
  id: string,
  reason: CrmHoldReason,
  changedBy: string,
  options?: {
    reasonOther?: string;
    expectedResumeDate?: string;
    notes?: string;
    fromStage?: string;
  },
): Promise<void> {
  const now = Date.now();
  const fromStage =
    options?.fromStage !== undefined
      ? options.fromStage
      : await currentStageOf(id);
  const holdDetails = `Opportunity put On Hold — ${reason}${options?.expectedResumeDate ? ` (expected resume ${options.expectedResumeDate})` : ""}${options?.notes ? ` — ${options.notes}` : ""}`;
  await updateInCollection(CRM_OPPORTUNITIES_PATH, id, {
    status: "ON_HOLD",
    holdReason: reason,
    holdReasonOther: options?.reasonOther || "",
    expectedResumeDate: options?.expectedResumeDate || "",
    holdNotes: options?.notes || "",
    onHoldAt: now,
  });
  await appendStageHistory(
    id,
    fromStage,
    "on_hold",
    changedBy,
    options?.notes || `Put On Hold — ${reason}`,
  );
  await Promise.all([
    writeCrmAuditLog({
      action: "opportunity_on_hold",
      entityType: "opportunity",
      entityId: id,
      newValue: reason,
      details: holdDetails,
      by: changedBy,
      at: now,
    }),
    logCrmActivitySilently({
      relatedType: "opportunity",
      relatedId: id,
      type: "Stage Change",
      subject: "Deal Put On Hold",
      notes: holdDetails,
      occurredAt: now,
      createdBy: changedBy,
    }),
  ]);
}

/** Reopens a Won/Lost/On-Hold opportunity back to OPEN in the given stage. Used both by the
 *  generic "Reopen Opportunity" action (Won/Lost) and the On-Hold "Resume" action — either way
 *  the caller picks the target stage, and any hold detail fields are cleared since they no
 *  longer describe the deal's current state. */
export async function reopenCrmOpportunity(
  id: string,
  stage: string,
  changedBy: string,
  fromStage?: string,
): Promise<void> {
  const now = Date.now();
  const resolvedFromStage =
    fromStage !== undefined ? fromStage : await currentStageOf(id);
  await updateInCollection(CRM_OPPORTUNITIES_PATH, id, {
    status: "OPEN",
    stage,
    stageEnteredAt: now,
    resumedAt: now,
    lostReason: null,
    lostReasonOther: null,
    holdReason: null,
    holdReasonOther: null,
    expectedResumeDate: null,
    holdNotes: null,
    stuckReason: null,
    stuckReasonOther: null,
  });
  await appendStageHistory(id, resolvedFromStage, stage, changedBy, "Reopened");
  await Promise.all([
    writeCrmAuditLog({
      action: "opportunity_reopened",
      entityType: "opportunity",
      entityId: id,
      details: `Opportunity reopened into "${stage}"`,
      by: changedBy,
      at: now,
    }),
    logCrmActivitySilently({
      relatedType: "opportunity",
      relatedId: id,
      type: "Stage Change",
      subject: "Deal Reopened",
      notes: `Reopened into ${stageLabel(stage)}`,
      occurredAt: now,
      createdBy: changedBy,
    }),
  ]);
}

export async function setCrmOpportunityStuckReason(
  id: string,
  reason: CrmStuckReason,
  reasonOther?: string,
): Promise<void> {
  await updateInCollection(CRM_OPPORTUNITIES_PATH, id, {
    stuckReason: reason,
    stuckReasonOther: reasonOther || "",
  });
}

export async function updateCrmOpportunity(
  id: string,
  data: Partial<CrmOpportunity>,
  by: string,
  previous?: Partial<CrmOpportunity>,
): Promise<void> {
  const now = Date.now();
  const writes: Promise<unknown>[] = [
    updateInCollection(CRM_OPPORTUNITIES_PATH, id, data),
    writeCrmAuditLog({
      action: "opportunity_updated",
      entityType: "opportunity",
      entityId: id,
      details: "Opportunity details updated",
      by,
      at: now,
    }),
  ];
  if (
    previous?.ownerName &&
    data.ownerName &&
    previous.ownerName !== data.ownerName
  ) {
    writes.push(
      writeCrmAuditLog({
        action: "opportunity_owner_changed",
        entityType: "opportunity",
        entityId: id,
        previousValue: previous.ownerName,
        newValue: data.ownerName,
        details: `Owner changed from ${previous.ownerName} to ${data.ownerName}`,
        by,
        at: now,
      }),
      logCrmActivitySilently({
        relatedType: "opportunity",
        relatedId: id,
        type: "Stage Change",
        subject: "Owner Changed",
        notes: `${previous.ownerName} → ${data.ownerName}`,
        occurredAt: now,
        createdBy: by,
      }),
    );
  }
  if (
    previous?.estimatedValue !== undefined &&
    data.estimatedValue !== undefined &&
    previous.estimatedValue !== data.estimatedValue
  ) {
    writes.push(
      writeCrmAuditLog({
        action: "opportunity_value_changed",
        entityType: "opportunity",
        entityId: id,
        previousValue: String(previous.estimatedValue),
        newValue: String(data.estimatedValue),
        details: `Estimated value changed from ₹${previous.estimatedValue.toLocaleString("en-IN")} to ₹${data.estimatedValue.toLocaleString("en-IN")}`,
        by,
        at: now,
      }),
      logCrmActivitySilently({
        relatedType: "opportunity",
        relatedId: id,
        type: "Stage Change",
        subject: "Deal Value Changed",
        notes: `₹${previous.estimatedValue.toLocaleString("en-IN")} → ₹${data.estimatedValue.toLocaleString("en-IN")}`,
        occurredAt: now,
        createdBy: by,
      }),
    );
  }
  await Promise.all(writes);
}

/**
 * Cascade soft-deletes an Opportunity along with everything tied to it (activities, meetings,
 * follow-ups, quotations logged against this opportunity's id, plus its stage-history node) into
 * the Recycle Bin, so nothing is left orphaned and Restore brings all of it back together. The
 * caller (OpportunityDrawer) already has the related ids live via `useCrmDomainData`.
 */
export async function deleteCrmOpportunityCascade(
  opportunity: { id: string; title: string },
  related: {
    activityIds: string[];
    meetingIds: string[];
    followUpIds: string[];
    quotationIds: string[];
  },
  user: User | null | undefined,
): Promise<void> {
  const relatedPaths: Record<string, string> = {
    stageHistory: `${CRM_STAGE_HISTORY_PATH}/${opportunity.id}`,
  };
  related.activityIds.forEach((aid) => {
    relatedPaths[`activity_${aid}`] = `crm/activities/${aid}`;
  });
  related.meetingIds.forEach((mid) => {
    relatedPaths[`meeting_${mid}`] = `crm/meetings/${mid}`;
  });
  related.followUpIds.forEach((fid) => {
    relatedPaths[`followup_${fid}`] = `crm/followups/${fid}`;
  });
  related.quotationIds.forEach((qid) => {
    relatedPaths[`quotation_${qid}`] = `crm/quotations/${qid}`;
  });

  const deleted = await softDeleteCrmRecordWithRelated(
    "opportunity",
    opportunity.title,
    CRM_OPPORTUNITIES_PATH,
    opportunity.id,
    user,
    relatedPaths,
  );
  if (!deleted) return;
  const totalRelated = Object.keys(relatedPaths).length - 1;
  await writeCrmAuditLog({
    action: "opportunity_deleted",
    entityType: "opportunity",
    entityId: opportunity.id,
    details: `Opportunity "${opportunity.title}" moved to Recycle Bin along with ${totalRelated} related record${totalRelated === 1 ? "" : "s"}`,
    by: user?.name || user?.username || "Unknown",
    at: Date.now(),
  });
}
