/** Mirrors apps/api/src/modules/hr/exit-requests/dto/exit-request.dto.ts,
 * exit-request-domain.ts and exit-requests.repository.ts (ExitRequestView). */
export const EXIT_REQUEST_STATUSES = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "REJECTED",
  "COMPLETED",
] as const;
export type ExitRequestStatus = (typeof EXIT_REQUEST_STATUSES)[number];

export const SETTLEMENT_STATUSES = [
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
  "ON_HOLD",
] as const;
export type SettlementStatus = (typeof SETTLEMENT_STATUSES)[number];

/** `SUBMITTED | UNDER_REVIEW | APPROVED` — legacy's hasActiveRequest check;
 * the backend enforces at most one active request per employee. */
export const ACTIVE_STATUSES: readonly ExitRequestStatus[] = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
];

/** Transition map enforced server-side (exit-request-domain.ts TRANSITIONS).
 * REJECTED and COMPLETED are final. */
export const TRANSITIONS: Readonly<
  Record<ExitRequestStatus, readonly ExitRequestStatus[]>
> = {
  SUBMITTED: ["UNDER_REVIEW", "APPROVED", "REJECTED"],
  UNDER_REVIEW: ["APPROVED", "REJECTED"],
  APPROVED: ["COMPLETED"],
  REJECTED: [],
  COMPLETED: [],
};

export interface EmployeeRef {
  id: number;
  fullName: string;
}

export interface DeciderRef {
  id: number;
  fullName: string;
}

/** Row shape of GET /hr/exit-requests, /hr/exit-requests/:id,
 * /self-service/exit-requests and /self-service/exit-requests/:id. */
export interface ExitRequestItem {
  id: number;
  employee: EmployeeRef;
  status: ExitRequestStatus;
  reason: string;
  preferredLastWorkingDate: string;
  noticePeriodDays: number;
  additionalNotes: string | null;
  confirmedLastWorkingDate: string | null;
  settlementStatus: SettlementStatus | null;
  hrNote: string | null;
  decidedBy: DeciderRef | null;
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
