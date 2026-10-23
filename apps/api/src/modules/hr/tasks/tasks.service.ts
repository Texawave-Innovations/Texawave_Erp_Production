import { ForbiddenException, Injectable } from "@nestjs/common";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import { ResourceNotFoundException } from "../../../common/exceptions/business.exception.js";
import { TeamContextService } from "../../../platform/tenancy/team-context.service.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import { EmployeeQueryService } from "../employees/employee-query.service.js";
import { NotificationsService } from "../../../platform/notifications/notifications.service.js";
import type {
  CreateMyTaskDto,
  CreateTaskDto,
  QueryMyTaskDto,
  QueryTaskDto,
  ReassignTaskDto,
  UpdateMyTaskStatusDto,
  UpdateTaskStatusDto,
} from "./dto/task.dto.js";
import { TasksRepository, type TaskFilter } from "./tasks.repository.js";
import { assertDueDateNotPast, istToday } from "./tasks.rules.js";

const READ = "hr.task.read";
const WRITE = "hr.task.write";

@Injectable()
export class TasksService {
  constructor(
    private readonly repository: TasksRepository,
    private readonly tenantContext: TenantContextService,
    private readonly teamContext: TeamContextService,
    private readonly employees: EmployeeQueryService,
    private readonly notifications: NotificationsService,
  ) {}

  // ---- HR / admin view (own · team · all) ----------------------------------

  async findAll(query: QueryTaskDto) {
    const scope = await this.teamContext.resolveScope(READ);
    const { items, total } = await this.repository.findMany(
      scope,
      this.filterOf(query),
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  /** 404 — not 403 — outside the caller's scope. */
  async findOne(id: number) {
    const scope = await this.teamContext.resolveScope(READ);
    const row = await this.repository.findOne(scope, id, istToday());
    if (!row) throw new ResourceNotFoundException("Task", id);
    return row;
  }

  // ---- admin writes (team-scoped) ------------------------------------------

  async create(dto: CreateTaskDto) {
    const scope = await this.writeScope();
    const today = istToday();
    assertDueDateNotPast(dto.dueDate, today);
    const created = await this.repository.create(
      scope,
      {
        title: dto.title,
        description: dto.description || undefined,
        assigneeId: dto.assigneeId,
        dueDate: dto.dueDate,
        priority: dto.priority ?? "MEDIUM",
      },
      this.tenantContext.getUserId(),
      today,
    );

    if (
      created?.assignee?.userId &&
      created.assignee.userId !== this.tenantContext.getUserId()
    ) {
      void this.notifications.notifyUser(scope, created.assignee.userId, {
        type: "task.assigned",
        title: `New Task Assigned: ${created.title}`,
        body: `HR assigned a new task to you with due date ${created.dueDate}. Priority: ${created.priority}.`,
        link: `/portal/tasks?id=${created.id}`,
      });
    }

    return created;
  }

  async reassign(id: number, dto: ReassignTaskDto) {
    const scope = await this.writeScope();
    const row = await this.repository.reassign(
      scope,
      id,
      dto.assigneeId,
      this.tenantContext.getUserId(),
      istToday(),
    );
    if (!row) throw new ResourceNotFoundException("Task", id);

    if (
      row?.assignee?.userId &&
      row.assignee.userId !== this.tenantContext.getUserId()
    ) {
      void this.notifications.notifyUser(scope, row.assignee.userId, {
        type: "task.assigned",
        title: `Task Assigned to You: ${row.title}`,
        body: `A task has been assigned to you with due date ${row.dueDate}. Priority: ${row.priority}.`,
        link: `/portal/tasks?id=${row.id}`,
      });
    }

    return row;
  }

  async setStatus(id: number, dto: UpdateTaskStatusDto) {
    const scope = await this.writeScope();
    const row = await this.repository.setStatus(
      scope,
      id,
      dto.status,
      this.tenantContext.getUserId(),
      istToday(),
    );
    if (!row) throw new ResourceNotFoundException("Task", id);

    if (
      row?.assignee?.userId &&
      row.assignee.userId !== this.tenantContext.getUserId()
    ) {
      void this.notifications.notifyUser(scope, row.assignee.userId, {
        type: "task.updated",
        title: `Task Status: ${dto.status}`,
        body: `Your task "${row.title}" status has been updated to ${dto.status}.`,
        link: `/portal/tasks?id=${row.id}`,
      });
    }

    return row;
  }

  async approve(id: number) {
    const scope = await this.writeScope();
    const row = await this.repository.approve(
      scope,
      id,
      this.tenantContext.getUserId(),
      istToday(),
    );
    if (!row) throw new ResourceNotFoundException("Task", id);

    if (
      row?.assignee?.userId &&
      row.assignee.userId !== this.tenantContext.getUserId()
    ) {
      void this.notifications.notifyUser(scope, row.assignee.userId, {
        type: "task.updated",
        title: `Task Approved ✓`,
        body: `Your task "${row.title}" has been reviewed and approved by HR.`,
        link: `/portal/tasks?id=${row.id}`,
      });
    }

    return row;
  }

  async reopen(id: number) {
    const scope = await this.writeScope();
    const row = await this.repository.reopen(
      scope,
      id,
      this.tenantContext.getUserId(),
      istToday(),
    );
    if (!row) throw new ResourceNotFoundException("Task", id);
    return row;
  }

  // ---- self-service (tasks assigned to OR created by the caller) -----------

  async findMine(query: QueryMyTaskDto) {
    const employee = await this.employees.getCurrentEmployee();
    const { items, total } = await this.repository.findMine(
      this.tenantContext.getOrgScope(),
      employee.id,
      this.filterOf(query),
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  async findMineOne(id: number) {
    const employee = await this.employees.getCurrentEmployee();
    const row = await this.repository.findMineOne(
      this.tenantContext.getOrgScope(),
      employee.id,
      id,
      istToday(),
    );
    if (!row) throw new ResourceNotFoundException("Task", id);
    return row;
  }

  /** The employee is the AUTHENTICATED user's own record (JWT); the body
   * cannot name an assignee. */
  async createForCurrentEmployee(dto: CreateMyTaskDto) {
    const employee = await this.employees.getCurrentEmployee();
    const today = istToday();
    assertDueDateNotPast(dto.dueDate, today);
    const created = await this.repository.createForEmployee(
      this.tenantContext.getOrgScope(),
      employee.id,
      {
        title: dto.title,
        description: dto.description || undefined,
        dueDate: dto.dueDate,
        priority: dto.priority ?? "MEDIUM",
        requestToAdmin: dto.requestToAdmin ?? false,
      },
      this.tenantContext.getUserId(),
      today,
    );

    if (dto.requestToAdmin) {
      void this.notifications.notifyAdmins(
        this.tenantContext.getOrgScope(),
        {
          type: "task.request",
          title: "New Task Request for Admin",
          body: `${employee.fullName} submitted a task request: "${dto.title}".`,
          link: `/hr/tasks?id=${created.id}&tab=requests`,
        },
        this.tenantContext.getUserId(),
      );
    }

    return created;
  }

  async updateMyStatus(id: number, dto: UpdateMyTaskStatusDto) {
    const employee = await this.employees.getCurrentEmployee();
    const row = await this.repository.setOwnStatus(
      this.tenantContext.getOrgScope(),
      employee.id,
      id,
      dto.status,
      this.tenantContext.getUserId(),
      istToday(),
    );
    if (!row) throw new ResourceNotFoundException("Task", id);

    if (row.requestToAdmin || row.awaitingApproval || dto.status === "DONE") {
      void this.notifications.notifyAdmins(
        this.tenantContext.getOrgScope(),
        {
          type: "task.completed",
          title: "Task Submitted for Review",
          body: `${employee.fullName} marked task "${row.title}" as ${dto.status}.`,
          link: `/hr/tasks?id=${row.id}&tab=requests`,
        },
        this.tenantContext.getUserId(),
      );
    }

    return row;
  }

  // ---- helpers --------------------------------------------------------------

  /** `.own` is reserved: nobody may assign or decide tasks for only their own
   * record through this surface (self-service has its own endpoints). `.team`
   * and `.all` are narrowed to their rows inside the repository. */
  private async writeScope() {
    const scope = await this.teamContext.resolveScope(WRITE);
    if (scope.level === "own") {
      throw new ForbiddenException("You may not manage tasks");
    }
    return scope;
  }

  private filterOf(query: QueryTaskDto | QueryMyTaskDto): TaskFilter {
    return {
      status: query.status,
      priority: query.priority,
      assigneeId: "assigneeId" in query ? query.assigneeId : undefined,
      q: query.q,
      awaitingApproval: query.awaitingApproval,
      overdue: query.overdue,
      today: istToday(),
    };
  }
}
