import { Injectable } from "@nestjs/common";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from "../../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import { CrmTasksService } from "../tasks/tasks.service.js";
import { AccountsRepository } from "./accounts.repository.js";
import type {
  ChangeAccountStatusTagDto,
  CreateAccountDto,
  QueryAccountDto,
  UpdateAccountDto,
} from "./dto/account.dto.js";

/** Per-tag required companion field, matching legacy `StatusTagDialog`'s
 * `isValid` check exactly. */
function assertStatusTagFieldsPresent(dto: ChangeAccountStatusTagDto): void {
  if (dto.statusTag === "Not Interested" && !dto.statusReason?.trim()) {
    throw new BusinessRuleViolationException(
      "A reason is required when setting status to Not Interested",
      "MISSING_STATUS_REASON",
    );
  }
  if (dto.statusTag === "Keep in Touch" && !dto.statusDate) {
    throw new BusinessRuleViolationException(
      "A date is required when setting status to Keep in Touch",
      "MISSING_STATUS_DATE",
    );
  }
  if (dto.statusTag === "Call Back" && !dto.statusDate) {
    throw new BusinessRuleViolationException(
      "A date/time is required when setting status to Call Back",
      "MISSING_STATUS_DATE",
    );
  }
  if (dto.statusTag === "Send Info" && !dto.statusInfoType?.trim()) {
    throw new BusinessRuleViolationException(
      "An info type is required when setting status to Send Info",
      "MISSING_STATUS_INFO_TYPE",
    );
  }
}

@Injectable()
export class AccountsService {
  constructor(
    private readonly repository: AccountsRepository,
    private readonly tenantContext: TenantContextService,
    private readonly crmTasks: CrmTasksService,
  ) {}

  async findAll(query: QueryAccountDto) {
    const { items, total } = await this.repository.findMany(
      this.tenantContext.getOrgScope(),
      { search: query.search, statusTag: query.statusTag },
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  async findOne(id: number) {
    const row = await this.repository.findOne(
      this.tenantContext.getOrgScope(),
      id,
    );
    if (!row) throw new ResourceNotFoundException("Account", id);
    return row;
  }

  create(dto: CreateAccountDto) {
    return this.repository.create(
      this.tenantContext.getOrgScope(),
      dto,
      this.tenantContext.getUserId(),
    );
  }

  async update(id: number, dto: UpdateAccountDto) {
    const row = await this.repository.update(
      this.tenantContext.getOrgScope(),
      id,
      dto,
      this.tenantContext.getUserId(),
    );
    if (!row) throw new ResourceNotFoundException("Account", id);
    return row;
  }

  /** Matches legacy `changeCrmAccountStatusTag`: validates the per-tag
   * required field, writes the status fields, then — for Keep in Touch /
   * Call Back / Send Info — creates a follow-up CrmTask. Simplified vs.
   * legacy for Phase 0: always creates a new task rather than rescheduling
   * an already-open one for the same account (documented gap, Docs/
   * CRM_FULL_LEGACY_PARITY.md). */
  async changeStatusTag(id: number, dto: ChangeAccountStatusTagDto) {
    assertStatusTagFieldsPresent(dto);
    const row = await this.repository.changeStatusTag(
      this.tenantContext.getOrgScope(),
      id,
      dto,
      this.tenantContext.getUserId(),
    );
    if (!row) throw new ResourceNotFoundException("Account", id);

    if (dto.statusTag === "Keep in Touch" || dto.statusTag === "Call Back") {
      await this.crmTasks.create({
        relatedType: "account",
        relatedId: id,
        title:
          dto.statusTag === "Call Back"
            ? `Call back — ${row.name}`
            : `Keep in touch — ${row.name}`,
        dueDate: (dto.statusDate ?? new Date().toISOString()).slice(0, 10),
        assignedTo: row.ownerName ?? "Unassigned",
        priority: "Medium",
      });
    } else if (dto.statusTag === "Send Info") {
      await this.crmTasks.create({
        relatedType: "account",
        relatedId: id,
        title: `Send info (${dto.statusInfoType}) — ${row.name}`,
        dueDate: new Date().toISOString().slice(0, 10),
        assignedTo: row.ownerName ?? "Unassigned",
        priority: "Medium",
      });
    }
    return row;
  }

  async remove(id: number) {
    const row = await this.repository.softDelete(
      this.tenantContext.getOrgScope(),
      id,
      this.tenantContext.getUserId(),
    );
    if (!row) throw new ResourceNotFoundException("Account", id);
    return row;
  }
}
