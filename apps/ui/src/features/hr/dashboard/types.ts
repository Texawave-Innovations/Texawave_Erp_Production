// Wire shapes for the HR endpoints the dashboard reads. Kept feature-local on
// purpose: packages/api-types has no HR types yet and changes there need
// reviewer sign-off (CLAUDE.md). Mirrors the view types in apps/api/src/modules/hr.

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export type DerivedAttendanceStatus =
  | "PRESENT"
  | "ABSENT"
  | "HALF_DAY"
  | "HOLIDAY"
  | "WEEKLY_OFF"
  | "ON_LEAVE"
  | "NOT_MARKED";

export interface DailyAttendanceRow {
  employeeId: number;
  attendanceDate: string;
  status: DerivedAttendanceStatus;
  employee: { id: number; employeeCode: string; fullName: string };
}

export interface LeaveRequestRow {
  id: number;
  employee: { id: number; employeeCode: string; fullName: string };
  leaveType: { id: number; code: string; name: string };
  startDate: string;
  endDate: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
}

export interface EmployeeRow {
  id: number;
  employeeCode: string;
  fullName: string;
  status: "ACTIVE" | "INACTIVE" | "RESIGNED" | "TERMINATED";
  dateOfJoining: string;
}

export interface TicketRow {
  id: number;
  subject: string;
  category: string;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  employee: { id: number; fullName: string };
  createdAt: string;
}

export interface ExpenseClaimRow {
  id: number;
  employee: { id: number; fullName: string };
  expenseType: string;
  amount: number;
  description: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
}

export interface HolidayRow {
  id: number;
  holidayDate: string;
  name: string;
  isActive: boolean;
}
