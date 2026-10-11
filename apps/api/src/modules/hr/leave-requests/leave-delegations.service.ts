import { Injectable } from "@nestjs/common";
import {
  inclusiveDays,
  parseDateOnly,
} from "../../../common/dates/date-only.js";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from "../../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import type {
  CreateLeaveDelegationDto,
  QueryLeaveDelegationDto,
} from "./dto/leave-request.dto.js";
import { LeaveDelegationsRepository } from "./leave-delegations.repository.js";
import { LeaveNotificationsService } from "./leave-notifications.service.js";
import { today } from "./leave-requests.repository.js";

/** Longest a single delegation may run; longer cover is a role change. */
export const MAX_DELEGATION_DAYS = 90;

/**
 * A reporting manager names a stand-in for leave approval (Docs/HR_LEAVE.md
 * §6.2). Self-service for the caller: they create and revoke only their own
 * delegations and see only delegations they gave or received. Gated by
 * `hr.leave.approve` (any level) at the controller — only someone who
 * approves leave has approval to hand over.
 */
@Injectable()
export class LeaveDelegationsService {
  constructor(
    private readonly repository: LeaveDelegationsRepository,
    private readonly tenantContext: TenantContextService,
    private readonly notifier: LeaveNotificationsService,
  ) {}

  async findMine(query: QueryLeaveDelegationDto) {
    const { items, total } = await this.repository.findMine(
      this.tenantContext.getOrgScope(),
      this.tenantContext.getUserId(),
      query.activeOnly ?? false,
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  async create(dto: CreateLeaveDelegationDto) {
    const me = this.tenantContext.getUserId();
    if (dto.delegateUserId === me) {
      throw new BusinessRuleViolationException(
        "You cannot delegate leave approval to yourself",
        "INVALID_DELEGATE",
      );
    }
    if (dto.endDate < dto.startDate) {
      throw new BusinessRuleViolationException(
        "endDate cannot be before startDate",
        "DELEGATION_DATES_INVALID",
      );
    }
    if (dto.endDate < today()) {
      throw new BusinessRuleViolationException(
        "A delegation must end today or later",
        "DELEGATION_DATES_INVALID",
      );
    }
    if (
      inclusiveDays(parseDateOnly(dto.startDate), parseDateOnly(dto.endDate)) >
      MAX_DELEGATION_DAYS
    ) {
      throw new BusinessRuleViolationException(
        `A delegation may cover at most ${MAX_DELEGATION_DAYS} days`,
        "DELEGATION_TOO_LONG",
      );
    }
    const view = await this.repository.create(
      this.tenantContext.getOrgScope(),
      me,
      dto,
    );
    await this.notifier.delegationCreated(view);
    return view;
  }

  /** Only the delegator revokes; anyone else's id is 404. */
  async revoke(id: number) {
    const view = await this.repository.revoke(
      this.tenantContext.getOrgScope(),
      this.tenantContext.getUserId(),
      id,
    );
    if (!view) throw new ResourceNotFoundException("Leave delegation", id);
    return view;
  }
}
