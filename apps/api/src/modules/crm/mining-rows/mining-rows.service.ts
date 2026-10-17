import { Injectable } from "@nestjs/common";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from "../../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import { LeadsService } from "../leads/leads.service.js";
import type {
  CreateCrmMiningRowDto,
  QueryCrmMiningRowDto,
  UpdateCrmMiningRowDto,
} from "./dto/mining-row.dto.js";
import { CrmMiningRowsRepository } from "./mining-rows.repository.js";

/** Keeps only non-empty values, so optional Lead fields are omitted (not
 * set to undefined) under exactOptionalPropertyTypes. */
function present<K extends string>(
  fields: Record<K, string | null>,
): { [P in K]?: string } {
  return Object.fromEntries(
    Object.entries<string | null>(fields).filter(([, v]) => v),
  ) as { [P in K]?: string };
}

@Injectable()
export class CrmMiningRowsService {
  constructor(
    private readonly repository: CrmMiningRowsRepository,
    private readonly tenantContext: TenantContextService,
    private readonly leads: LeadsService,
  ) {}

  async findAll(query: QueryCrmMiningRowDto) {
    const { items, total } = await this.repository.findMany(
      this.tenantContext.getOrgScope(),
      query.search,
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  async findOne(id: number) {
    const row = await this.repository.findOne(
      this.tenantContext.getOrgScope(),
      id,
    );
    if (!row) throw new ResourceNotFoundException("CrmMiningRow", id);
    return row;
  }

  create(dto: CreateCrmMiningRowDto) {
    return this.repository.create(
      this.tenantContext.getOrgScope(),
      dto,
      this.tenantContext.getUserId(),
    );
  }

  async update(id: number, dto: UpdateCrmMiningRowDto) {
    const row = await this.repository.update(
      this.tenantContext.getOrgScope(),
      id,
      dto,
      this.tenantContext.getUserId(),
    );
    if (!row) throw new ResourceNotFoundException("CrmMiningRow", id);
    return row;
  }

  /** Legacy `handlePromoteToLead` (AccountsMiningSheet.tsx): creates a Lead
   * through the normal LeadsService path (so lead team scoping and audit
   * apply) and links it back. Idempotent: a promoted row is refused (422).
   * The final link is a conditional update, so a concurrent double-click
   * cannot leave two leads: the loser's lead is soft-deleted again. */
  async promote(id: number) {
    const scope = this.tenantContext.getOrgScope();
    const actorId = this.tenantContext.getUserId();
    const row = await this.repository.findOne(scope, id);
    if (!row) throw new ResourceNotFoundException("CrmMiningRow", id);
    if (row.promotedToLeadId !== null) throw this.alreadyPromoted();

    const assignedTo =
      row.assignedTo ?? (await this.repository.findUserName(scope, actorId));
    const lead = await this.leads.create({
      companyName: row.companyName,
      prospectName: row.keyDecisionMakers ?? "",
      leadStatus: "NEW",
      priority: row.priority ?? "Medium",
      leadSource: "Accounts Mining",
      ...present({
        domain: row.domain,
        hq: row.hq,
        title: row.title,
        contactNumber: row.contactNumber,
        email: row.email,
        areaOfInterest: row.notes,
        assignedTo,
        industry: row.industry,
        numberOfEmployees: row.numberOfEmployees,
        city: row.city,
        state: row.state,
        country: row.country,
      }),
    });

    const linked = await this.repository.linkPromotedLead(
      scope,
      id,
      lead.id,
      actorId,
    );
    if (!linked) {
      await this.leads.remove(lead.id);
      throw this.alreadyPromoted();
    }
    return linked;
  }

  async remove(id: number) {
    const row = await this.repository.softDelete(
      this.tenantContext.getOrgScope(),
      id,
      this.tenantContext.getUserId(),
    );
    if (!row) throw new ResourceNotFoundException("CrmMiningRow", id);
    return row;
  }

  private alreadyPromoted() {
    return new BusinessRuleViolationException(
      "This mining row has already been promoted to a Lead",
      "MINING_ROW_ALREADY_PROMOTED",
    );
  }
}
