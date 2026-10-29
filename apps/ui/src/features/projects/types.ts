export type ProjectStatus = "active" | "on_hold" | "completed" | "cancelled";
export type MilestoneStatus =
  "not_started" | "in_progress" | "hold" | "completed";
export type TaskStatus = "not_started" | "in_progress" | "hold" | "completed";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type ExpenseStatus = "unpaid" | "paid" | "cancelled";
/** What the API actually sends (`calculateProjectHealth` in
 * apps/api/.../project-calculations.ts) is lower-case `on_track` |
 * `delayed` | `completed` — legacy's two-state health model (plus
 * `completed`). The upper-case members are kept for older callers.
 * Always compare via `normalizeHealth()` from `components/HealthBadge`. */
export type HealthStatus =
  "on_track" | "delayed" | "completed" | "ON_TRACK" | "DELAYED";

export interface ProjectMember {
  id: number;
  projectId: number;
  employeeId: number;
  role: string;
  loggedHours: number | string;
  estimatedHours: number | string;
  hourlyRate: number | string;
  employee: {
    id: number;
    fullName: string;
    employeeCode: string;
    workEmail?: string;
  };
}

export interface ProjectMilestone {
  id: number;
  projectId: number;
  title: string;
  targetDate: string;
  actualDate?: string | null;
  status: MilestoneStatus;
  order: number;
}

export interface ProjectTask {
  id: number;
  projectId: number;
  taskCode: string;
  title: string;
  description?: string | null;
  milestoneId?: number | null;
  assignedToId?: number | null;
  department?: string | null;
  startDate: string;
  endDate: string;
  actualEndDate?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dependencyTaskId?: number | null;
  /** Legacy descriptive dependency metadata (display only; `dependencyTaskId`
   * stays the enforced FK). */
  dependencyType?: string | null;
  dependencyRequirement?: string | null;
  dependencyTargetId?: number | null;
  dependencyTargetName?: string | null;
  hoursToComplete: number | string;
  loggedHours: number | string;
  completionPercent: number;
  points: number;
  project?: {
    id: number;
    projectCode: string;
    name: string;
    status: ProjectStatus;
  } | null;
  assignedTo?: {
    id: number;
    fullName: string;
    employeeCode: string;
  } | null;
  dependencyTask?: {
    id: number;
    taskCode: string;
    title: string;
  } | null;
  milestone?: {
    id: number;
    title: string;
    targetDate: string;
    status: MilestoneStatus;
  } | null;
}

export interface ProjectExpense {
  id: number;
  projectId: number;
  amount: number | string;
  expenseDate: string;
  department?: string | null;
  vendor?: string | null;
  /** Link to the SCM supplier master (`scm.suppliers`), when picked from it. */
  supplierId?: number | null;
  supplier?: { id: number; supplierCode: string; companyName: string } | null;
  referenceNo?: string | null;
  status: ExpenseStatus;
  notes?: string | null;
  project?: {
    id: number;
    projectCode: string;
    name: string;
  };
}

export interface Project {
  id: number;
  projectCode: string;
  name: string;
  description?: string | null;
  customerId?: number | null;
  customerName?: string | null;
  projectType?: string | null;
  department?: string | null;
  departments?: string[];
  resourceNames?: string[];
  expectedHours: number | string;
  projectPrice: number | string;
  actualCost: number | string;
  status: ProjectStatus;
  startDate: string;
  plannedEndDate?: string | null;
  actualEndDate?: string | null;
  clientHandlingPersonId?: number | null;
  /** Included by `GET /projects` and `GET /projects/:id`. */
  clientHandlingPerson?: {
    id: number;
    fullName: string;
    employeeCode: string;
  } | null;
  customer?: { id: number; name: string } | null;
  /** Only included by `GET /projects/:id` (detail). */
  expenses?: ProjectExpense[];
  createdAt?: string;
  health?: HealthStatus;
  progressPercent?: number;
  totalLoggedHours?: number;
  earnedAmount?: number;
  budgetUtilization?: number;
  budgetVariance?: number;
  isUnderBudget?: boolean;
  members: ProjectMember[];
  milestones: ProjectMilestone[];
  tasks?: ProjectTask[];
  _count?: {
    tasks: number;
    expenses: number;
  };
}

export interface ActiveTimer {
  id: number;
  taskId: number;
  employeeId: number;
  startedAt: string;
  task?: {
    id: number;
    taskCode: string;
    title: string;
    project?: {
      id: number;
      name: string;
    } | null;
  } | null;
}

/** `GET /projects/tasks/time-summary/me` (also embedded in the
 * employee work view). Closed entries only — add a running timer's live
 * elapsed time on top. */
export interface TimeSummary {
  date: string;
  loggedTodayMinutes: number;
  entriesToday: number;
  loggedThisWeekMinutes: number;
}

/** `GET /projects/tasks/attendance/me` — stopwatch attendance gate. */
export interface AttendanceGateStatus {
  checkedIn: boolean;
  hasRecordToday: boolean;
  lastCheckOutAt: string | null;
}

/** `GET /projects/tasks/work/:employeeId` — manager view of an employee. */
export interface EmployeeWorkView {
  employee: {
    id: number;
    fullName: string;
    employeeCode: string;
    department: string | null;
    designation: string | null;
  };
  tasks: ProjectTask[];
  activeTimer: ActiveTimer | null;
  timeSummary: TimeSummary;
}

/** `GET /projects/tasks/:taskId/time-entries` row (stopwatch or manual). */
export interface TaskTimeEntry {
  id: number;
  taskId: number;
  employeeId: number;
  startedAt: string;
  endedAt?: string | null;
  durationMinutes: number;
  entryDate: string;
  notes?: string | null;
  createdAt: string;
  employee?: {
    id: number;
    fullName: string;
    employeeCode: string;
  } | null;
}

/** `GET /projects/expenses/vendors` row — an active SCM supplier. */
export interface ExpenseVendor {
  id: number;
  supplierCode: string;
  companyName: string;
}

export interface DashboardMetrics {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  delayedProjects: number;
  onTrackProjects: number;
  upcomingMilestonesCount: number;
  openTasksCount: number;
  /** Projects whose logged hours exceed expected hours. */
  overHoursProjects: number;
  /** Projects whose actual cost exceeds the contract price. */
  overBudgetProjects: number;
  /** Milestone-level health across all projects (legacy Analytics). */
  milestoneHealth: {
    onTrack: number;
    delayed: number;
    completed: number;
    onTimeCompleted: number;
    total: number;
  };
  statusBreakdown: {
    status: string;
    count: number;
    totalValue: number;
  }[];
  financials: {
    totalContractPrice: number;
    totalActualSpend: number;
    totalEarnedRevenue: number;
    overallBudgetUtilizationPercent: number;
    budgetVariance: number;
  };
  hours: {
    totalExpectedHours: number;
    totalLoggedHours: number;
    hoursVariance: number;
  };
}

export interface ResourceItem {
  employeeId: number;
  employeeName: string;
  employeeCode: string;
  /** Employee's HR department / designation (null when not set). */
  department: string | null;
  designation: string | null;
  /** Projects the employee is a member of or has tasks on. */
  projects: { id: number; projectCode: string; name: string }[];
  activeTasksCount: number;
  loggedHours: number;
  estimatedHours: number;
  baseCapacityHours: number;
  utilizationPercent: number;
  status: "NORMAL" | "OVER_CAPACITY" | "UNDER_UTILIZED";
  assignedProjectsCount: number;
  totalPoints: number;
}

export interface ResourceTracking {
  activeEngineersCount: number;
  overallUtilizationPercent: number;
  /** Distinct HR departments present in `resources` (filter options). */
  departments: string[];
  resources: ResourceItem[];
}

export interface DepartmentSpendItem {
  department: string;
  projectsCount: number;
  totalContractPrice: number;
  totalActualCost: number;
  expectedHours: number;
  loggedHours: number;
  budgetUtilizationPercent: number;
}

export interface PointsLeaderboardEntry {
  employeeId: number;
  totalPoints: number;
  tasksCompletedCount: number;
  employee: {
    id: number;
    fullName: string;
    employeeCode: string;
    designation?: { name: string } | null;
  } | null;
}

export interface PointsConfig {
  id: number;
  low: number;
  medium: number;
  high: number;
  urgent: number;
  customRules: Record<string, unknown>;
}
