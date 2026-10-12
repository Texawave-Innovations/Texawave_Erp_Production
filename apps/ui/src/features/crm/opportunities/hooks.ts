"use client";

import type {
  AddOpportunityProductsInput,
  ChangeStageInput,
  CreateOpportunityInput,
  MarkLostInput,
  MarkWonInput,
  QueryOpportunitiesInput,
  ReopenInput,
  SetOnHoldInput,
  SetStuckReasonInput,
  UpdateOpportunityInput,
  UpdateOpportunityProductInput,
} from "@texawave-erp/api-types";
import { orgScopedKey } from "@texawave-erp/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import {
  addOpportunityProducts,
  changeOpportunityStage,
  createOpportunity,
  deleteOpportunity,
  getStageHistory,
  listOpportunities,
  listOpportunityProducts,
  markOpportunityLost,
  markOpportunityWon,
  removeOpportunityProduct,
  reopenOpportunity,
  setOpportunityOnHold,
  setOpportunityStuckReason,
  updateOpportunity,
  updateOpportunityProduct,
} from "./api";

function opportunitiesKey(
  organizationId: number,
  query?: QueryOpportunitiesInput,
) {
  return query === undefined
    ? orgScopedKey(organizationId, "crm-opportunities")
    : orgScopedKey(organizationId, "crm-opportunities", query);
}

export function useOpportunities(query: QueryOpportunitiesInput) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: opportunitiesKey(organizationId ?? 0, query),
    queryFn: () => listOpportunities(query),
    enabled: Boolean(organizationId),
  });
}

export function useStageHistory(opportunityId: number | undefined) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey:
      opportunityId === undefined
        ? orgScopedKey(organizationId ?? 0, "crm-opportunity-stage-history")
        : orgScopedKey(
            organizationId ?? 0,
            "crm-opportunity-stage-history",
            opportunityId,
          ),
    queryFn: () => getStageHistory(opportunityId as number),
    enabled: Boolean(organizationId) && opportunityId !== undefined,
  });
}

function useInvalidateOpportunities() {
  const queryClient = useQueryClient();
  const organizationId = useAuthStore((s) => s.organizationId);
  return () =>
    void queryClient.invalidateQueries({
      queryKey: orgScopedKey(organizationId ?? 0, "crm-opportunities"),
    });
}

export function useCreateOpportunity() {
  const invalidate = useInvalidateOpportunities();
  return useMutation({
    mutationFn: (input: CreateOpportunityInput) => createOpportunity(input),
    onSuccess: invalidate,
  });
}

export function useUpdateOpportunity() {
  const invalidate = useInvalidateOpportunities();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: number;
      input: UpdateOpportunityInput;
    }) => updateOpportunity(id, input),
    onSuccess: invalidate,
  });
}

export function useChangeOpportunityStage() {
  const invalidate = useInvalidateOpportunities();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: ChangeStageInput }) =>
      changeOpportunityStage(id, input),
    onSuccess: invalidate,
  });
}

export function useMarkOpportunityWon() {
  const invalidate = useInvalidateOpportunities();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: MarkWonInput }) =>
      markOpportunityWon(id, input),
    onSuccess: invalidate,
  });
}

export function useMarkOpportunityLost() {
  const invalidate = useInvalidateOpportunities();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: MarkLostInput }) =>
      markOpportunityLost(id, input),
    onSuccess: invalidate,
  });
}

export function useSetOpportunityOnHold() {
  const invalidate = useInvalidateOpportunities();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: SetOnHoldInput }) =>
      setOpportunityOnHold(id, input),
    onSuccess: invalidate,
  });
}

export function useReopenOpportunity() {
  const invalidate = useInvalidateOpportunities();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: ReopenInput }) =>
      reopenOpportunity(id, input),
    onSuccess: invalidate,
  });
}

export function useSetOpportunityStuckReason() {
  const invalidate = useInvalidateOpportunities();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: SetStuckReasonInput }) =>
      setOpportunityStuckReason(id, input),
    onSuccess: invalidate,
  });
}

export function useDeleteOpportunity() {
  const invalidate = useInvalidateOpportunities();
  return useMutation({
    mutationFn: (id: number) => deleteOpportunity(id),
    onSuccess: invalidate,
  });
}

function lineItemsKey(
  organizationId: number,
  opportunityId: number | undefined,
) {
  return opportunityId === undefined
    ? orgScopedKey(organizationId, "crm-opportunity-products")
    : orgScopedKey(organizationId, "crm-opportunity-products", opportunityId);
}

export function useOpportunityProducts(opportunityId: number | undefined) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: lineItemsKey(organizationId ?? 0, opportunityId),
    queryFn: () => listOpportunityProducts(opportunityId as number),
    enabled: Boolean(organizationId) && opportunityId !== undefined,
  });
}

function useInvalidateOpportunityProducts() {
  const queryClient = useQueryClient();
  const organizationId = useAuthStore((s) => s.organizationId);
  return () =>
    void queryClient.invalidateQueries({
      queryKey: orgScopedKey(organizationId ?? 0, "crm-opportunity-products"),
    });
}

export function useAddOpportunityProducts() {
  const invalidate = useInvalidateOpportunityProducts();
  return useMutation({
    mutationFn: ({
      opportunityId,
      input,
    }: {
      opportunityId: number;
      input: AddOpportunityProductsInput;
    }) => addOpportunityProducts(opportunityId, input),
    onSuccess: invalidate,
  });
}

export function useUpdateOpportunityProduct() {
  const invalidate = useInvalidateOpportunityProducts();
  return useMutation({
    mutationFn: ({
      opportunityId,
      itemId,
      input,
    }: {
      opportunityId: number;
      itemId: number;
      input: UpdateOpportunityProductInput;
    }) => updateOpportunityProduct(opportunityId, itemId, input),
    onSuccess: invalidate,
  });
}

export function useRemoveOpportunityProduct() {
  const invalidate = useInvalidateOpportunityProducts();
  return useMutation({
    mutationFn: ({
      opportunityId,
      itemId,
    }: {
      opportunityId: number;
      itemId: number;
    }) => removeOpportunityProduct(opportunityId, itemId),
    onSuccess: invalidate,
  });
}
