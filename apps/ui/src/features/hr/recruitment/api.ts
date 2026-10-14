import type { PaginatedEnvelope } from "@texawave-erp/api-types";
import { apiClient, withAuthRetry } from "@/lib/api-client";
import type {
  CreateInterviewInput,
  CreateOfferLetterInput,
  CreatePromotionLetterInput,
  CreateRevisionLetterInput,
  InterviewStatus,
  InterviewView,
  OfferLetterView,
  PromotionLetterView,
  RecruitmentEmployee,
  RevisionLetterView,
  SalaryHistoryView,
  UpdateOfferLetterInput,
  UpdatePromotionLetterInput,
  UpdateRevisionLetterInput,
} from "./types";

export interface PageQuery {
  page: number;
  limit: number;
  search?: string;
}

export interface InterviewQuery extends PageQuery {
  status?: InterviewStatus;
}

/** Revision and promotion letter lists take the same query. */
export interface RevisionQuery {
  page: number;
  limit: number;
  employeeId?: number;
}

export function listInterviews(
  query: InterviewQuery,
): Promise<PaginatedEnvelope<InterviewView>> {
  return withAuthRetry(() =>
    apiClient.get<InterviewView[]>("/hr/interviews", { query }),
  ) as Promise<PaginatedEnvelope<InterviewView>>;
}

export async function getInterview(id: number): Promise<InterviewView> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<InterviewView>(`/hr/interviews/${id}`),
  );
  return data;
}

export async function createInterview(
  input: CreateInterviewInput,
): Promise<InterviewView> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<InterviewView>("/hr/interviews", input),
  );
  return data;
}

export async function setInterviewStatus(
  id: number,
  status: InterviewStatus,
): Promise<InterviewView> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<InterviewView>(`/hr/interviews/${id}/status`, { status }),
  );
  return data;
}

export function listOfferLetters(
  query: PageQuery,
): Promise<PaginatedEnvelope<OfferLetterView>> {
  return withAuthRetry(() =>
    apiClient.get<OfferLetterView[]>("/hr/offer-letters", { query }),
  ) as Promise<PaginatedEnvelope<OfferLetterView>>;
}

export async function getOfferLetter(id: number): Promise<OfferLetterView> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<OfferLetterView>(`/hr/offer-letters/${id}`),
  );
  return data;
}

export async function createOfferLetter(
  input: CreateOfferLetterInput,
): Promise<OfferLetterView> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<OfferLetterView>("/hr/offer-letters", input),
  );
  return data;
}

export async function updateOfferLetter(
  id: number,
  input: UpdateOfferLetterInput,
): Promise<OfferLetterView> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<OfferLetterView>(`/hr/offer-letters/${id}`, input),
  );
  return data;
}

export function listRevisionLetters(
  query: RevisionQuery,
): Promise<PaginatedEnvelope<RevisionLetterView>> {
  return withAuthRetry(() =>
    apiClient.get<RevisionLetterView[]>("/hr/revision-letters", { query }),
  ) as Promise<PaginatedEnvelope<RevisionLetterView>>;
}

export async function getRevisionLetter(
  id: number,
): Promise<RevisionLetterView> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<RevisionLetterView>(`/hr/revision-letters/${id}`),
  );
  return data;
}

export async function createRevisionLetter(
  input: CreateRevisionLetterInput,
): Promise<RevisionLetterView> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<RevisionLetterView>("/hr/revision-letters", input),
  );
  return data;
}

export async function updateRevisionLetter(
  id: number,
  input: UpdateRevisionLetterInput,
): Promise<RevisionLetterView> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<RevisionLetterView>(`/hr/revision-letters/${id}`, input),
  );
  return data;
}

export function listPromotionLetters(
  query: RevisionQuery,
): Promise<PaginatedEnvelope<PromotionLetterView>> {
  return withAuthRetry(() =>
    apiClient.get<PromotionLetterView[]>("/hr/promotion-letters", { query }),
  ) as Promise<PaginatedEnvelope<PromotionLetterView>>;
}

export async function getPromotionLetter(
  id: number,
): Promise<PromotionLetterView> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<PromotionLetterView>(`/hr/promotion-letters/${id}`),
  );
  return data;
}

export async function createPromotionLetter(
  input: CreatePromotionLetterInput,
): Promise<PromotionLetterView> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<PromotionLetterView>("/hr/promotion-letters", input),
  );
  return data;
}

export async function updatePromotionLetter(
  id: number,
  input: UpdatePromotionLetterInput,
): Promise<PromotionLetterView> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<PromotionLetterView>(`/hr/promotion-letters/${id}`, input),
  );
  return data;
}

export async function getSalaryHistory(
  employeeId: number,
): Promise<SalaryHistoryView> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<SalaryHistoryView>(
      `/hr/promotion-letters/salary-history/${employeeId}`,
    ),
  );
  return data;
}

export function listRecruitmentEmployees(
  query: PageQuery,
): Promise<PaginatedEnvelope<RecruitmentEmployee>> {
  return withAuthRetry(() =>
    apiClient.get<RecruitmentEmployee[]>("/hr/employees", { query }),
  ) as Promise<PaginatedEnvelope<RecruitmentEmployee>>;
}
