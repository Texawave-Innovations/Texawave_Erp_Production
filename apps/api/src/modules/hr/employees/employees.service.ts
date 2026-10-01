import { ForbiddenException, Injectable } from "@nestjs/common";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import type { PaginationDto } from "../../../common/dto/pagination.dto.js";
import { ResourceNotFoundException } from "../../../common/exceptions/business.exception.js";
import { TeamContextService } from "../../../platform/tenancy/team-context.service.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import type { CreateEmployeeDto } from "./dto/create-employee.dto.js";
import type { QueryEmployeeDto } from "./dto/query-employee.dto.js";
import type { UpdateEmployeeDto } from "./dto/update-employee.dto.js";
import { toDetail, toListItem } from "./employee-mappers.js";
import { EmployeesRepository } from "./employees.repository.js";

const READ = "hr.employee.read";
const WRITE = "hr.employee.write";

/** Fields only an `.all` writer may change: they move a person across the
 * team access boundary or alter their contractual/employment record. */
const ALL_ONLY_FIELDS = [
  "teamId",
  "departmentId",
  "designationId",
  "employmentTypeId",
  "dateOfJoining",
] as const;

@Injectable()
export class EmployeesService {
  constructor(
    private readonly repository: EmployeesRepository,
    private readonly tenantContext: TenantContextService,
    private readonly teamContext: TeamContextService,
  ) {}

  async findAll(query: QueryEmployeeDto) {
    const scope = await this.teamContext.resolveScope(READ);
    const { items, total } = await this.repository.findMany(
      scope,
      {
        search: query.search,
        status: query.status,
        teamId: query.teamId,
        departmentId: query.departmentId,
        designationId: query.designationId,
        employmentTypeId: query.employmentTypeId,
        workLocationId: query.workLocationId,
        reportsToId: query.reportsToId,
        hasUser: query.hasUser,
        joinedFrom: query.joinedFrom,
        joinedTo: query.joinedTo,
        sortBy: query.sortBy,
      },
      query,
    );
    return new PaginatedResponseDto(
      items.map(toListItem),
      total,
      query.page,
      query.limit,
    );
  }

  /** 404 — not 403 — for an employee outside the caller's scope, so the
   * existence of records the caller may not see is not disclosed. */
  async findOne(id: number) {
    const scope = await this.teamContext.resolveScope(READ);
    const row = await this.repository.findOne(scope, id);
    if (!row) throw new ResourceNotFoundException("Employee", id);
    return toDetail(row);
  }

  async create(dto: CreateEmployeeDto) {
    const scope = await this.teamContext.resolveScope(WRITE);
    if (scope.level === "own") {
      throw new ForbiddenException("You may not create employees");
    }
    if (scope.level === "team" && !scope.teamIds.includes(dto.teamId)) {
      throw new ForbiddenException(
        "You may create employees only in your own team(s)",
      );
    }
    const row = await this.repository.create(
      this.tenantContext.getOrgScope(),
      dto,
      this.tenantContext.getUserId(),
    );
    return toDetail(row);
  }

  async update(id: number, dto: UpdateEmployeeDto) {
    const scope = await this.teamContext.resolveScope(WRITE);
    if (scope.level === "own") {
      // Self-service profile edits are not part of the approved scope.
      throw new ForbiddenException("You may not edit employee records");
    }
    if (scope.level === "team") {
      const restricted = ALL_ONLY_FIELDS.filter((f) => dto[f] !== undefined);
      if (restricted.length > 0) {
        throw new ForbiddenException(
          `Only organization-wide HR may change: ${restricted.join(", ")}`,
        );
      }
    }
    const row = await this.repository.update(
      scope,
      id,
      dto,
      this.tenantContext.getUserId(),
    );
    if (!row) throw new ResourceNotFoundException("Employee", id);
    return toDetail(row);
  }

  /** Visible to whoever may read the employee. The audit trail (with
   * before/after snapshots) is a separate, more restricted surface. */
  async statusHistory(id: number, pagination: PaginationDto) {
    const readScope = await this.teamContext.resolveScope(READ);
    if (!(await this.repository.findOne(readScope, id))) {
      throw new ResourceNotFoundException("Employee", id);
    }
    const { items, total } = await this.repository.findStatusHistory(
      this.tenantContext.getOrgScope(),
      id,
      pagination,
    );
    return new PaginatedResponseDto(
      items,
      total,
      pagination.page,
      pagination.limit,
    );
  }
}
