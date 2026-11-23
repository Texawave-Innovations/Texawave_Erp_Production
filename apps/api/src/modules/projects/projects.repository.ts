import { Injectable } from "@nestjs/common";
import {
  MilestoneStatus,
  Prisma,
  ProjectExpenseStatus,
  ProjectStatus,
  TaskPriority,
  TaskStatus,
} from "@texawave-erp/database";
import { OrgScoped } from "../../common/decorators/org-scoped.decorator.js";
import type { PaginationDto } from "../../common/dto/pagination.dto.js";
import type { OrgScope } from "../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../common/tenancy/tenant-where.js";
import { PrismaService } from "../../shared/prisma/prisma.service.js";
import { businessToday } from "../../common/dates/business-date.js";
import { parseDateOnly } from "../../common/dates/date-only.js";
import { AuditWriter } from "../../platform/audit/audit-writer.js";
import { TaskLifecycleRepository } from "./task-lifecycle.repository.js";
import {
  awardTaskPoints,
  isTimeBasedPointsEnabled,
  sumTimerMinutes,
  type AwardableTask,
} from "./points-award.js";
import type { AddProjectMemberDto } from "./dto/add-project-member.dto.js";
import type { CreateExpenseDto } from "./dto/create-expense.dto.js";
import type { CreateMilestoneDto } from "./dto/create-milestone.dto.js";
import type { CreateProjectDto } from "./dto/create-project.dto.js";
import type { CreateTaskDto } from "./dto/create-task.dto.js";
import type { CreateTimeEntryDto } from "./dto/create-time-entry.dto.js";
import type { QueryProjectDto } from "./dto/query-project.dto.js";
import type { UpdateExpenseDto } from "./dto/update-expense.dto.js";
import type { UpdateMilestoneDto } from "./dto/update-milestone.dto.js";
import type { UpdatePointsConfigDto } from "./dto/update-points-config.dto.js";
import type { UpdateProjectDto } from "./dto/update-project.dto.js";
import type { UpdateTaskDto } from "./dto/update-task.dto.js";
import {
  issueProjectCode,
  issueTaskCode,
  type ProjectCodeFormat,
  type TaskCodeFormat,
} from "./sequences/project-sequences.js";

@Injectable()
export class ProjectsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lifecycle: TaskLifecycleRepository,
    private readonly audit: AuditWriter,
  ) {}

  // ---------------------------------------------------------------------------
  // Projects Core
  // ---------------------------------------------------------------------------

  @OrgScoped()
  async findMany(
    scope: OrgScope,
    query: QueryProjectDto,
    restrictToIds?: number[],
  ) {
    const where: Prisma.ProjectWhereInput = tenantWhere(scope, {
      deletedAt: null,
      ...(restrictToIds ? { id: { in: restrictToIds } } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.department ? { departments: { has: query.department } } : {}),
      ...(query.salesCustomerId
        ? { salesCustomerId: query.salesCustomerId }
        : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" } },
              { projectCode: { contains: query.search, mode: "insensitive" } },
              { customerName: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    });

    const [items, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { createdAt: query.order ?? "desc" },
        include: {
          clientHandlingPerson: {
            select: { id: true, fullName: true, employeeCode: true },
          },
          salesCustomer: {
            select: { id: true, customerCode: true, companyName: true },
          },
          members: {
            include: {
              employee: {
                select: {
                  id: true,
                  fullName: true,
                  employeeCode: true,
                  workEmail: true,
                },
              },
            },
          },
          milestones: {
            where: { deletedAt: null },
            orderBy: { order: "asc" },
          },
          tasks: {
            where: { deletedAt: null },
            select: {
              id: true,
              status: true,
              assignedToId: true,
              endDate: true,
            },
          },
          _count: {
            select: { tasks: true, expenses: true },
          },
        },
      }),
      this.prisma.project.count({ where }),
    ]);

    return { items, total };
  }

  /** Every live project with just the fields the dashboard / resources /
   * analytics aggregates need — deliberately NOT paginated, so org-wide KPIs
   * cover all projects rather than the first page (Docs: legacy dashboards
   * summed the full project list). Selects are narrow to keep it cheap. */
  @OrgScoped()
  findAllForAnalytics(scope: OrgScope) {
    return this.prisma.project.findMany({
      where: tenantWhere(scope, { deletedAt: null }),
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        projectCode: true,
        name: true,
        status: true,
        departments: true,
        projectPrice: true,
        actualCost: true,
        expectedHours: true,
        members: {
          select: {
            employeeId: true,
            loggedHours: true,
            estimatedHours: true,
            employee: {
              select: {
                fullName: true,
                employeeCode: true,
                department: { select: { name: true } },
                designation: { select: { name: true } },
              },
            },
          },
        },
        milestones: {
          where: { deletedAt: null },
          select: { targetDate: true, actualDate: true, status: true },
        },
        tasks: {
          where: { deletedAt: null },
          select: { status: true, assignedToId: true, endDate: true },
        },
      },
    });
  }

  /** Total points per employee across the whole ledger (the leaderboard
   * endpoint only returns the top 20). */
  @OrgScoped()
  async sumPointsByEmployee(scope: OrgScope) {
    const rows = await this.prisma.projectPointsLedger.groupBy({
      by: ["employeeId"],
      where: { organizationId: scope.organizationId },
      _sum: { points: true },
    });
    return new Map(rows.map((r) => [r.employeeId, r._sum.points ?? 0]));
  }

  @OrgScoped()
  findOne(scope: OrgScope, id: number) {
    return this.prisma.project.findFirst({
      where: tenantWhere(scope, { id, deletedAt: null }),
      include: {
        clientHandlingPerson: {
          select: {
            id: true,
            userId: true,
            fullName: true,
            employeeCode: true,
            workEmail: true,
          },
        },
        salesCustomer: {
          select: { id: true, customerCode: true, companyName: true },
        },
        members: {
          include: {
            employee: {
              select: {
                id: true,
                fullName: true,
                employeeCode: true,
                workEmail: true,
              },
            },
          },
        },
        milestones: {
          where: { deletedAt: null },
          orderBy: { order: "asc" },
        },
        tasks: {
          where: { deletedAt: null },
          include: {
            assignedTo: {
              select: { id: true, fullName: true, employeeCode: true },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        expenses: {
          orderBy: { expenseDate: "desc" },
        },
      },
    });
  }

  /** A live Sales customer of this organization (used to validate the link
   * and to copy the company name onto the project). */
  @OrgScoped()
  findSalesCustomer(scope: OrgScope, id: number) {
    return this.prisma.salesCustomer.findFirst({
      where: tenantWhere(scope, { id, deletedAt: null }),
      select: { id: true, customerCode: true, companyName: true, status: true },
    });
  }

  /** Customer picker rows — identity only, so a projects user never receives
   * the bank/tax details the full Sales customer endpoint returns. */
  @OrgScoped()
  searchSalesCustomers(
    scope: OrgScope,
    search: string | undefined,
    take: number,
  ) {
    const where: Prisma.SalesCustomerWhereInput = tenantWhere(scope, {
      deletedAt: null,
      status: "ACTIVE",
      ...(search
        ? {
            OR: [
              { companyName: { contains: search, mode: "insensitive" } },
              { customerCode: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    });
    return this.prisma.salesCustomer.findMany({
      where,
      orderBy: { companyName: "asc" },
      take,
      select: { id: true, customerCode: true, companyName: true },
    });
  }

  @OrgScoped()
  findByCode(scope: OrgScope, projectCode: string) {
    return this.prisma.project.findFirst({
      where: tenantWhere(scope, { projectCode, deletedAt: null }),
    });
  }

  @OrgScoped()
  async create(
    scope: OrgScope,
    dto: CreateProjectDto,
    createdBy: number,
    codeFormat: ProjectCodeFormat,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const projectCode = await issueProjectCode(
        tx,
        scope.organizationId,
        codeFormat,
      );

      const project = await tx.project.create({
        data: {
          organizationId: scope.organizationId,
          projectCode,
          name: dto.name,
          description: dto.description ?? null,
          salesCustomerId: dto.salesCustomerId ?? null,
          customerName: dto.customerName ?? null,
          projectType: dto.projectType ?? null,
          departments: dto.departments ?? [],
          resourceNames: dto.resourceNames ?? [],
          expectedHours: dto.expectedHours
            ? new Prisma.Decimal(dto.expectedHours)
            : new Prisma.Decimal(0),
          projectPrice: dto.projectPrice
            ? new Prisma.Decimal(dto.projectPrice)
            : new Prisma.Decimal(0),
          startDate: new Date(dto.startDate),
          plannedEndDate: dto.plannedEndDate
            ? new Date(dto.plannedEndDate)
            : null,
          actualEndDate: dto.actualEndDate ? new Date(dto.actualEndDate) : null,
          ...(dto.status ? { status: dto.status } : {}),
          clientHandlingPersonId: dto.clientHandlingPersonId ?? null,
          customFields: (dto.customFields ?? {}) as Prisma.InputJsonValue,
          createdBy,
          updatedBy: createdBy,
        },
      });

      if (
        dto.initialMemberEmployeeIds &&
        dto.initialMemberEmployeeIds.length > 0
      ) {
        await tx.projectMember.createMany({
          data: dto.initialMemberEmployeeIds.map((empId) => ({
            organizationId: scope.organizationId,
            projectId: project.id,
            employeeId: empId,
            role: "Contributor",
          })),
          skipDuplicates: true,
        });
      }

      return project;
    });
  }

  @OrgScoped()
  async update(
    scope: OrgScope,
    id: number,
    dto: UpdateProjectDto,
    updatedBy: number,
  ) {
    const {
      customFields,
      startDate,
      plannedEndDate,
      actualEndDate,
      expectedHours,
      projectPrice,
      name,
      status,
      description,
      salesCustomerId,
      customerName,
      projectType,
      departments,
      resourceNames,
      clientHandlingPersonId,
    } = dto;

    const data: Prisma.ProjectUncheckedUpdateManyInput = {
      ...(name !== undefined ? { name } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(description !== undefined
        ? { description: description ?? null }
        : {}),
      ...(salesCustomerId !== undefined ? { salesCustomerId } : {}),
      ...(customerName !== undefined
        ? { customerName: customerName ?? null }
        : {}),
      ...(projectType !== undefined
        ? { projectType: projectType ?? null }
        : {}),
      ...(departments !== undefined ? { departments } : {}),
      ...(resourceNames !== undefined ? { resourceNames } : {}),
      ...(clientHandlingPersonId !== undefined
        ? { clientHandlingPersonId: clientHandlingPersonId ?? null }
        : {}),
      ...(startDate ? { startDate: new Date(startDate) } : {}),
      ...(plannedEndDate !== undefined
        ? { plannedEndDate: plannedEndDate ? new Date(plannedEndDate) : null }
        : {}),
      ...(actualEndDate !== undefined
        ? { actualEndDate: actualEndDate ? new Date(actualEndDate) : null }
        : {}),
      ...(expectedHours !== undefined
        ? { expectedHours: new Prisma.Decimal(expectedHours) }
        : {}),
      ...(projectPrice !== undefined
        ? { projectPrice: new Prisma.Decimal(projectPrice) }
        : {}),
      ...(customFields !== undefined
        ? { customFields: customFields as Prisma.InputJsonValue }
        : {}),
      updatedBy,
    };

    const result = await this.prisma.project.updateMany({
      where: tenantWhere(scope, { id, deletedAt: null }),
      data,
    });

    if (result.count === 0) return null;
    return this.findOne(scope, id);
  }

  @OrgScoped()
  async softDelete(scope: OrgScope, id: number, deletedBy: number) {
    const result = await this.prisma.project.updateMany({
      where: tenantWhere(scope, { id, deletedAt: null }),
      data: {
        deletedAt: new Date(),
        updatedBy: deletedBy,
      },
    });
    return result.count > 0;
  }

  // ---------------------------------------------------------------------------
  // Members
  // ---------------------------------------------------------------------------

  @OrgScoped()
  async addMember(
    scope: OrgScope,
    projectId: number,
    dto: AddProjectMemberDto,
  ) {
    return this.prisma.projectMember.upsert({
      where: {
        projectId_employeeId: {
          projectId,
          employeeId: dto.employeeId,
        },
      },
      create: {
        organizationId: scope.organizationId,
        projectId,
        employeeId: dto.employeeId,
        role: dto.role ?? "Contributor",
        estimatedHours: dto.estimatedHours
          ? new Prisma.Decimal(dto.estimatedHours)
          : new Prisma.Decimal(0),
        hourlyRate: dto.hourlyRate
          ? new Prisma.Decimal(dto.hourlyRate)
          : new Prisma.Decimal(0),
      },
      update: {
        role: dto.role ?? "Contributor",
        ...(dto.estimatedHours !== undefined
          ? { estimatedHours: new Prisma.Decimal(dto.estimatedHours) }
          : {}),
        ...(dto.hourlyRate !== undefined
          ? { hourlyRate: new Prisma.Decimal(dto.hourlyRate) }
          : {}),
      },
      include: {
        employee: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
            workEmail: true,
          },
        },
      },
    });
  }

  @OrgScoped()
  async removeMember(scope: OrgScope, projectId: number, employeeId: number) {
    const result = await this.prisma.projectMember.deleteMany({
      where: {
        organizationId: scope.organizationId,
        projectId,
        employeeId,
      },
    });
    return result.count > 0;
  }

  @OrgScoped()
  findMembers(scope: OrgScope, projectId: number) {
    return this.prisma.projectMember.findMany({
      where: { organizationId: scope.organizationId, projectId },
      include: {
        employee: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
            workEmail: true,
          },
        },
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Milestones
  // ---------------------------------------------------------------------------

  @OrgScoped()
  findMilestones(scope: OrgScope, projectId: number) {
    return this.prisma.projectMilestone.findMany({
      where: {
        organizationId: scope.organizationId,
        projectId,
        deletedAt: null,
      },
      orderBy: { order: "asc" },
      include: {
        _count: { select: { tasks: true } },
      },
    });
  }

  @OrgScoped()
  findMilestoneById(scope: OrgScope, milestoneId: number) {
    return this.prisma.projectMilestone.findFirst({
      where: {
        id: milestoneId,
        organizationId: scope.organizationId,
        deletedAt: null,
      },
    });
  }

  @OrgScoped()
  createMilestone(scope: OrgScope, projectId: number, dto: CreateMilestoneDto) {
    return this.prisma.projectMilestone.create({
      data: {
        organizationId: scope.organizationId,
        projectId,
        title: dto.title,
        targetDate: new Date(dto.targetDate),
        order: dto.order ?? 1,
      },
    });
  }

  @OrgScoped()
  async updateMilestone(
    scope: OrgScope,
    milestoneId: number,
    dto: UpdateMilestoneDto,
  ) {
    const data: Prisma.ProjectMilestoneUpdateInput = {
      ...(dto.title !== undefined ? { title: dto.title } : {}),
      ...(dto.targetDate ? { targetDate: new Date(dto.targetDate) } : {}),
      ...(dto.actualDate !== undefined
        ? { actualDate: dto.actualDate ? new Date(dto.actualDate) : null }
        : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      ...(dto.order !== undefined ? { order: dto.order } : {}),
    };

    const result = await this.prisma.projectMilestone.updateMany({
      where: {
        id: milestoneId,
        organizationId: scope.organizationId,
        deletedAt: null,
      },
      data,
    });
    if (result.count === 0) return null;
    return this.findMilestoneById(scope, milestoneId);
  }

  @OrgScoped()
  async deleteMilestone(scope: OrgScope, milestoneId: number) {
    const result = await this.prisma.projectMilestone.updateMany({
      where: {
        id: milestoneId,
        organizationId: scope.organizationId,
        deletedAt: null,
      },
      data: { deletedAt: new Date() },
    });
    return result.count > 0;
  }

  // ---------------------------------------------------------------------------
  // Tasks
  // ---------------------------------------------------------------------------

  @OrgScoped()
  findTasks(scope: OrgScope, projectId: number) {
    return this.prisma.projectTask.findMany({
      where: {
        organizationId: scope.organizationId,
        projectId,
        deletedAt: null,
      },
      include: {
        assignedTo: {
          select: { id: true, fullName: true, employeeCode: true },
        },
        milestone: {
          select: { id: true, title: true, status: true },
        },
        dependencyTask: {
          select: { id: true, taskCode: true, title: true, status: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  @OrgScoped()
  findTaskById(scope: OrgScope, taskId: number) {
    return this.prisma.projectTask.findFirst({
      where: {
        id: taskId,
        organizationId: scope.organizationId,
        deletedAt: null,
      },
      include: {
        project: {
          select: { id: true, projectCode: true, name: true, status: true },
        },
        assignedTo: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
            workEmail: true,
          },
        },
        milestone: {
          select: { id: true, title: true, status: true, targetDate: true },
        },
        dependencyTask: {
          select: { id: true, taskCode: true, title: true, status: true },
        },
        dependentTasks: {
          where: { deletedAt: null },
          select: { id: true, taskCode: true, title: true, status: true },
        },
        timeEntries: {
          orderBy: { startedAt: "desc" },
        },
      },
    });
  }

  @OrgScoped()
  findMyTasks(scope: OrgScope, employeeId: number) {
    return this.prisma.projectTask.findMany({
      where: {
        organizationId: scope.organizationId,
        assignedToId: employeeId,
        deletedAt: null,
      },
      include: {
        project: {
          select: {
            id: true,
            projectCode: true,
            name: true,
            status: true,
            // The employee task-update modal shows the client without a
            // separate (org-wide) project read.
            customerName: true,
            salesCustomerId: true,
            clientHandlingPerson: { select: { id: true, fullName: true } },
          },
        },
        milestone: {
          select: { id: true, title: true, targetDate: true, status: true },
        },
      },
      orderBy: { endDate: "asc" },
    });
  }

  @OrgScoped()
  async createTask(
    scope: OrgScope,
    projectId: number,
    dto: CreateTaskDto,
    hoursToComplete: number,
    points: number,
    createdBy: number,
    project: { id: number; projectCode: string },
    codeFormat: TaskCodeFormat,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const taskCode = await issueTaskCode(
        tx,
        scope.organizationId,
        project,
        codeFormat,
      );

      return tx.projectTask.create({
        data: {
          organizationId: scope.organizationId,
          projectId,
          taskCode,
          title: dto.title,
          description: dto.description ?? null,
          milestoneId: dto.milestoneId ?? null,
          assignedToId: dto.assignedToId ?? null,
          department: dto.department ?? null,
          startDate: new Date(dto.startDate),
          endDate: new Date(dto.endDate),
          priority: dto.priority ?? TaskPriority.medium,
          dependencyTaskId: dto.dependencyTaskId ?? null,
          dependencyType: dto.dependencyType ?? null,
          dependencyRequirement: dto.dependencyRequirement ?? null,
          dependencyTargetId: dto.dependencyTargetId ?? null,
          dependencyTargetName: dto.dependencyTargetName ?? null,
          hoursToComplete: new Prisma.Decimal(hoursToComplete),
          points,
          customFields: (dto.customFields ?? {}) as Prisma.InputJsonValue,
          createdBy,
          updatedBy: createdBy,
        },
        include: {
          assignedTo: {
            select: { id: true, fullName: true, employeeCode: true },
          },
        },
      });
    });
  }

  @OrgScoped()
  async updateTask(
    scope: OrgScope,
    taskId: number,
    dto: UpdateTaskDto,
    computedHours: number | undefined,
    updatedBy: number,
    /** Present when the status changes: written to the audit log in the SAME
     * transaction, so the task's status history never misses a change. */
    statusAudit?: { before: TaskStatus; after: TaskStatus; reason: string },
    /** Present when the ETA (hoursToComplete) changes: it decides the
     * reward points, so every change is audited with its reason. */
    etaAudit?: { before: number; after: number; reason: string | null },
  ) {
    const {
      customFields,
      startDate,
      endDate,
      actualEndDate,
      title,
      description,
      milestoneId,
      assignedToId,
      department,
      status,
      priority,
      dependencyTaskId,
      dependencyType,
      dependencyRequirement,
      dependencyTargetId,
      dependencyTargetName,
      points,
      completionPercent,
    } = dto;

    const data: Prisma.ProjectTaskUpdateInput = {
      ...(title !== undefined ? { title } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(priority !== undefined ? { priority } : {}),
      ...(points !== undefined ? { points } : {}),
      ...(completionPercent !== undefined ? { completionPercent } : {}),
      ...(description !== undefined
        ? { description: description ?? null }
        : {}),
      ...(milestoneId !== undefined
        ? { milestoneId: milestoneId ?? null }
        : {}),
      ...(assignedToId !== undefined
        ? { assignedToId: assignedToId ?? null }
        : {}),
      ...(department !== undefined ? { department: department ?? null } : {}),
      ...(dependencyTaskId !== undefined
        ? { dependencyTaskId: dependencyTaskId ?? null }
        : {}),
      ...(dependencyType !== undefined
        ? { dependencyType: dependencyType ?? null }
        : {}),
      ...(dependencyRequirement !== undefined
        ? { dependencyRequirement: dependencyRequirement ?? null }
        : {}),
      ...(dependencyTargetId !== undefined
        ? { dependencyTargetId: dependencyTargetId ?? null }
        : {}),
      ...(dependencyTargetName !== undefined
        ? { dependencyTargetName: dependencyTargetName ?? null }
        : {}),
      ...(startDate ? { startDate: new Date(startDate) } : {}),
      ...(endDate ? { endDate: new Date(endDate) } : {}),
      ...(actualEndDate !== undefined
        ? { actualEndDate: actualEndDate ? new Date(actualEndDate) : null }
        : {}),
      ...(computedHours !== undefined
        ? { hoursToComplete: new Prisma.Decimal(computedHours) }
        : {}),
      ...(customFields !== undefined
        ? { customFields: customFields as Prisma.InputJsonValue }
        : {}),
      updatedBy,
    };

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.projectTask.updateMany({
        where: {
          id: taskId,
          organizationId: scope.organizationId,
          deletedAt: null,
        },
        data,
      });
      if (updated.count > 0 && statusAudit) {
        await this.audit.write(tx, {
          entityType: "project_task",
          entityId: taskId,
          action: "status_change",
          before: { status: statusAudit.before },
          after: { status: statusAudit.after },
          reason: statusAudit.reason,
        });
      }
      if (updated.count > 0 && etaAudit) {
        await this.audit.write(tx, {
          entityType: "project_task",
          entityId: taskId,
          action: "eta_change",
          before: { hoursToComplete: etaAudit.before },
          after: { hoursToComplete: etaAudit.after },
          ...(etaAudit.reason ? { reason: etaAudit.reason } : {}),
        });
      }
      return updated;
    });
    if (result.count === 0) return null;
    return this.findTaskById(scope, taskId);
  }

  /** A task's status history, oldest first — read from the audit trail that
   * every status change writes (lifecycle, timer and PATCH paths alike). */
  @OrgScoped()
  async findTaskStatusEvents(
    scope: OrgScope,
    taskId: number,
  ): Promise<{ at: Date; status: string }[]> {
    const rows = await this.prisma.auditLog.findMany({
      where: {
        organizationId: scope.organizationId,
        entityType: "project_task",
        entityId: BigInt(taskId),
        action: "status_change",
      },
      orderBy: { id: "asc" },
      select: { at: true, after: true },
    });
    const events: { at: Date; status: string }[] = [];
    for (const row of rows) {
      const status = (row.after as { status?: unknown } | null)?.status;
      if (typeof status === "string") events.push({ at: row.at, status });
    }
    return events;
  }

  @OrgScoped()
  findSessionWithTask(scope: OrgScope, sessionId: number) {
    return this.prisma.projectTimeEntry.findFirst({
      where: { id: sessionId, organizationId: scope.organizationId },
      include: { task: true },
    });
  }

  /** Projects an employee may attach an activity to: live projects they are a
   * member of or hold a task in. Identity fields only. */
  @OrgScoped()
  findLinkableProjects(scope: OrgScope, employeeId: number) {
    return this.prisma.project.findMany({
      where: {
        organizationId: scope.organizationId,
        deletedAt: null,
        OR: [
          { members: { some: { employeeId } } },
          { tasks: { some: { assignedToId: employeeId, deletedAt: null } } },
        ],
      },
      select: { id: true, projectCode: true, name: true },
      orderBy: { name: "asc" },
      take: 200,
    });
  }

  /** A task with a running timer cannot be reassigned or deleted: the open
   * session belongs to the current assignee and would be orphaned. */
  @OrgScoped()
  async hasOpenSession(scope: OrgScope, taskId: number): Promise<boolean> {
    const open = await this.prisma.projectTimeEntry.count({
      where: { organizationId: scope.organizationId, taskId, endedAt: null },
    });
    return open > 0;
  }

  @OrgScoped()
  countOpenSessionsInProject(scope: OrgScope, projectId: number) {
    return this.prisma.projectTimeEntry.count({
      where: {
        organizationId: scope.organizationId,
        endedAt: null,
        task: { projectId },
      },
    });
  }

  @OrgScoped()
  async softDeleteTask(scope: OrgScope, taskId: number, deletedBy: number) {
    const result = await this.prisma.projectTask.updateMany({
      where: {
        id: taskId,
        organizationId: scope.organizationId,
        deletedAt: null,
      },
      data: { deletedAt: new Date(), updatedBy: deletedBy },
    });
    return result.count > 0;
  }

  // ---------------------------------------------------------------------------
  // Time Tracking & Stopwatch
  // ---------------------------------------------------------------------------

  /** Closed time logged by an employee on/after `fromDate` (YYYY-MM-DD,
   * by entry date) — My Work "Logged Today" / "This Week" cards. */
  @OrgScoped()
  async sumLoggedMinutes(
    scope: OrgScope,
    employeeId: number,
    fromDate: string,
  ) {
    const result = await this.prisma.projectTimeEntry.aggregate({
      where: {
        organizationId: scope.organizationId,
        employeeId,
        endedAt: { not: null },
        // Bounded above by today (IST): a future-dated row must never count
        // toward "Logged Today" / "This Week".
        entryDate: {
          gte: new Date(fromDate),
          lte: parseDateOnly(businessToday()),
        },
      },
      _sum: { durationMinutes: true },
      _count: { id: true },
    });
    return {
      minutes: result._sum.durationMinutes ?? 0,
      entries: result._count.id,
    };
  }

  /** Display identity of one employee in the org, for the My Work
   * "viewing <name>" header (no HR details beyond name/code/department). */
  @OrgScoped()
  findEmployeeBrief(scope: OrgScope, employeeId: number) {
    return this.prisma.employee.findFirst({
      where: {
        id: employeeId,
        organizationId: scope.organizationId,
        deletedAt: null,
      },
      select: {
        id: true,
        fullName: true,
        employeeCode: true,
        department: { select: { name: true } },
        designation: { select: { name: true } },
      },
    });
  }

  /** The team an employee belongs to, or null when the employee is not in
   * this organization (or is deleted). Used to scope a Team Lead's task and
   * milestone writes to their own team(s). */
  @OrgScoped()
  async findEmployeeTeamId(
    scope: OrgScope,
    employeeId: number,
  ): Promise<number | null> {
    const row = await this.prisma.employee.findFirst({
      where: {
        id: employeeId,
        organizationId: scope.organizationId,
        deletedAt: null,
      },
      select: { teamId: true },
    });
    return row?.teamId ?? null;
  }

  /** True when the project has at least one member from one of `teamIds`. */
  @OrgScoped()
  async projectHasMemberInTeams(
    scope: OrgScope,
    projectId: number,
    teamIds: readonly number[],
  ): Promise<boolean> {
    if (teamIds.length === 0) return false;
    const found = await this.prisma.projectMember.findFirst({
      where: {
        organizationId: scope.organizationId,
        projectId,
        employee: {
          organizationId: scope.organizationId,
          deletedAt: null,
          teamId: { in: [...teamIds] },
        },
      },
      select: { id: true },
    });
    return found !== null;
  }

  @OrgScoped()
  findActiveTimer(scope: OrgScope, employeeId: number) {
    return this.prisma.projectTimeEntry.findFirst({
      where: {
        organizationId: scope.organizationId,
        employeeId,
        endedAt: null,
      },
      include: {
        task: {
          select: {
            id: true,
            taskCode: true,
            title: true,
            projectId: true,
            project: {
              select: { id: true, projectCode: true, name: true },
            },
          },
        },
      },
    });
  }

  /** Legacy `timer/start`. Delegates to the lifecycle transaction (employee +
   * task locks, the day's timesheet row, IST work date, task set in progress
   * and audited) and returns the session exactly as before. */
  @OrgScoped()
  async startTimer(scope: OrgScope, taskId: number, employeeId: number) {
    const result = await this.lifecycle.begin(scope, {
      taskId,
      employeeId,
      userId: null,
      now: new Date(),
      mode: "begin",
    });
    return this.prisma.projectTimeEntry.findUniqueOrThrow({
      where: { id: result.sessionId! },
      include: {
        task: {
          select: {
            id: true,
            taskCode: true,
            title: true,
            projectId: true,
            project: {
              select: { id: true, projectCode: true, name: true },
            },
          },
        },
      },
    });
  }

  /** Legacy `timer/stop` and the check-out auto-pause. Closes the session
   * (splitting it at IST midnight if needed); the caller rolls the hours up
   * separately. Idempotent: an already-closed session is returned as is. */
  @OrgScoped()
  async stopTimer(
    scope: OrgScope,
    entryId: number,
    durationMinutes: number,
    notes?: string,
    endedAt: Date = new Date(),
  ) {
    const closed = await this.lifecycle.closeSessionAt(scope, {
      sessionId: entryId,
      endedAt,
      closedReason: "STOPPED",
      notes,
      totalMinutes: durationMinutes,
      rollup: false,
      userId: null,
    });
    if (closed) return closed;
    return this.prisma.projectTimeEntry.findFirstOrThrow({
      where: { id: entryId, organizationId: scope.organizationId },
      include: { task: true },
    });
  }

  /** Legacy manual entry (a date and a duration): stored as a DURATION_ONLY
   * session linked to that day's timesheet row. */
  @OrgScoped()
  createManualTimeEntry(
    scope: OrgScope,
    taskId: number,
    employeeId: number,
    dto: CreateTimeEntryDto,
  ) {
    return this.lifecycle.addManualEntry(scope, {
      taskId,
      employeeId,
      userId: null,
      entryDate: dto.entryDate.slice(0, 10),
      durationMinutes: dto.durationMinutes,
      notes: dto.notes ?? null,
    });
  }

  @OrgScoped()
  findTaskTimeEntries(scope: OrgScope, taskId: number, employeeId?: number) {
    return this.prisma.projectTimeEntry.findMany({
      where: {
        organizationId: scope.organizationId,
        taskId,
        ...(employeeId !== undefined ? { employeeId } : {}),
      },
      include: {
        employee: {
          select: { id: true, fullName: true, employeeCode: true },
        },
      },
      orderBy: { startedAt: "desc" },
    });
  }

  @OrgScoped()
  async incrementLoggedHours(
    scope: OrgScope,
    projectId: number,
    taskId: number,
    employeeId: number,
    hours: number,
  ) {
    const decimalHours = new Prisma.Decimal(hours);
    await Promise.all([
      this.prisma.projectTask.update({
        where: { id: taskId },
        data: { loggedHours: { increment: decimalHours } },
      }),
      this.prisma.projectMember.updateMany({
        where: { projectId, employeeId },
        data: { loggedHours: { increment: decimalHours } },
      }),
    ]);
  }

  // ---------------------------------------------------------------------------
  // Expenses & Budget Utilization
  // ---------------------------------------------------------------------------

  @OrgScoped()
  findExpenses(scope: OrgScope, projectId?: number) {
    return this.prisma.projectExpense.findMany({
      where: {
        organizationId: scope.organizationId,
        ...(projectId ? { projectId } : {}),
      },
      include: {
        project: {
          select: { id: true, projectCode: true, name: true },
        },
        supplier: {
          select: { id: true, supplierCode: true, companyName: true },
        },
      },
      orderBy: { expenseDate: "desc" },
    });
  }

  @OrgScoped()
  async unlinkExpenseSupplier(scope: OrgScope, expenseId: number) {
    await this.prisma.projectExpense.updateMany({
      where: { id: expenseId, organizationId: scope.organizationId },
      data: { supplierId: null },
    });
  }

  @OrgScoped()
  findExpenseById(scope: OrgScope, expenseId: number) {
    return this.prisma.projectExpense.findFirst({
      where: { id: expenseId, organizationId: scope.organizationId },
    });
  }

  @OrgScoped()
  async createExpense(
    scope: OrgScope,
    projectId: number,
    dto: CreateExpenseDto,
    createdBy: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const expense = await tx.projectExpense.create({
        data: {
          organizationId: scope.organizationId,
          projectId,
          amount: new Prisma.Decimal(dto.amount),
          expenseDate: new Date(dto.expenseDate),
          department: dto.department ?? null,
          vendor: dto.vendor ?? null,
          supplierId: dto.supplierId ?? null,
          referenceNo: dto.referenceNo ?? null,
          status: dto.status ?? ProjectExpenseStatus.unpaid,
          notes: dto.notes ?? null,
          createdBy,
        },
      });

      // Update actualCost on project
      await tx.project.update({
        where: { id: projectId },
        data: { actualCost: { increment: new Prisma.Decimal(dto.amount) } },
      });

      return expense;
    });
  }

  @OrgScoped()
  async updateExpense(
    scope: OrgScope,
    expenseId: number,
    dto: UpdateExpenseDto,
  ) {
    const existing = await this.findExpenseById(scope, expenseId);
    if (!existing) return null;

    const {
      amount,
      expenseDate,
      department,
      vendor,
      supplierId,
      referenceNo,
      notes,
      status,
    } = dto;
    const amountDiff =
      amount !== undefined
        ? new Prisma.Decimal(amount).minus(existing.amount)
        : null;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.projectExpense.update({
        where: { id: expenseId },
        data: {
          ...(status !== undefined ? { status } : {}),
          ...(department !== undefined
            ? { department: department ?? null }
            : {}),
          ...(vendor !== undefined ? { vendor: vendor ?? null } : {}),
          ...(supplierId !== undefined
            ? { supplierId: supplierId ?? null }
            : {}),
          ...(referenceNo !== undefined
            ? { referenceNo: referenceNo ?? null }
            : {}),
          ...(notes !== undefined ? { notes: notes ?? null } : {}),
          ...(amount !== undefined
            ? { amount: new Prisma.Decimal(amount) }
            : {}),
          ...(expenseDate ? { expenseDate: new Date(expenseDate) } : {}),
        },
      });

      if (amountDiff && !amountDiff.isZero()) {
        await tx.project.update({
          where: { id: existing.projectId },
          data: { actualCost: { increment: amountDiff } },
        });
      }

      return updated;
    });
  }

  @OrgScoped()
  async deleteExpense(scope: OrgScope, expenseId: number) {
    const existing = await this.findExpenseById(scope, expenseId);
    if (!existing) return false;

    await this.prisma.$transaction(async (tx) => {
      await tx.projectExpense.delete({ where: { id: expenseId } });
      await tx.project.update({
        where: { id: existing.projectId },
        data: { actualCost: { decrement: existing.amount } },
      });
    });
    return true;
  }

  // ---------------------------------------------------------------------------
  // Gamification Points & Config
  // ---------------------------------------------------------------------------

  @OrgScoped()
  async getPointsConfig(scope: OrgScope) {
    return this.prisma.projectPointsConfig.upsert({
      where: { organizationId: scope.organizationId },
      create: {
        organizationId: scope.organizationId,
        low: 5,
        medium: 10,
        high: 20,
        urgent: 30,
      },
      update: {},
    });
  }

  @OrgScoped()
  updatePointsConfig(scope: OrgScope, dto: UpdatePointsConfigDto) {
    return this.prisma.projectPointsConfig.upsert({
      where: { organizationId: scope.organizationId },
      create: {
        organizationId: scope.organizationId,
        low: dto.low ?? 5,
        medium: dto.medium ?? 10,
        high: dto.high ?? 20,
        urgent: dto.urgent ?? 30,
        customRules: (dto.customRules ?? {}) as Prisma.InputJsonValue,
        ...(dto.timeBasedEnabled !== undefined
          ? { timeBasedEnabled: dto.timeBasedEnabled }
          : {}),
        ...(dto.defaultTaskPoints !== undefined
          ? { defaultTaskPoints: dto.defaultTaskPoints }
          : {}),
        ...(dto.onTimeBonus !== undefined
          ? { onTimeBonus: dto.onTimeBonus }
          : {}),
        ...(dto.graceMinutes !== undefined
          ? { graceMinutes: dto.graceMinutes }
          : {}),
      },
      update: {
        ...(dto.low !== undefined ? { low: dto.low } : {}),
        ...(dto.medium !== undefined ? { medium: dto.medium } : {}),
        ...(dto.high !== undefined ? { high: dto.high } : {}),
        ...(dto.urgent !== undefined ? { urgent: dto.urgent } : {}),
        ...(dto.customRules !== undefined
          ? { customRules: dto.customRules as Prisma.InputJsonValue }
          : {}),
        ...(dto.timeBasedEnabled !== undefined
          ? { timeBasedEnabled: dto.timeBasedEnabled }
          : {}),
        ...(dto.defaultTaskPoints !== undefined
          ? { defaultTaskPoints: dto.defaultTaskPoints }
          : {}),
        ...(dto.onTimeBonus !== undefined
          ? { onTimeBonus: dto.onTimeBonus }
          : {}),
        ...(dto.graceMinutes !== undefined
          ? { graceMinutes: dto.graceMinutes }
          : {}),
      },
    });
  }

  /** Pays a finished task to its assignee through the shared
   * `awardTaskPoints` (once per task and employee; fixed or time-based
   * depending on the config switch). */
  @OrgScoped()
  async awardTaskCompletion(
    scope: OrgScope,
    task: AwardableTask,
    employeeId: number,
  ) {
    return awardTaskPoints(this.prisma, scope.organizationId, task, employeeId);
  }

  /** What the manager Complete path needs to know before it completes a
   * task: whether time-based points are on, and the assignee's timer minutes. */
  @OrgScoped()
  async findPointsGate(scope: OrgScope, taskId: number, employeeId: number) {
    const enabled = await isTimeBasedPointsEnabled(
      this.prisma,
      scope.organizationId,
    );
    const workedMinutes = enabled
      ? await sumTimerMinutes(
          this.prisma,
          scope.organizationId,
          taskId,
          employeeId,
        )
      : 0;
    return { enabled, workedMinutes };
  }

  /** The employee's own awards, newest first, with the breakdown the
   * time-based rule stored (null fields on older rows). */
  @OrgScoped()
  findEmployeePointsAwards(scope: OrgScope, employeeId: number, take = 50) {
    return this.prisma.projectPointsLedger.findMany({
      where: { organizationId: scope.organizationId, employeeId },
      orderBy: { awardedAt: "desc" },
      take,
      select: {
        id: true,
        taskId: true,
        taskTitle: true,
        points: true,
        awardedAt: true,
        etaMinutes: true,
        workedMinutes: true,
        basePoints: true,
        bonusPoints: true,
        overrunMinutes: true,
        rule: true,
      },
    });
  }

  @OrgScoped()
  async getPointsLeaderboard(scope: OrgScope) {
    const raw = await this.prisma.projectPointsLedger.groupBy({
      by: ["employeeId"],
      where: { organizationId: scope.organizationId },
      _sum: { points: true },
      _count: { id: true },
      orderBy: { _sum: { points: "desc" } },
      take: 20,
    });

    const employeeIds = raw.map((r) => r.employeeId);
    const employees = await this.prisma.employee.findMany({
      where: { id: { in: employeeIds } },
      select: {
        id: true,
        fullName: true,
        employeeCode: true,
        designation: { select: { name: true } },
      },
    });
    const empMap = new Map(employees.map((e) => [e.id, e]));

    return raw.map((r) => ({
      employeeId: r.employeeId,
      employee: empMap.get(r.employeeId) ?? null,
      totalPoints: r._sum.points ?? 0,
      tasksCompletedCount: r._count.id,
    }));
  }
}
