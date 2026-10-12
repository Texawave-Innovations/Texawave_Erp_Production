import type { Prisma } from "@texawave-erp/database";
import { classifyDbError } from "../../../common/database/db-errors.js";

type Tx = Prisma.TransactionClient;

/** Migrated verbatim from legacy's static `PIPELINE_STAGES` seed
 * (TexaWave_ERP/src/modules/crm/domain/config.ts) — same 13 stage codes,
 * labels, order and probabilities, so a freshly seeded organization's
 * board looks identical to legacy's. */
export const PIPELINE_STAGE_SEED: ReadonlyArray<{
  code: string;
  label: string;
  order: number;
  probability: number;
  isWon?: boolean;
  isLost?: boolean;
  isOnHold?: boolean;
}> = [
  { code: "new_lead", label: "New Lead", order: 1, probability: 5 },
  { code: "contacted", label: "Contacted", order: 2, probability: 10 },
  { code: "interested", label: "Interested", order: 3, probability: 20 },
  {
    code: "meeting_scheduled",
    label: "Meeting Scheduled",
    order: 4,
    probability: 30,
  },
  {
    code: "meeting_completed",
    label: "Meeting Completed",
    order: 5,
    probability: 40,
  },
  {
    code: "requirement_discussion",
    label: "Requirement Discussion",
    order: 6,
    probability: 50,
  },
  { code: "demo", label: "Demo", order: 7, probability: 60 },
  { code: "proposal", label: "Proposal", order: 8, probability: 70 },
  { code: "follow_up", label: "Follow-up", order: 9, probability: 75 },
  { code: "negotiation", label: "Negotiation", order: 10, probability: 85 },
  { code: "won", label: "Won", order: 11, probability: 100, isWon: true },
  { code: "lost", label: "Lost", order: 12, probability: 0, isLost: true },
  {
    code: "on_hold",
    label: "On Hold",
    order: 13,
    probability: 0,
    isOnHold: true,
  },
];

/**
 * Self-seeds an organization's pipeline stages from the static legacy list
 * on first use — reproduces legacy's `seedPipelineStagesIfEmpty` (seeds
 * once, only when the org has zero stages; never re-seeds or overwrites a
 * since-customized board). Must run inside the caller's own transaction so
 * a concurrent first-use race can't create two stage sets for the same
 * org; if it does race anyway, the losing side's `createMany` hits the
 * `(organizationId, code)` unique constraint and is swallowed here, since
 * "stages now exist for this org" is the only outcome that matters.
 */
export async function ensureSeededStages(
  tx: Tx,
  organizationId: number,
  actorId: number | null,
): Promise<void> {
  const existing = await tx.pipelineStage.count({ where: { organizationId } });
  if (existing > 0) return;
  try {
    await tx.pipelineStage.createMany({
      data: PIPELINE_STAGE_SEED.map((s) => ({
        organizationId,
        code: s.code,
        label: s.label,
        order: s.order,
        probability: s.probability,
        isWon: s.isWon ?? false,
        isLost: s.isLost ?? false,
        isOnHold: s.isOnHold ?? false,
        createdBy: actorId,
        updatedBy: actorId,
      })),
    });
  } catch (error) {
    if (classifyDbError(error)?.kind !== "unique") throw error;
  }
}

/** The stage a new deal lands in when no stage is explicitly chosen —
 * matches legacy's `boardStages[0]?.id || 'new_lead'` fallback in
 * `LeadConvertDialog.tsx` (first active, non-won/lost/on-hold stage by
 * `order`). Seeds first so this never returns `null` for an org that has
 * never touched the Pipeline module before. */
export async function defaultBoardStage(
  tx: Tx,
  organizationId: number,
  actorId: number | null,
) {
  await ensureSeededStages(tx, organizationId, actorId);
  return tx.pipelineStage.findFirst({
    where: {
      organizationId,
      deletedAt: null,
      isActive: true,
      isWon: false,
      isLost: false,
      isOnHold: false,
    },
    orderBy: { order: "asc" },
  });
}
