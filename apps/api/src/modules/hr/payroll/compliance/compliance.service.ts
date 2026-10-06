import { Injectable } from "@nestjs/common";
import { parseDateOnly } from "../../../../common/dates/date-only.js";
import { PaginatedResponseDto } from "../../../../common/dto/paginated-response.dto.js";
import { ResourceNotFoundException } from "../../../../common/exceptions/business.exception.js";
import { TeamContextService } from "../../../../platform/tenancy/team-context.service.js";
import { ComplianceRepository } from "./compliance.repository.js";
import type {
  QueryContributionDto,
  UpdateEmployeeEsiProfileDto,
  UpdateEmployeePfProfileDto,
} from "./dto/compliance.dto.js";

const PF_READ = "hr.pf.read";
const PF_WRITE = "hr.pf.write";
const ESI_READ = "hr.esi.read";
const ESI_WRITE = "hr.esi.write";

@Injectable()
export class ComplianceService {
  constructor(
    private readonly repository: ComplianceRepository,
    private readonly teamContext: TeamContextService,
  ) {}

  // ---- PF ------------------------------------------------------------------

  async getPfProfile(employeeId: number) {
    const scope = await this.teamContext.resolveScope(PF_READ);
    const profile = await this.repository.getPfProfile(scope, employeeId);
    if (!profile) {
      throw new ResourceNotFoundException("Employee PF profile", employeeId);
    }
    return profile;
  }

  async updatePfProfile(employeeId: number, dto: UpdateEmployeePfProfileDto) {
    const scope = await this.teamContext.resolveScope(PF_WRITE);
    const from = dto.effectiveFrom
      ? parseDateOnly(dto.effectiveFrom)
      : undefined;
    const to = dto.effectiveTo ? parseDateOnly(dto.effectiveTo) : undefined;
    return this.repository.upsertPfProfile(scope, employeeId, dto, from, to);
  }

  async findPfContributions(query: QueryContributionDto) {
    const scope = await this.teamContext.resolveScope(PF_READ);
    const { items, total } = await this.repository.findPfContributions(
      scope,
      query,
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  async findPfContributionById(id: number) {
    const scope = await this.teamContext.resolveScope(PF_READ);
    const item = await this.repository.findPfContributionById(scope, id);
    if (!item) throw new ResourceNotFoundException("PF contribution", id);
    return item;
  }

  // ---- ESI -----------------------------------------------------------------

  async getEsiProfile(employeeId: number) {
    const scope = await this.teamContext.resolveScope(ESI_READ);
    const profile = await this.repository.getEsiProfile(scope, employeeId);
    if (!profile) {
      throw new ResourceNotFoundException("Employee ESI profile", employeeId);
    }
    return profile;
  }

  async updateEsiProfile(employeeId: number, dto: UpdateEmployeeEsiProfileDto) {
    const scope = await this.teamContext.resolveScope(ESI_WRITE);
    const from = dto.effectiveFrom
      ? parseDateOnly(dto.effectiveFrom)
      : undefined;
    const to = dto.effectiveTo ? parseDateOnly(dto.effectiveTo) : undefined;
    return this.repository.upsertEsiProfile(scope, employeeId, dto, from, to);
  }

  async findEsiContributions(query: QueryContributionDto) {
    const scope = await this.teamContext.resolveScope(ESI_READ);
    const { items, total } = await this.repository.findEsiContributions(
      scope,
      query,
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  async findEsiContributionById(id: number) {
    const scope = await this.teamContext.resolveScope(ESI_READ);
    const item = await this.repository.findEsiContributionById(scope, id);
    if (!item) throw new ResourceNotFoundException("ESI contribution", id);
    return item;
  }
}
