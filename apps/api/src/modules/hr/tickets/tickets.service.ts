import { ForbiddenException, Injectable } from "@nestjs/common";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import { ResourceNotFoundException } from "../../../common/exceptions/business.exception.js";
import { TeamContextService } from "../../../platform/tenancy/team-context.service.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import { EmployeeQueryService } from "../employees/employee-query.service.js";
import type {
  CreateMyTicketDto,
  CreateTicketCommentDto,
  CreateTicketDto,
  QueryMyTicketDto,
  QueryTicketDto,
  UpdateMyTicketDto,
  UpdateTicketStatusDto,
} from "./dto/ticket.dto.js";
import { TicketsRepository, type TicketFilter } from "./tickets.repository.js";
import { assertEmployeeCategory } from "./tickets.rules.js";

const READ = "hr.ticket.read";
const WRITE = "hr.ticket.write";

@Injectable()
export class TicketsService {
  constructor(
    private readonly repository: TicketsRepository,
    private readonly tenantContext: TenantContextService,
    private readonly teamContext: TeamContextService,
    private readonly employees: EmployeeQueryService,
  ) {}

  // ---- HR / admin view (own · team · all) ----------------------------------

  async findAll(query: QueryTicketDto) {
    const scope = await this.teamContext.resolveScope(READ);
    const { items, total } = await this.repository.findMany(
      scope,
      this.hrFilterOf(query),
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  /** 404 — not 403 — outside the caller's scope. */
  async findOne(id: number) {
    const scope = await this.teamContext.resolveScope(READ);
    const row = await this.repository.findOne(scope, id);
    if (!row) throw new ResourceNotFoundException("Ticket", id);
    return row;
  }

  // ---- admin writes (team-scoped) ------------------------------------------

  async create(dto: CreateTicketDto) {
    const scope = await this.writeScope();
    return this.repository.create(
      scope,
      {
        employeeId: dto.employeeId,
        category: dto.category,
        subject: dto.subject,
        description: dto.description,
      },
      this.tenantContext.getUserId(),
    );
  }

  async setStatus(id: number, dto: UpdateTicketStatusDto) {
    const scope = await this.writeScope();
    const row = await this.repository.setStatus(
      scope,
      id,
      dto.status,
      this.tenantContext.getUserId(),
    );
    if (!row) throw new ResourceNotFoundException("Ticket", id);
    return row;
  }

  async addHrComment(id: number, dto: CreateTicketCommentDto) {
    const scope = await this.writeScope();
    const row = await this.repository.addHrComment(
      scope,
      id,
      dto.body,
      this.tenantContext.getUserId(),
    );
    if (!row) throw new ResourceNotFoundException("Ticket", id);
    return row;
  }

  // ---- self-service (tickets the caller raised or HR raised for them) -------

  async findMine(query: QueryMyTicketDto) {
    const employee = await this.employees.getCurrentEmployee();
    const { items, total } = await this.repository.findMine(
      this.tenantContext.getOrgScope(),
      employee.id,
      this.selfFilterOf(query),
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
    );
    if (!row) throw new ResourceNotFoundException("Ticket", id);
    return row;
  }

  /** The requester is the AUTHENTICATED user's own record (JWT); the body
   * cannot name an employee. */
  async createForCurrentEmployee(dto: CreateMyTicketDto) {
    assertEmployeeCategory(dto.category);
    const employee = await this.employees.getCurrentEmployee();
    return this.repository.createForEmployee(
      this.tenantContext.getOrgScope(),
      employee.id,
      {
        category: dto.category,
        subject: dto.subject,
        description: dto.description,
      },
      this.tenantContext.getUserId(),
    );
  }

  async updateMine(id: number, dto: UpdateMyTicketDto) {
    assertEmployeeCategory(dto.category);
    const employee = await this.employees.getCurrentEmployee();
    const row = await this.repository.updateOwn(
      this.tenantContext.getOrgScope(),
      employee.id,
      id,
      {
        category: dto.category,
        subject: dto.subject,
        description: dto.description,
      },
      this.tenantContext.getUserId(),
    );
    if (!row) throw new ResourceNotFoundException("Ticket", id);
    return row;
  }

  async addMyComment(id: number, dto: CreateTicketCommentDto) {
    const employee = await this.employees.getCurrentEmployee();
    const row = await this.repository.addEmployeeComment(
      this.tenantContext.getOrgScope(),
      employee.id,
      id,
      dto.body,
    );
    if (!row) throw new ResourceNotFoundException("Ticket", id);
    return row;
  }

  // ---- helpers --------------------------------------------------------------

  /** `.own` is reserved: nobody may raise or decide tickets for only their own
   * record through this surface (self-service has its own endpoints). `.team`
   * and `.all` are narrowed to their rows inside the repository. */
  private async writeScope() {
    const scope = await this.teamContext.resolveScope(WRITE);
    if (scope.level === "own") {
      throw new ForbiddenException("You may not manage tickets");
    }
    return scope;
  }

  /** HR list filters. Only this surface may narrow by category or employee. */
  private hrFilterOf(query: QueryTicketDto): TicketFilter {
    return {
      status: query.status,
      q: query.q,
      category: query.category,
      employeeId: query.employeeId,
    };
  }

  /** Self list filters. Deliberately reads no category or employee field: the
   * employee is always the caller, and a client-supplied one is ignored. */
  private selfFilterOf(query: QueryMyTicketDto): TicketFilter {
    return { status: query.status, q: query.q };
  }
}
