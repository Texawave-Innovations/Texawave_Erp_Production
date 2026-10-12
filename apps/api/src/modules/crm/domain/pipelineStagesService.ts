// CRM Core Domain — Configurable Pipeline Stages. Isolated Firebase path: `crm/pipelineStages`,
// keyed by the SAME stage id strings opportunities already store on `CrmOpportunity.stage`
// (e.g. `new_lead`), so converting from the static `PIPELINE_STAGES` seed to this Firebase-backed
// collection never invalidates any existing opportunity's stage. If the collection is empty (first
// run), `seedPipelineStagesIfEmpty` writes the existing static list once so the board never breaks.
import { useEffect, useState } from "react";
import { get, ref, runTransaction, set, update } from "firebase/database";
import { database } from "@/services/firebase";
import { CRM_PIPELINE_STAGES_PATH } from "./config";
import { subscribeCollection } from "./firebaseCollection";
import { PipelineStageDef, PIPELINE_STAGES } from "./config";
import { writeCrmAuditLog } from "../intelligence/auditService";
import { softDeleteCrmRecord } from "./recycleBinService";
import { User } from "@/types";

// `config.ts`'s `stageLabel()` is a static lookup against the hardcoded `PIPELINE_STAGES` seed —
// it has no way to know about a stage created or renamed through this Firebase-backed admin
// screen, so it shows a stage's raw id anywhere it's used (drawers, toasts, detail pages) once
// that stage diverges from the seed. This module-level cache is kept current by every live
// subscription below (there is normally always at least one active — every screen that needs the
// stage list goes through `useCrmPipelineStages()`), and `liveStageLabel()` reads it first,
// falling back to the static seed only when nothing has ever been subscribed yet.
let liveStagesCache: PipelineStageDef[] | null = null;

export function liveStageLabel(stageId: string): string {
  const fromLive = liveStagesCache?.find((s) => s.id === stageId)?.label;
  if (fromLive) return fromLive;
  return PIPELINE_STAGES.find((s) => s.id === stageId)?.label || stageId;
}

export function subscribeCrmPipelineStages(
  callback: (stages: PipelineStageDef[]) => void,
): () => void {
  return subscribeCollection<PipelineStageDef & { id: string }>(
    CRM_PIPELINE_STAGES_PATH,
    (items) => {
      items.sort((a, b) => a.order - b.order);
      if (items.length > 0) liveStagesCache = items;
      callback(items);
    },
  );
}

export async function seedPipelineStagesIfEmpty(): Promise<void> {
  const snap = await get(ref(database, CRM_PIPELINE_STAGES_PATH));
  if (snap.exists()) return;
  const updates: Record<string, Omit<PipelineStageDef, "id">> = {};
  PIPELINE_STAGES.forEach((s) => {
    const { id, ...rest } = s;
    updates[id] = {
      ...rest,
      active: true,
      slaDays: rest.isWon || rest.isLost ? undefined : 7,
    };
  });
  await set(ref(database, CRM_PIPELINE_STAGES_PATH), updates);
}

export async function createPipelineStage(
  input: { label: string; order: number; slaDays?: number },
  by: string,
): Promise<string> {
  const slug =
    input.label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || `stage_${Date.now()}`;

  const stageData = {
    label: input.label.trim(),
    order: input.order,
    active: true,
    slaDays: input.slaDays ?? 7,
  };

  // Slugified label collides with an existing stage id (e.g. a seeded stage like `follow_up`), or
  // with another create racing this one for the same fresh label -> plain get()-then-set() lets
  // both concurrent calls observe "not taken" and the second set() silently overwrites the first.
  // runTransaction claims the id atomically: it aborts (returns undefined, writes nothing) if the
  // path is already occupied by the time it actually commits, so only one caller ever wins a slug.
  let id = slug;
  let result = await runTransaction(
    ref(database, `${CRM_PIPELINE_STAGES_PATH}/${id}`),
    (current) => (current === null ? stageData : undefined),
  );
  if (!result.committed) {
    id = `${slug}_${Date.now()}`;
    result = await runTransaction(
      ref(database, `${CRM_PIPELINE_STAGES_PATH}/${id}`),
      (current) => (current === null ? stageData : undefined),
    );
    if (!result.committed) {
      throw new Error("Could not create the stage — please try again.");
    }
  }

  await writeCrmAuditLog({
    action: "pipeline_stage_created",
    entityType: "pipelineStage",
    entityId: id,
    details: `Stage "${input.label}" created`,
    by,
    at: Date.now(),
  });
  return id;
}

export async function updatePipelineStage(
  id: string,
  data: Partial<
    Pick<
      PipelineStageDef,
      "label" | "slaDays" | "active" | "order" | "probability"
    >
  >,
): Promise<void> {
  await update(ref(database, `${CRM_PIPELINE_STAGES_PATH}/${id}`), data);
}

export async function reorderPipelineStages(
  orderedIds: string[],
): Promise<void> {
  const updates: Record<string, number> = {};
  orderedIds.forEach((id, index) => {
    updates[`${CRM_PIPELINE_STAGES_PATH}/${id}/order`] = index + 1;
  });
  await update(ref(database), updates);
}

/** Refuses to delete a stage that any opportunity currently occupies — throws with a clear,
 *  user-facing message instead (caller shows it in the confirm dialog). */
export async function deletePipelineStage(
  id: string,
  opportunitiesInStageCount: number,
  user: User | null | undefined,
  label: string,
): Promise<void> {
  if (opportunitiesInStageCount > 0) {
    throw new Error(
      `Can't delete "${label}" — ${opportunitiesInStageCount} opportunit${opportunitiesInStageCount === 1 ? "y is" : "ies are"} currently in this stage. Move them first.`,
    );
  }
  const deleted = await softDeleteCrmRecord(
    "pipelineStage",
    label,
    CRM_PIPELINE_STAGES_PATH,
    id,
    user,
  );
  if (!deleted) return;
  await writeCrmAuditLog({
    action: "pipeline_stage_deleted",
    entityType: "pipelineStage",
    entityId: id,
    details: `Stage "${label}" moved to Recycle Bin`,
    by: user?.name || user?.username || "Unknown",
    at: Date.now(),
  });
}

/**
 * One shared hook for every screen that needs the live, configurable stage list (Pipeline board,
 * OpportunityDrawer, AccountDetail's opportunity-create dialog). Starts from the static
 * `PIPELINE_STAGES` seed so nothing flashes empty before Firebase responds, then switches to the
 * live collection once it has data (self-seeding on first run via `seedPipelineStagesIfEmpty`).
 */
export function useCrmPipelineStages(): {
  stages: PipelineStageDef[];
  boardStages: PipelineStageDef[];
  loading: boolean;
} {
  const [stages, setStages] = useState<PipelineStageDef[]>(PIPELINE_STAGES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    seedPipelineStagesIfEmpty().catch((err) =>
      console.error("Failed to seed pipeline stages:", err),
    );
    return subscribeCrmPipelineStages((items) => {
      if (items.length > 0) setStages(items);
      setLoading(false);
    });
  }, []);

  const boardStages = stages
    .filter(
      (s) => (s.active ?? true) && !s.isWon && !s.isLost && s.id !== "on_hold",
    )
    .sort((a, b) => a.order - b.order);

  return { stages, boardStages, loading };
}
