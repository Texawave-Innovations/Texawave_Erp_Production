// Wire types for the Recruitment API (apps/api/src/modules/hr/{interviews,
// offer-letters,revision-letters,promotion-letters}). Hand-written from the DTOs and the
// `*View` mappers; keep in step with those files.

export const INTERVIEW_STATUSES = [
  "SCHEDULED",
  "COMPLETED",
  "SELECTED",
  "REJECTED",
  "NO_SHOW",
] as const;
export type InterviewStatus = (typeof INTERVIEW_STATUSES)[number];

export const INTERVIEW_MODES = ["ONLINE", "IN_PERSON", "PHONE"] as const;
export type InterviewMode = (typeof INTERVIEW_MODES)[number];

export interface InterviewView {
  id: number;
  candidateName: string;
  roleTitle: string;
  interviewerName: string;
  interviewDate: string;
  interviewTime: string;
  mode: InterviewMode;
  status: InterviewStatus;
  notes: string | null;
  createdBy: number | null;
  updatedBy: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateInterviewInput {
  candidateName: string;
  roleTitle: string;
  interviewerName: string;
  interviewDate: string;
  interviewTime: string;
  mode?: InterviewMode;
  notes?: string;
}

export interface MoneyComponents {
  basic: string;
  da: string;
  hra: string;
  ca: string;
}

export interface OfferLetterView {
  id: number;
  candidateName: string;
  role: string;
  location: string;
  reportingManager: string;
  offerDate: string;
  joiningDate: string;
  offerValidityDate: string;
  components: MoneyComponents;
  grossMonthly: string;
  grossAnnual: string;
  workSchedule: { monFri: string; sat: string; sun: string };
  signatoryName: string;
  signatoryDesignation: string;
  companyEmail: string;
  companyPhone: string;
  companyWebsite: string;
  companyAddress: string;
  status: "GENERATED";
  createdBy: number | null;
  updatedBy: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOfferLetterInput {
  candidateName: string;
  role: string;
  location?: string;
  reportingManager?: string;
  offerDate?: string;
  joiningDate: string;
  offerValidityDate?: string;
  basic?: number;
  da?: number;
  hra?: number;
  ca?: number;
  workScheduleMonFri?: string;
  workScheduleSat?: string;
  workScheduleSun?: string;
  signatoryName?: string;
  signatoryDesignation?: string;
  companyEmail?: string;
  companyPhone?: string;
  companyWebsite?: string;
  companyAddress?: string;
}

export type UpdateOfferLetterInput = Partial<CreateOfferLetterInput>;

export interface RevisionLetterView {
  id: number;
  documentNo: string;
  employee: { id: number; employeeCode: string; fullName: string };
  employeeName: string;
  designation: string;
  location: string;
  letterDate: string;
  effectiveDate: string;
  components: MoneyComponents;
  grossMonthly: string;
  grossAnnual: string;
  signatoryName: string;
  signatoryDesignation: string;
  status: "GENERATED";
  createdBy: number | null;
  updatedBy: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRevisionLetterInput {
  employeeId: number;
  designation: string;
  location?: string;
  letterDate?: string;
  effectiveDate?: string;
  basic?: number;
  da?: number;
  hra?: number;
  ca?: number;
  signatoryName?: string;
  signatoryDesignation?: string;
}

export type UpdateRevisionLetterInput = Omit<
  Partial<CreateRevisionLetterInput>,
  "employeeId"
>;

export interface PromotionLetterView {
  id: number;
  documentNo: string;
  employee: { id: number; employeeCode: string; fullName: string };
  employeeName: string;
  designationId: number;
  designation: string;
  previousDesignation: string;
  location: string;
  letterDate: string;
  effectiveDate: string;
  components: MoneyComponents;
  grossMonthly: string;
  grossAnnual: string;
  signatoryName: string;
  signatoryDesignation: string;
  status: "GENERATED";
  createdBy: number | null;
  updatedBy: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePromotionLetterInput {
  employeeId: number;
  designationId: number;
  location?: string;
  letterDate?: string;
  effectiveDate?: string;
  basic?: number;
  da?: number;
  hra?: number;
  ca?: number;
  signatoryName?: string;
  signatoryDesignation?: string;
}

export type UpdatePromotionLetterInput = Omit<
  Partial<CreatePromotionLetterInput>,
  "employeeId"
>;

export type SalaryHistoryKind = "REVISION" | "PROMOTION";

export interface SalaryHistoryEntry {
  kind: SalaryHistoryKind;
  id: number;
  documentNo: string;
  designation: string;
  /** Promotions only; null for a revision. */
  previousDesignation: string | null;
  letterDate: string;
  effectiveDate: string;
  components: MoneyComponents;
  grossMonthly: string;
  grossAnnual: string;
}

/** `GET /hr/promotion-letters/salary-history/:employeeId`. Revisions are left
 * out (and `revisionsIncluded` is false) when the caller cannot read them. */
export interface SalaryHistoryView {
  employee: {
    id: number;
    employeeCode: string;
    fullName: string;
    currentDesignation: string;
  };
  revisionsIncluded: boolean;
  entries: SalaryHistoryEntry[];
}

/** Subset of `EmployeeListItem` the revision picker reads. Salary is not
 * part of the list response (see the data-gap note in the PR). */
export interface RecruitmentEmployee {
  id: number;
  employeeCode: string;
  fullName: string;
  status: string;
  designation: { id: number; name: string };
  team: { id: number; name: string };
}

export const INTERVIEW_STATUS_LABELS: Record<InterviewStatus, string> = {
  SCHEDULED: "Scheduled",
  COMPLETED: "Completed",
  SELECTED: "Selected",
  REJECTED: "Rejected",
  NO_SHOW: "No show",
};

export const INTERVIEW_MODE_LABELS: Record<InterviewMode, string> = {
  ONLINE: "Online meeting",
  IN_PERSON: "In person",
  PHONE: "Phone call",
};
