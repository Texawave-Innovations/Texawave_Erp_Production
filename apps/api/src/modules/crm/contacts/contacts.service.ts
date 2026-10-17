import { Injectable } from "@nestjs/common";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import { ResourceNotFoundException } from "../../../common/exceptions/business.exception.js";
import { TeamContextService } from "../../../platform/tenancy/team-context.service.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import {
  ContactsRepository,
  type ContactFilter,
} from "./contacts.repository.js";
import type {
  CreateContactDto,
  QueryContactDto,
  UpdateContactDto,
} from "./dto/contact.dto.js";

const READ = "crm.contact.read";
const WRITE = "crm.contact.write";

@Injectable()
export class ContactsService {
  constructor(
    private readonly repository: ContactsRepository,
    private readonly tenantContext: TenantContextService,
    private readonly teamContext: TeamContextService,
  ) {}

  async findAll(query: QueryContactDto) {
    const scope = await this.teamContext.resolveScope(READ);
    const { items, total } = await this.repository.findMany(
      scope,
      this.filterOf(query),
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  /** 404 — not 403 — for a contact outside the caller's scope, matching the
   * convention used by every other scoped module (e.g. hr.task). */
  async findOne(id: number) {
    const scope = await this.teamContext.resolveScope(READ);
    const row = await this.repository.findOne(scope, id);
    if (!row) throw new ResourceNotFoundException("Contact", id);
    return row;
  }

  async create(dto: CreateContactDto) {
    const scope = await this.teamContext.resolveScope(WRITE);
    return this.repository.create(scope, dto, this.tenantContext.getUserId());
  }

  async update(id: number, dto: UpdateContactDto) {
    const scope = await this.teamContext.resolveScope(WRITE);
    const row = await this.repository.update(
      scope,
      id,
      dto,
      this.tenantContext.getUserId(),
    );
    if (!row) throw new ResourceNotFoundException("Contact", id);
    return row;
  }

  async remove(id: number) {
    const scope = await this.teamContext.resolveScope(WRITE);
    const row = await this.repository.softDelete(
      scope,
      id,
      this.tenantContext.getUserId(),
    );
    if (!row) throw new ResourceNotFoundException("Contact", id);
    return row;
  }

  private filterOf(query: QueryContactDto): ContactFilter {
    return {
      q: query.q,
      accountId: query.accountId,
      isPrimary: query.isPrimary,
      isDecisionMaker: query.isDecisionMaker,
    };
  }
}
