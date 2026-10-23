import type {
  CreatePipelineStageInput,
  PipelineStage,
  ReorderPipelineStagesInput,
  UpdatePipelineStageInput,
} from "@texawave-erp/api-types";
import { apiClient, withAuthRetry } from "@/lib/api-client";

/** Thin wrappers around the shared `apiClient` — mirrors
 * apps/ui/src/features/crm/contacts/api.ts. Migrated from the LIVE legacy
 * TexaWave_ERP/src/modules/crm/domain/pipelineStagesService.ts. Not
 * paginated — a board's stage count is always small (~13). */
export async function listPipelineStages(): Promise<PipelineStage[]> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<PipelineStage[]>("/crm/pipeline-stages"),
  );
  return data;
}

export async function createPipelineStage(
  input: CreatePipelineStageInput,
): Promise<PipelineStage> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<PipelineStage>("/crm/pipeline-stages", input),
  );
  return data;
}

export async function updatePipelineStage(
  id: number,
  input: UpdatePipelineStageInput,
): Promise<PipelineStage> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<PipelineStage>(`/crm/pipeline-stages/${id}`, input),
  );
  return data;
}

export async function reorderPipelineStages(
  input: ReorderPipelineStagesInput,
): Promise<PipelineStage[]> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<PipelineStage[]>("/crm/pipeline-stages/reorder", input),
  );
  return data;
}

export async function deletePipelineStage(id: number): Promise<void> {
  await withAuthRetry(() =>
    apiClient.delete<void>(`/crm/pipeline-stages/${id}`),
  );
}
