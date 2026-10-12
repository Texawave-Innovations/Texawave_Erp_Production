// HANDWRITTEN — mirrors apps/api/src/modules/crm/pipeline-stages/. Migrated
// from the LIVE legacy TexaWave_ERP/src/modules/crm/domain/
// pipelineStagesService.ts + config.ts. See packages/api-types/README.md.

export interface PipelineStage {
  id: number;
  organizationId: number;
  code: string;
  label: string;
  order: number;
  probability: number | null;
  isWon: boolean;
  isLost: boolean;
  isOnHold: boolean;
  slaDays: number | null;
  isActive: boolean;
  createdBy: number | null;
  updatedBy: number | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreatePipelineStageInput {
  label: string;
  order?: number | undefined;
  slaDays?: number | undefined;
  probability?: number | undefined;
}

export type UpdatePipelineStageInput = Partial<CreatePipelineStageInput> & {
  isActive?: boolean | undefined;
};

export interface ReorderPipelineStagesInput {
  orderedIds: number[];
}
