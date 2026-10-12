"use client";

import type {
  CreatePipelineStageInput,
  ReorderPipelineStagesInput,
  UpdatePipelineStageInput,
} from "@texawave-erp/api-types";
import { orgScopedKey } from "@texawave-erp/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import {
  createPipelineStage,
  deletePipelineStage,
  listPipelineStages,
  reorderPipelineStages,
  updatePipelineStage,
} from "./api";

function stagesKey(organizationId: number) {
  return orgScopedKey(organizationId, "crm-pipeline-stages");
}

export function usePipelineStages() {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: stagesKey(organizationId ?? 0),
    queryFn: listPipelineStages,
    enabled: Boolean(organizationId),
  });
}

function useInvalidateStages() {
  const queryClient = useQueryClient();
  const organizationId = useAuthStore((s) => s.organizationId);
  return () =>
    void queryClient.invalidateQueries({
      queryKey: stagesKey(organizationId ?? 0),
    });
}

export function useCreatePipelineStage() {
  const invalidate = useInvalidateStages();
  return useMutation({
    mutationFn: (input: CreatePipelineStageInput) => createPipelineStage(input),
    onSuccess: invalidate,
  });
}

export function useUpdatePipelineStage() {
  const invalidate = useInvalidateStages();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: number;
      input: UpdatePipelineStageInput;
    }) => updatePipelineStage(id, input),
    onSuccess: invalidate,
  });
}

export function useReorderPipelineStages() {
  const invalidate = useInvalidateStages();
  return useMutation({
    mutationFn: (input: ReorderPipelineStagesInput) =>
      reorderPipelineStages(input),
    onSuccess: invalidate,
  });
}

export function useDeletePipelineStage() {
  const invalidate = useInvalidateStages();
  return useMutation({
    mutationFn: (id: number) => deletePipelineStage(id),
    onSuccess: invalidate,
  });
}
