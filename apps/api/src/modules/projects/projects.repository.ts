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
} from "./sequences/project-sequences.js";

@Injectable()
export class ProjectsRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // Projects Core
  // ---------------------------------------------------------------------------

  @OrgScoped()
  async findMany(scope: OrgScope, query: QueryProjectDto) {
    const where: Prisma.ProjectRecordWhereInput = tenantWhere(scope, {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.department ? { department: query.department } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
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
      this.prisma.projectRecord.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { createdAt: query.order ?? "desc" },
        include: {
          clientHandlingPerson: {
            select: { id: true, fullName: true, employeeCode: true },
          },
          customer: {
            select: { id: true, name: true },
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
            select: { id: true, status: true },
          },
          _count: {
            select: { tasks: true, expenses: true },
          },
        },
      }),
      this.prisma.projectRecord.count({ where }),
    ]);

    return { items, total };
  }

  @OrgScoped()
  findOne(scope: OrgScope, id: number) {
    return this.prisma.projectRecord.findFirst({
      where: tenantWhere(scope, { id, deletedAt: null }),
      include: {
        clientHandlingPerson: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
            workEmail: true,
          },
        },
        customer: {
          select: { id: true, name: true },
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

  @OrgScoped()
  findByCode(scope: OrgScope, projectCode: string) {
    return this.prisma.projectRecord.findFirst({
      where: tenantWhere(scope, { projectCode, deletedAt: null }),
    });
  }

  @OrgScoped()
  async create(scope: OrgScope, dto: CreateProjectDto, createdBy: number) {
    return this.prisma.$transaction(async (tx) => {
      const projectCode = await issueProjectCode(tx, scope.organizationId);

      const project = await tx.projectRecord.create({
        data: {
          organizationId: scope.organizationId,
          projectCode,
          name: dto.name,
          description: dto.description ?? null,
          customerId: dto.customerId ?? null,
          customerName: dto.customerName ?? null,
          projectType: dto.projectType ?? null,
          department: dto.department ?? null,
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
      customerId,
      customerName,
      projectType,
      department,
      clientHandlingPersonId,
    } = dto;

    const data: Prisma.ProjectRecordUpdateInput = {
      ...(name !== undefined ? { name } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(description !== undefined
        ? { description: description ?? null }
        : {}),
      ...(customerId !== undefined ? { customerId: customerId ?? null } : {}),
      ...(customerName !== undefined
        ? { customerName: customerName ?? null }
        : {}),
      ...(projectType !== undefined
        ? { projectType: projectType ?? null }
        : {}),
      ...(department !== undefined ? { department: department ?? null } : {}),
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

    const result = await this.prisma.projectRecord.updateMany({
      where: tenantWhere(scope, { id, deletedAt: null }),
      data,
    });

    if (result.count === 0) return null;
    return this.findOne(scope, id);
  }

  @OrgScoped()
  async softDelete(scope: OrgScope, id: number, deletedBy: number) {
    const result = await this.prisma.projectRecord.updateMany({
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
          select: { id: true, projectCode: true, name: true, status: true },
        },
        milestone: {
          select: { id: true, title: true },
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
  ) {
    return this.prisma.$transaction(async (tx) => {
      const taskCode = await issueTaskCode(tx, scope.organizationId);

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

    const result = await this.prisma.projectTask.updateMany({
      where: {
        id: taskId,
        organizationId: scope.organizationId,
        deletedAt: null,
      },
      data,
    });
    if (result.count === 0) return null;
    return this.findTaskById(scope, taskId);
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

  @OrgScoped()
  startTimer(scope: OrgScope, taskId: number, employeeId: number) {
    const now = new Date();
    return this.prisma.projectTimeEntry.create({
      data: {
        organizationId: scope.organizationId,
        taskId,
        employeeId,
        startedAt: now,
        entryDate: now,
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

  @OrgScoped()
  async stopTimer(
    scope: OrgScope,
    entryId: number,
    durationMinutes: number,
    notes?: string,
  ) {
    const now = new Date();
    return this.prisma.projectTimeEntry.update({
      where: { id: entryId },
      data: {
        endedAt: now,
        durationMinutes,
        ...(notes !== undefined ? { notes } : {}),
      },
      include: {
        task: true,
      },
    });
  }

  @OrgScoped()
  createManualTimeEntry(
    scope: OrgScope,
    taskId: number,
    employeeId: number,
    dto: CreateTimeEntryDto,
  ) {
    const date = new Date(dto.entryDate);
    return this.prisma.projectTimeEntry.create({
      data: {
        organizationId: scope.organizationId,
        taskId,
        employeeId,
        startedAt: date,
        endedAt: new Date(date.getTime() + dto.durationMinutes * 60000),
        durationMinutes: dto.durationMinutes,
        entryDate: date,
        notes: dto.notes ?? null,
      },
    });
  }

  @OrgScoped()
  findTaskTimeEntries(scope: OrgScope, taskId: number) {
    return this.prisma.projectTimeEntry.findMany({
      where: { organizationId: scope.organizationId, taskId },
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
      },
      orderBy: { expenseDate: "desc" },
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
          referenceNo: dto.referenceNo ?? null,
          status: dto.status ?? ProjectExpenseStatus.unpaid,
          notes: dto.notes ?? null,
          createdBy,
        },
      });

      // Update actualCost on project
      await tx.projectRecord.update({
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
        await tx.projectRecord.update({
          where: { id: existing.projectId },
          data: { actualCost: { increment: amountDiff } },
        });
      }

      return updated;
    });
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
      },
      update: {
        ...(dto.low !== undefined ? { low: dto.low } : {}),
        ...(dto.medium !== undefined ? { medium: dto.medium } : {}),
        ...(dto.high !== undefined ? { high: dto.high } : {}),
        ...(dto.urgent !== undefined ? { urgent: dto.urgent } : {}),
        ...(dto.customRules !== undefined
          ? { customRules: dto.customRules as Prisma.InputJsonValue }
          : {}),
      },
    });
  }

  @OrgScoped()
  awardPoints(
    scope: OrgScope,
    employeeId: number,
    taskId: number,
    taskTitle: string,
    points: number,
    note?: string,
  ) {
    return this.prisma.projectPointsLedger.create({
      data: {
        organizationId: scope.organizationId,
        employeeId,
        taskId,
        taskTitle,
        points,
        note: note ?? null,
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
