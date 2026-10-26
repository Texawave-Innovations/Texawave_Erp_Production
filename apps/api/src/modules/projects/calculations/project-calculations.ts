export interface MilestoneHealthInput {
  targetDate: string | Date;
  status: string;
}

export interface TaskDependencyInput {
  id: number;
  dependencyTaskId?: number | null;
}

/**
 * Calculates work hours strictly across working business days (Monday–Friday),
 * excluding Saturdays and Sundays. Each business day counts as workHoursPerDay (default 8).
 */
export function calculateBusinessHours(
  startDateStr?: string | Date | null,
  endDateStr?: string | Date | null,
  workHoursPerDay = 8,
): number {
  if (!startDateStr || !endDateStr) return 0;
  try {
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;

    // Normalize to midnight UTC for pure date comparison
    const startDate = new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()),
    );
    const endDate = new Date(
      Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()),
    );

    if (endDate < startDate) return 0;

    let businessDays = 0;
    const curr = new Date(startDate.getTime());
    while (curr <= endDate) {
      const day = curr.getUTCDay(); // 0 = Sunday, 6 = Saturday
      if (day !== 0 && day !== 6) {
        businessDays++;
      }
      curr.setUTCDate(curr.getUTCDate() + 1);
    }
    return businessDays * workHoursPerDay;
  } catch {
    return 0;
  }
}

/**
 * Evaluates a project's health dynamically:
 * - 'completed': all milestones completed or project entity is completed.
 * - 'delayed': at least one incomplete milestone has targetDate < today.
 * - 'on_track': neither delayed nor completed.
 */
export function calculateProjectHealth(
  milestones: MilestoneHealthInput[] = [],
  isProjectCompleted = false,
  today: Date = new Date(),
): "delayed" | "completed" | "on_track" {
  if (isProjectCompleted) return "completed";
  if (
    milestones.length > 0 &&
    milestones.every((m) => m.status === "completed")
  ) {
    return "completed";
  }

  const todayIso = today.toISOString().slice(0, 10);

  const hasDelayedMilestone = milestones.some((m) => {
    if (m.status === "completed") return false;
    const targetIso = new Date(m.targetDate).toISOString().slice(0, 10);
    return targetIso < todayIso;
  });

  if (hasDelayedMilestone) return "delayed";
  return "on_track";
}

/**
 * Earned Value Management (EVM) Revenue Recognition:
 * Amount Earned = Logged Hours * (Project Price / Expected Hours)
 */
export function calculateEarnedAmount(
  loggedHours: number,
  projectPrice: number,
  expectedHours: number,
): number {
  if (expectedHours <= 0 || loggedHours <= 0 || projectPrice <= 0) return 0;
  const rate = projectPrice / expectedHours;
  return Math.round(loggedHours * rate * 100) / 100;
}

/**
 * Calculates budget utilization percentage and monetary variance:
 * Variance = Project Price - Actual Spend (Positive = under budget/profitable)
 */
export function calculateBudgetUtilization(
  actualSpend: number,
  projectPrice: number,
): { utilizationPercent: number; variance: number; isUnderBudget: boolean } {
  const utilizationPercent =
    projectPrice > 0 ? Math.round((actualSpend / projectPrice) * 100) : 0;
  const variance = Math.round((projectPrice - actualSpend) * 100) / 100;
  return {
    utilizationPercent,
    variance,
    isUnderBudget: variance >= 0,
  };
}

/**
 * Resource capacity utilization:
 * Capacity per employee is based on 20 working days * 8h = 160h.
 * Resource Utilization % = min(100, round((active tasks / active engineers) * 100))
 */
export function calculateResourceUtilization(
  activeTasksCount: number,
  activeEngineersCount: number,
): number {
  if (activeEngineersCount <= 0 || activeTasksCount <= 0) return 0;
  return Math.min(
    100,
    Math.round((activeTasksCount / activeEngineersCount) * 100),
  );
}

/**
 * Depth-First Search cycle detection to prevent deadlocks in prerequisite task dependencies.
 * Returns true if setting candidateDependencyId on currentTaskId would form a cycle.
 */
export function hasCircularDependency(
  allTasks: TaskDependencyInput[],
  currentTaskId: number,
  candidateDependencyId?: number | null,
): boolean {
  if (!candidateDependencyId) return false;
  if (candidateDependencyId === currentTaskId) return true;

  const depMap = new Map<number, number>();
  for (const t of allTasks) {
    if (t.dependencyTaskId) {
      depMap.set(t.id, t.dependencyTaskId);
    }
  }
  // Inject candidate edge
  depMap.set(currentTaskId, candidateDependencyId);

  const visited = new Set<number>();
  let curr: number | undefined = candidateDependencyId;
  while (curr !== undefined) {
    if (curr === currentTaskId) return true; // Cycle detected back to source task
    if (visited.has(curr)) break; // Cycle in existing disjoint tree (handled elsewhere)
    visited.add(curr);
    curr = depMap.get(curr);
  }
  return false;
}
