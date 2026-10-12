"use client";

import { orgScopedKey } from "@texawave-erp/core";
import { useQuery } from "@tanstack/react-query";
import { useOrgScopedMutation } from "@/lib/use-org-scoped-mutation";
import { useAuthStore } from "@/stores/auth-store";
import {
  createInterview,
  createOfferLetter,
  createPromotionLetter,
  createRevisionLetter,
  getInterview,
  getOfferLetter,
  getPromotionLetter,
  getRevisionLetter,
  getSalaryHistory,
  listInterviews,
  listOfferLetters,
  listPromotionLetters,
  listRecruitmentEmployees,
  listRevisionLetters,
  setInterviewStatus,
  updateOfferLetter,
  updatePromotionLetter,
  updateRevisionLetter,
  type InterviewQuery,
  type PageQuery,
  type RevisionQuery,
} from "./api";
import type {
  CreateInterviewInput,
  CreateOfferLetterInput,
  CreatePromotionLetterInput,
  CreateRevisionLetterInput,
  InterviewStatus,
  UpdateOfferLetterInput,
  UpdatePromotionLetterInput,
  UpdateRevisionLetterInput,
} from "./types";

/** Every Recruitment query lives under this prefix, so one invalidation
 * refreshes every tab after any write. */
const ROOT = "hr-recruitment";

function useOrgId() {
  return useAuthStore((s) => s.organizationId) ?? 0;
}

export function useInterviews(query: InterviewQuery, enabled = true) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, ROOT, "interviews", query),
    queryFn: () => listInterviews(query),
    enabled: Boolean(orgId) && enabled,
  });
}

export function useInterview(id: number | undefined) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, ROOT, "interviews", "detail", id ?? 0),
    queryFn: () => getInterview(id as number),
    enabled: Boolean(orgId) && id !== undefined,
  });
}

export function useOffers(query: PageQuery, enabled = true) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, ROOT, "offers", query),
    queryFn: () => listOfferLetters(query),
    enabled: Boolean(orgId) && enabled,
  });
}

export function useOffer(id: number | undefined) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, ROOT, "offers", "detail", id ?? 0),
    queryFn: () => getOfferLetter(id as number),
    enabled: Boolean(orgId) && id !== undefined,
  });
}

export function useRevisions(query: RevisionQuery, enabled = true) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, ROOT, "revisions", query),
    queryFn: () => listRevisionLetters(query),
    enabled: Boolean(orgId) && enabled,
  });
}

export function useRevision(id: number | undefined) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, ROOT, "revisions", "detail", id ?? 0),
    queryFn: () => getRevisionLetter(id as number),
    enabled: Boolean(orgId) && id !== undefined,
  });
}

export function usePromotions(query: RevisionQuery, enabled = true) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, ROOT, "promotions", query),
    queryFn: () => listPromotionLetters(query),
    enabled: Boolean(orgId) && enabled,
  });
}

export function usePromotion(id: number | undefined) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, ROOT, "promotions", "detail", id ?? 0),
    queryFn: () => getPromotionLetter(id as number),
    enabled: Boolean(orgId) && id !== undefined,
  });
}

/** Loaded only while an employee's history is expanded. Under ROOT, so issuing
 * or editing a letter refreshes an open history too. */
export function useSalaryHistory(employeeId: number | undefined) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, ROOT, "salary-history", employeeId ?? 0),
    queryFn: () => getSalaryHistory(employeeId as number),
    enabled: Boolean(orgId) && employeeId !== undefined,
  });
}

export function useRecruitmentEmployees(query: PageQuery, enabled = true) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, ROOT, "employees", query),
    queryFn: () => listRecruitmentEmployees(query),
    enabled: Boolean(orgId) && enabled,
  });
}

export function useCreateInterview() {
  return useOrgScopedMutation([ROOT], (input: CreateInterviewInput) =>
    createInterview(input),
  );
}

export function useSetInterviewStatus() {
  return useOrgScopedMutation(
    [ROOT],
    ({ id, status }: { id: number; status: InterviewStatus }) =>
      setInterviewStatus(id, status),
  );
}

export function useCreateOffer() {
  return useOrgScopedMutation([ROOT], (input: CreateOfferLetterInput) =>
    createOfferLetter(input),
  );
}

export function useUpdateOffer() {
  return useOrgScopedMutation(
    [ROOT],
    ({ id, input }: { id: number; input: UpdateOfferLetterInput }) =>
      updateOfferLetter(id, input),
  );
}

export function useCreateRevision() {
  return useOrgScopedMutation([ROOT], (input: CreateRevisionLetterInput) =>
    createRevisionLetter(input),
  );
}

export function useCreatePromotion() {
  return useOrgScopedMutation([ROOT], (input: CreatePromotionLetterInput) =>
    createPromotionLetter(input),
  );
}

export function useUpdatePromotion() {
  return useOrgScopedMutation(
    [ROOT],
    ({ id, input }: { id: number; input: UpdatePromotionLetterInput }) =>
      updatePromotionLetter(id, input),
  );
}

export function useUpdateRevision() {
  return useOrgScopedMutation(
    [ROOT],
    ({ id, input }: { id: number; input: UpdateRevisionLetterInput }) =>
      updateRevisionLetter(id, input),
  );
}
