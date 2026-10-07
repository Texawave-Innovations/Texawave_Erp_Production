/** Mirrors apps/api/src/modules/hr/work-logs/dto/work-log.dto.ts. */
export const WORK_LOG_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
export type WorkLogStatus = (typeof WORK_LOG_STATUSES)[number];

export interface Ref {
  id: number;
  fullName: string;
}

/** Row shape of GET /hr/work-logs, /hr/work-logs/approvals and /self-service/work-logs. */
export interface WorkLogItem {
  id: number;
  employee: Ref;
  workDate: string;
  hoursWorked: number;
  taskDescription: string;
  status: WorkLogStatus;
  decidedBy: Ref | null;
  decidedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
}
