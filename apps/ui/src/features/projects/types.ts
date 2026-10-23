export type ProjectStatus = "active" | "on_hold" | "completed" | "cancelled";
export type MilestoneStatus =
  "not_started" | "in_progress" | "hold" | "completed";
export type TaskStatus = "not_started" | "in_progress" | "hold" | "completed";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type ExpenseStatus = "unpaid" | "paid" | "cancelled";
export type HealthStatus = "ON_TRACK" | "AT_RISK" | "DELAYED";

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
  } | null;
}

export interface ProjectExpense {
  id: number;
  projectId: number;
  amount: number | string;
  expenseDate: string;
  department?: string | null;
  vendor?: string | null;
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
  expectedHours: number | string;
  projectPrice: number | string;
  actualCost: number | string;
  status: ProjectStatus;
  startDate: string;
  plannedEndDate?: string | null;
  actualEndDate?: string | null;
  clientHandlingPersonId?: number | null;
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

export interface DashboardMetrics {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  delayedProjects: number;
  onTrackProjects: number;
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
  activeTasksCount: number;
  loggedHours: number;
  estimatedHours: number;
  baseCapacityHours: number;
  utilizationPercent: number;
  status: "NORMAL" | "OVER_CAPACITY" | "UNDER_UTILIZED";
}

export interface ResourceTracking {
  activeEngineersCount: number;
  overallUtilizationPercent: number;
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
