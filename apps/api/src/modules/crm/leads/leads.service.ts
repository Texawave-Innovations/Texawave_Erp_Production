import { Injectable } from "@nestjs/common";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import { ResourceNotFoundException } from "../../../common/exceptions/business.exception.js";
import { TeamContextService } from "../../../platform/tenancy/team-context.service.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import { LeadsRepository, type LeadFilter } from "./leads.repository.js";
import type {
  ConvertLeadDto,
  CreateLeadDto,
  QueryLeadDto,
  UpdateLeadDto,
} from "./dto/lead.dto.js";

const READ = "crm.lead.read";
const WRITE = "crm.lead.write";

@Injectable()
export class LeadsService {
  constructor(
    private readonly repository: LeadsRepository,
    private readonly tenantContext: TenantContextService,
    private readonly teamContext: TeamContextService,
  ) {}

  async findAll(query: QueryLeadDto) {
    const scope = await this.teamContext.resolveScope(READ);
    const { items, total } = await this.repository.findMany(
      scope,
      this.filterOf(query),
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  async facets() {
    const scope = await this.teamContext.resolveScope(READ);
    return this.repository.facets(scope);
  }

  /** 404 — not 403 — for a lead outside the caller's scope, matching the
   * convention used by every other scoped module (e.g. crm.contact). */
  async findOne(id: number) {
    const scope = await this.teamContext.resolveScope(READ);
    const row = await this.repository.findOne(scope, id);
    if (!row) throw new ResourceNotFoundException("Lead", id);
    return row;
  }

  async create(dto: CreateLeadDto) {
    const scope = await this.teamContext.resolveScope(WRITE);
    return this.repository.create(scope, dto, this.tenantContext.getUserId());
  }

  async update(id: number, dto: UpdateLeadDto) {
    const scope = await this.teamContext.resolveScope(WRITE);
    const row = await this.repository.update(
      scope,
      id,
      dto,
      this.tenantContext.getUserId(),
    );
    if (!row) throw new ResourceNotFoundException("Lead", id);
    return row;
  }

  async listNotes(id: number) {
    const scope = await this.teamContext.resolveScope(READ);
    const rows = await this.repository.listNotes(scope, id);
    if (!rows) throw new ResourceNotFoundException("Lead", id);
    return rows;
  }

  async addNote(id: number, content: string) {
    const scope = await this.teamContext.resolveScope(WRITE);
    const row = await this.repository.addNote(
      scope,
      id,
      content,
      this.tenantContext.getUserId(),
    );
    if (!row) throw new ResourceNotFoundException("Lead", id);
    return row;
  }

  async deleteNote(id: number, noteId: number) {
    const scope = await this.teamContext.resolveScope(WRITE);
    const ok = await this.repository.deleteNote(scope, id, noteId);
    if (ok === null) throw new ResourceNotFoundException("Lead", id);
    if (!ok) throw new ResourceNotFoundException("Lead note", noteId);
  }

  async timeline(id: number) {
    const scope = await this.teamContext.resolveScope(READ);
    const rows = await this.repository.timeline(scope, id);
    if (!rows) throw new ResourceNotFoundException("Lead", id);
    return rows;
  }

  async remove(id: number) {
    const scope = await this.teamContext.resolveScope(WRITE);
    const row = await this.repository.softDelete(
      scope,
      id,
      this.tenantContext.getUserId(),
    );
    if (!row) throw new ResourceNotFoundException("Lead", id);
    return row;
  }

  async convert(id: number, dto: ConvertLeadDto) {
    const scope = await this.teamContext.resolveScope(WRITE);
    const row = await this.repository.convert(
      scope,
      id,
      dto,
      this.tenantContext.getUserId(),
    );
    if (!row) throw new ResourceNotFoundException("Lead", id);
    return row;
  }

  private filterOf(query: QueryLeadDto): LeadFilter {
    return {
      q: query.q,
      leadStatus: query.leadStatus,
      assignedTo: query.assignedTo,
      leadSource: query.leadSource,
      industry: query.industry,
      city: query.city,
      country: query.country,
      converted: query.converted,
      sortBy: query.sortBy,
      rating: query.rating,
      touched: query.touched,
      createdBy: query.createdBy,
      createdFrom: query.createdFrom,
      createdTo: query.createdTo,
      minAnnualRevenue: query.minAnnualRevenue,
    };
  }
}
