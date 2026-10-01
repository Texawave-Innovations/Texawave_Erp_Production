import { ForbiddenException, Injectable } from "@nestjs/common";
import { parseDateOnly } from "../../../common/dates/date-only.js";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import { ResourceNotFoundException } from "../../../common/exceptions/business.exception.js";
import { TeamContextService } from "../../../platform/tenancy/team-context.service.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import type {
  CreateShiftAssignmentDto,
  EndShiftAssignmentDto,
  QueryShiftAssignmentDto,
  ResolveShiftQueryDto,
  VoidShiftAssignmentDto,
} from "./dto/shift-assignment.dto.js";
import { ShiftAssignmentsRepository } from "./shift-assignments.repository.js";

const READ = "hr.shift_assignment.read";
const WRITE = "hr.shift_assignment.write";

@Injectable()
export class ShiftAssignmentsService {
  constructor(
    private readonly repository: ShiftAssignmentsRepository,
    private readonly tenantContext: TenantContextService,
    private readonly teamContext: TeamContextService,
  ) {}

  async findAll(query: QueryShiftAssignmentDto) {
    const scope = await this.teamContext.resolveScope(READ);
    const { items, total } = await this.repository.findMany(
      scope,
      {
        employeeId: query.employeeId,
        teamId: query.teamId,
        shiftId: query.shiftId,
        activeOn: query.activeOn,
        includeVoided: query.includeVoided,
      },
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  async findOne(id: number) {
    const scope = await this.teamContext.resolveScope(READ);
    const row = await this.repository.findOne(scope, id);
    if (!row) throw new ResourceNotFoundException("Shift assignment", id);
    return row;
  }

  /** The shift an employee works on a date — see the precedence note on
   * `ShiftAssignmentsRepository.resolve`. `null` data = no shift assigned. */
  async resolve(query: ResolveShiftQueryDto) {
    const scope = await this.teamContext.resolveScope(READ);
    if (!(await this.repository.employeeVisible(scope, query.employeeId))) {
      throw new ResourceNotFoundException("Employee", query.employeeId);
    }
    return this.repository.resolve(
      this.tenantContext.getOrgScope(),
      query.employeeId,
      parseDateOnly(query.date),
    );
  }

  async create(dto: CreateShiftAssignmentDto) {
    return this.repository.create(
      await this.writeScope(),
      dto,
      this.tenantContext.getUserId(),
    );
  }

  async end(id: number, dto: EndShiftAssignmentDto) {
    const row = await this.repository.end(
      await this.writeScope(),
      id,
      dto,
      this.tenantContext.getUserId(),
    );
    if (!row) throw new ResourceNotFoundException("Shift assignment", id);
    return row;
  }

  async void(id: number, dto: VoidShiftAssignmentDto) {
    const row = await this.repository.voidOne(
      await this.writeScope(),
      id,
      dto.reason,
      this.tenantContext.getUserId(),
    );
    if (!row) throw new ResourceNotFoundException("Shift assignment", id);
    return row;
  }

  /** `.own` is reserved (an employee cannot pick their own shift); `.team`
   * and `.all` are narrowed to their rows inside the repository. */
  private async writeScope() {
    const scope = await this.teamContext.resolveScope(WRITE);
    if (scope.level === "own") {
      throw new ForbiddenException("You may not manage shift assignments");
    }
    return scope;
  }
}
