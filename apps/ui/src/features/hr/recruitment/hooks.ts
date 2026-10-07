"use client";

import { orgScopedKey } from "@texawave-erp/core";
import { useQuery } from "@tanstack/react-query";
import { useOrgScopedMutation } from "@/lib/use-org-scoped-mutation";
import { useAuthStore } from "@/stores/auth-store";
import {
  createInterview,
  createOfferLetter,
  createRevisionLetter,
  getInterview,
  getOfferLetter,
  getRevisionLetter,
  listInterviews,
  listOfferLetters,
  listRecruitmentEmployees,
  listRevisionLetters,
  setInterviewStatus,
  updateOfferLetter,
  updateRevisionLetter,
  type InterviewQuery,
  type PageQuery,
  type RevisionQuery,
} from "./api";
import type {
  CreateInterviewInput,
  CreateOfferLetterInput,
  CreateRevisionLetterInput,
  InterviewStatus,
  UpdateOfferLetterInput,
  UpdateRevisionLetterInput,
} from "./types";

/** Every Recruitment query lives under this prefix, so one invalidation
 * refreshes all three tabs after any write. */
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

export function useUpdateRevision() {
  return useOrgScopedMutation(
    [ROOT],
    ({ id, input }: { id: number; input: UpdateRevisionLetterInput }) =>
      updateRevisionLetter(id, input),
  );
}
