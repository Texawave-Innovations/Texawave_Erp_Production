import { Injectable } from "@nestjs/common";
import {
  businessInstant,
  businessTimeOf,
} from "../../common/dates/business-date.js";
import { BusinessRuleViolationException } from "../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../platform/tenancy/tenant-context.service.js";
import { EmployeeQueryService } from "../hr/employees/employee-query.service.js";
import { ProjectsService } from "../projects/projects.service.js";
import {
  CustomActivitiesRepository,
  type CustomActivityValues,
} from "./custom-activities.repository.js";
import type {
  CreateCustomActivityDto,
  UpdateCustomActivityDto,
} from "./dto/custom-activity.dto.js";
import {
  CUSTOM_ACTIVITY_CATEGORIES,
  CUSTOM_ACTIVITY_CATEGORY_LABELS,
  checkCustomActivity,
} from "./timesheets.rules.js";

/** The editable fields in one shape (the create body, or a stored row merged
 * with an update). */
interface ActivityInput {
  category: string;
  title: string;
  description: string | null;
  notes: string | null;
  projectId: number | null;
  workDate: string;
  startTime: string;
  endTime: string;
  lateEntryReason: string | null;
}

/** A stored custom row as the screens read it. */
function toView(row: {
  id: number;
  category: string;
  title: string;
  description: string | null;
  notes: string | null;
  projectId: number | null;
  workDate: Date;
  startedAt: Date | null;
  endedAt: Date | null;
  durationMinutes: number | null;
  isBackdated: boolean;
  lateEntryReason: string | null;
  dailyStatus: string;
  status: string;
}) {
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    description: row.description,
    notes: row.notes,
    projectId: row.projectId,
    workDate: row.workDate.toISOString().slice(0, 10),
    startTime: row.startedAt ? businessTimeOf(row.startedAt) : null,
    endTime: row.endedAt ? businessTimeOf(row.endedAt) : null,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    durationMinutes: row.durationMinutes ?? 0,
    isBackdated: row.isBackdated,
    lateEntryReason: row.lateEntryReason,
    dailyStatus: row.dailyStatus,
    submissionStatus: row.status,
  };
}

const blank = (s: string | undefined | null): string | null => {
  const t = s?.trim();
  return t ? t : null;
};

/**
 * Employee-recorded work that is not an assigned task: meetings, discussions,
 * research... They are timesheet activities only — they never create project
 * tasks. The employee is always the signed-in user; times are typed as IST
 * `HH:mm` on a work date and the server builds the instants and the duration.
 */
@Injectable()
export class CustomActivitiesService {
  constructor(
    private readonly repository: CustomActivitiesRepository,
    private readonly tenantContext: TenantContextService,
    private readonly employeeQuery: EmployeeQueryService,
    private readonly projects: ProjectsService,
  ) {}

  /** The category list the form offers — one source (the rules file). */
  categories() {
    return CUSTOM_ACTIVITY_CATEGORIES.map((code) => ({
      code,
      label: CUSTOM_ACTIVITY_CATEGORY_LABELS[code],
    }));
  }

  async linkableProjects() {
    const employeeId = await this.requireEmployeeId();
    return this.projects.findLinkableProjects(employeeId);
  }

  async create(dto: CreateCustomActivityDto) {
    const scope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();
    const employeeId = await this.requireEmployeeId();
    const input: ActivityInput = {
      category: dto.category,
      title: dto.title,
      description: blank(dto.description),
      notes: blank(dto.notes),
      projectId: dto.projectId ?? null,
      workDate: dto.workDate,
      startTime: dto.startTime,
      endTime: dto.endTime,
      lateEntryReason: blank(dto.lateEntryReason),
    };
    await this.assertProjectLinkable(employeeId, input.projectId);
    const values = this.toValues(input);
    return toView(
      await this.repository.create(scope, employeeId, userId, values),
    );
  }

  async update(id: number, dto: UpdateCustomActivityDto) {
    const scope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();
    const employeeId = await this.requireEmployeeId();
    // `projectId: null` removes the link; omitting it keeps the current one.
    const projectChange = (dto as { projectId?: number | null }).projectId;
    if (projectChange !== undefined) {
      await this.assertProjectLinkable(employeeId, projectChange);
    }

    return toView(
      await this.repository.update(scope, employeeId, userId, id, (current) => {
        const merged: ActivityInput = {
          category: dto.category ?? current.category,
          title: dto.title ?? current.title,
          description:
            dto.description !== undefined
              ? blank(dto.description)
              : current.description,
          notes: dto.notes !== undefined ? blank(dto.notes) : current.notes,
          projectId:
            projectChange !== undefined ? projectChange : current.projectId,
          workDate: dto.workDate ?? current.workDate,
          startTime: dto.startTime ?? businessTimeOf(current.startedAt),
          endTime: dto.endTime ?? businessTimeOf(current.endedAt),
          lateEntryReason:
            dto.lateEntryReason !== undefined
              ? blank(dto.lateEntryReason)
              : current.lateEntryReason,
        };
        return this.toValues(merged);
      }),
    );
  }

  async remove(id: number) {
    const scope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();
    const employeeId = await this.requireEmployeeId();
    return this.repository.remove(scope, employeeId, userId, id);
  }

  // ---------------------------------------------------------------------------

  /** Validates the input against the rules and builds what is stored: instants
   * from the typed IST times, the server-calculated duration, the late-entry
   * flag. Throws one 422 listing every problem. */
  private toValues(input: ActivityInput): CustomActivityValues {
    const startedAt = businessInstant(input.workDate, input.startTime);
    const endedAt = businessInstant(input.workDate, input.endTime);
    if (!startedAt || !endedAt) {
      throw new BusinessRuleViolationException(
        "Start and end time must be valid times as HH:mm.",
        "INVALID_CUSTOM_ACTIVITY",
      );
    }
    const check = checkCustomActivity(
      {
        category: input.category,
        title: input.title,
        workDate: input.workDate,
        startedAt,
        endedAt,
        lateEntryReason: input.lateEntryReason ?? undefined,
      },
      new Date(),
    );
    if (check.errors.length > 0) {
      throw new BusinessRuleViolationException(
        check.errors.join(" "),
        "INVALID_CUSTOM_ACTIVITY",
      );
    }
    return {
      category: input.category,
      title: input.title.trim(),
      description: input.description,
      notes: input.notes,
      projectId: input.projectId,
      workDate: input.workDate,
      startedAt,
      endedAt,
      durationMinutes: check.durationMinutes,
      isBackdated: check.isBackdated,
      // A reason is only kept for a late entry.
      lateEntryReason: check.isBackdated ? input.lateEntryReason : null,
    };
  }

  private async assertProjectLinkable(
    employeeId: number,
    projectId: number | null,
  ): Promise<void> {
    if (projectId === null) return;
    const linkable = await this.projects.findLinkableProjects(employeeId);
    if (!linkable.some((p) => p.id === projectId)) {
      throw new BusinessRuleViolationException(
        "You can only link a project you are a member of or hold a task in.",
        "PROJECT_NOT_LINKABLE",
      );
    }
  }

  private async requireEmployeeId(): Promise<number> {
    const employee = await this.employeeQuery.findCurrentEmployeeOrNull();
    if (!employee) {
      throw new BusinessRuleViolationException(
        "Current user has no associated employee profile",
        "NO_EMPLOYEE_PROFILE",
      );
    }
    return employee.id;
  }
}
