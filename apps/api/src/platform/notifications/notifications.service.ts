import { Injectable } from "@nestjs/common";
import { PaginatedResponseDto } from "../../common/dto/paginated-response.dto.js";
import { ResourceNotFoundException } from "../../common/exceptions/business.exception.js";
import type { OrgScope } from "../../common/tenancy/org-scope.js";
import { TenantContextService } from "../tenancy/tenant-context.service.js";
import type { QueryNotificationsDto } from "./dto/query-notifications.dto.js";
import {
  NotificationsRepository,
  type NewNotification,
} from "./notifications.repository.js";

/**
 * In-app notifications (Docs/ARCHITECTURE.md §11, 2026-10-11; Docs/HR_API.md → Notifications).
 *
 * - `notify()` is the ONLY way to send one. It is for server-side code (jobs,
 *   services) and takes the organization explicitly, because jobs run outside
 *   a request. Nothing a client sends can create a notification.
 * - The inbox methods are self-service: the recipient is always the caller
 *   from the JWT. There is no way to name another user.
 */
@Injectable()
export class NotificationsService {
  constructor(
    private readonly repository: NotificationsRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  /** Idempotent per (recipient, dedupKey). Returns how many were stored. */
  notify(scope: OrgScope, items: readonly NewNotification[]): Promise<number> {
    return this.repository.createMany(scope, items);
  }

  async findMine(query: QueryNotificationsDto) {
    const { items, total } = await this.repository.findMine(
      this.tenantContext.getOrgScope(),
      this.tenantContext.getUserId(),
      query.unreadOnly ?? false,
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  async unreadCount(): Promise<{ unread: number }> {
    const unread = await this.repository.countUnread(
      this.tenantContext.getOrgScope(),
      this.tenantContext.getUserId(),
    );
    return { unread };
  }

  /** 404 for a notification that is not the caller's. */
  async markRead(id: number) {
    const row = await this.repository.markRead(
      this.tenantContext.getOrgScope(),
      this.tenantContext.getUserId(),
      id,
    );
    if (!row) throw new ResourceNotFoundException("Notification", id);
    return row;
  }

  async markAllRead(): Promise<{ marked: number }> {
    const marked = await this.repository.markAllRead(
      this.tenantContext.getOrgScope(),
      this.tenantContext.getUserId(),
    );
    return { marked };
  }
}
