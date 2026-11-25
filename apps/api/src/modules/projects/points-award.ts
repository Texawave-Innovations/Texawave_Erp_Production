import type { Prisma } from "@texawave-erp/database";
import { calculateTaskPoints } from "./calculations/project-calculations.js";

/** The slice of a Prisma client (or transaction) the award needs, so the same
 * code runs inside the employee Complete transaction and from the manager
 * update path. */
export type PointsDb = Pick<
  Prisma.TransactionClient,
  "projectPointsLedger" | "projectPointsConfig" | "projectTimeEntry"
>;

export interface AwardableTask {
  id: number;
  title: string;
  taskCode: string;
  priority: string;
  /** Legacy fixed points, used while time-based points are switched off. */
  points: number;
  /** The ETA the team lead entered, in hours. */
  hoursToComplete: Prisma.Decimal | number | string;
}

/** Rule code stored in the ledger so a number can always be traced back to
 * the formula that produced it. */
export const TIME_RULE = "time_v1";

/** The assignee's own timer minutes on a task. Manual and correction entries
 * are deliberately not counted: only timer sessions measure time taken. */
export async function sumTimerMinutes(
  db: PointsDb,
  organizationId: number,
  taskId: number,
  employeeId: number,
): Promise<number> {
  const sum = await db.projectTimeEntry.aggregate({
    where: { organizationId, taskId, employeeId, source: "TIMER" },
    _sum: { durationMinutes: true },
  });
  return sum._sum.durationMinutes ?? 0;
}

/** Whether the time-based rule is switched on for the organization. */
export async function isTimeBasedPointsEnabled(
  db: PointsDb,
  organizationId: number,
): Promise<boolean> {
  const config = await db.projectPointsConfig.findUnique({
    where: { organizationId },
    select: { timeBasedEnabled: true },
  });
  return config?.timeBasedEnabled ?? false;
}

/**
 * Pays a finished task to its assignee - the ONE place points are awarded, for
 * both the manager update path and the employee Complete flow.
 *
 * Once per task and employee, ever: re-completing a reopened task, a retry or
 * two requests never pay twice (the first award stands). While the time-based
 * rule is off the task's own fixed points are paid, exactly as before; when it
 * is on, the points come from `calculateTaskPoints` and the ledger row keeps
 * the breakdown.
 */
export async function awardTaskPoints(
  db: PointsDb,
  organizationId: number,
  task: AwardableTask,
  employeeId: number,
) {
  const existing = await db.projectPointsLedger.findFirst({
    where: { organizationId, taskId: task.id, employeeId },
  });
  if (existing) return existing;

  const config = await db.projectPointsConfig.findUnique({
    where: { organizationId },
  });
  const note = `Completed ${task.taskCode} (${task.priority} priority)`;

  if (!config?.timeBasedEnabled) {
    return db.projectPointsLedger.create({
      data: {
        organizationId,
        employeeId,
        taskId: task.id,
        taskTitle: task.title,
        points: task.points,
        note,
      },
    });
  }

  const workedMinutes = await sumTimerMinutes(
    db,
    organizationId,
    task.id,
    employeeId,
  );
  const result = calculateTaskPoints(
    Number(task.hoursToComplete),
    workedMinutes,
    {
      basePoints: config.defaultTaskPoints,
      onTimeBonus: config.onTimeBonus,
      graceMinutes: config.graceMinutes,
    },
  );
  return db.projectPointsLedger.create({
    data: {
      organizationId,
      employeeId,
      taskId: task.id,
      taskTitle: task.title,
      points: result.points,
      note,
      etaMinutes: result.etaMinutes,
      workedMinutes: result.workedMinutes,
      basePoints: result.basePoints,
      bonusPoints: result.bonusPoints,
      overrunMinutes: result.overrunMinutes,
      rule: TIME_RULE,
    },
  });
}
