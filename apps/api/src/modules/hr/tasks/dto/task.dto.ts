import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
} from "class-validator";
import { IsDateOnly } from "../../../../common/dates/date-only.js";
import { PaginationDto } from "../../../../common/dto/pagination.dto.js";
import { QueryBoolean, Trim } from "../../../../common/dto/transforms.js";
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  type TaskPriority,
  type TaskStatus,
} from "../tasks.rules.js";

/** Status values an employee may move a task to. CANCELLED is admin-only:
 * the legacy employee screen never offers it. */
export const EMPLOYEE_TASK_STATUSES = [
  "PENDING",
  "IN_PROGRESS",
  "DONE",
] as const;

/** Admin-assigned task. The creator is never a field: it is the JWT user. */
export class CreateTaskDto {
  @ApiProperty({ description: "Short task title (legacy: 80 characters)" })
  @Trim()
  @IsString()
  @Length(1, 80)
  title!: string;

  @ApiPropertyOptional({ description: "What needs to be done (max 500)" })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 500)
  description?: string;

  @ApiProperty({ description: "Employee the task is assigned to" })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  assigneeId!: number;

  @ApiProperty({ example: "2026-10-31", description: "Required (legacy)" })
  @IsDateOnly()
  dueDate!: string;

  @ApiPropertyOptional({ enum: TASK_PRIORITIES, default: "MEDIUM" })
  @IsOptional()
  @IsIn(TASK_PRIORITIES)
  priority?: TaskPriority;
}

/** Employee-created task. There is deliberately NO assignee: an employee can
 * only create work for themselves, resolved from the JWT. */
export class CreateMyTaskDto {
  @ApiProperty({ description: "Short task title (legacy: 80 characters)" })
  @Trim()
  @IsString()
  @Length(1, 80)
  title!: string;

  @ApiPropertyOptional({ description: "What needs to be done (max 500)" })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 500)
  description?: string;

  @ApiProperty({ example: "2026-10-31", description: "Required (legacy)" })
  @IsDateOnly()
  dueDate!: string;

  @ApiPropertyOptional({ enum: TASK_PRIORITIES, default: "MEDIUM" })
  @IsOptional()
  @IsIn(TASK_PRIORITIES)
  priority?: TaskPriority;

  @ApiPropertyOptional({
    default: false,
    description:
      "Ask Admin/HR to look at this task (legacy 'Employee Requests')",
  })
  @IsOptional()
  @IsBoolean()
  requestToAdmin?: boolean;
}

/** Reassignment. Legacy has no reassign control; this is the documented
 * production path (Docs/HR_LEGACY_PARITY.md §3.9) and is restricted to open,
 * admin-assigned tasks. */
export class ReassignTaskDto {
  @ApiProperty({ description: "The new assignee" })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  assigneeId!: number;
}

export class UpdateTaskStatusDto {
  @ApiProperty({ enum: TASK_STATUSES })
  @IsIn(TASK_STATUSES)
  status!: TaskStatus;
}

export class UpdateMyTaskStatusDto {
  @ApiProperty({ enum: EMPLOYEE_TASK_STATUSES })
  @IsIn(EMPLOYEE_TASK_STATUSES)
  status!: (typeof EMPLOYEE_TASK_STATUSES)[number];
}

/** Shared list filters. `q` matches the title or the assignee's name, as the
 * legacy search box did. `overdue` and `awaitingApproval` are the two derived
 * buckets the legacy summary cards expose. */
class TaskFilterDto extends PaginationDto {
  @ApiPropertyOptional({ enum: TASK_STATUSES })
  @IsOptional()
  @IsIn(TASK_STATUSES)
  status?: TaskStatus;

  @ApiPropertyOptional({ enum: TASK_PRIORITIES })
  @IsOptional()
  @IsIn(TASK_PRIORITIES)
  priority?: TaskPriority;

  @ApiPropertyOptional({ description: "Title or assignee name contains" })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 100)
  q?: string;

  @ApiPropertyOptional({
    description: "DONE but not yet approved by admin",
  })
  @IsOptional()
  @QueryBoolean()
  @IsBoolean()
  awaitingApproval?: boolean;

  @ApiPropertyOptional({
    description: "Due before today (organization day) and not finished",
  })
  @IsOptional()
  @QueryBoolean()
  @IsBoolean()
  overdue?: boolean;
}

/** HR list: scoped by `hr.task.read`. */
export class QueryTaskDto extends TaskFilterDto {
  @ApiPropertyOptional({ description: "Tasks of one assignee (within scope)" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  assigneeId?: number;
}

/** Self-service list: always the caller's own tasks — no assignee filter. */
export class QueryMyTaskDto extends TaskFilterDto {}
