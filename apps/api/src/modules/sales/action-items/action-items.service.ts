import { Injectable } from "@nestjs/common";
import { parseDateOnly } from "../../../common/dates/date-only.js";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import { ResourceNotFoundException } from "../../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import { ActionItemsRepository } from "./action-items.repository.js";
import type {
  CreateActionItemDto,
  QueryActionItemDto,
} from "./dto/action-item.dto.js";

/** The Sales dashboard checklist: follow-ups shared by everyone in the
 * organization who holds `sales.action_item.*`. */
@Injectable()
export class ActionItemsService {
  constructor(
    private readonly repository: ActionItemsRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async findAll(query: QueryActionItemDto) {
    const scope = this.tenantContext.getOrgScope();
    const { items, total } = await this.repository.findMany(
      scope,
      query.state ?? "open",
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  create(dto: CreateActionItemDto) {
    return this.repository.create(
      this.tenantContext.getOrgScope(),
      {
        title: dto.title,
        dueDate: dto.dueDate ? parseDateOnly(dto.dueDate) : null,
      },
      this.tenantContext.getUserId(),
    );
  }

  async setDone(id: number, done: boolean) {
    const row = await this.repository.setDone(
      this.tenantContext.getOrgScope(),
      id,
      done,
      this.tenantContext.getUserId(),
    );
    if (!row) throw new ResourceNotFoundException("Action item", id);
    return row;
  }

  async remove(id: number): Promise<void> {
    const deleted = await this.repository.softDelete(
      this.tenantContext.getOrgScope(),
      id,
      this.tenantContext.getUserId(),
    );
    if (!deleted) throw new ResourceNotFoundException("Action item", id);
  }

  /** Public, read-only: open/overdue counts for the dashboard. */
  countOpen(today: Date) {
    return this.repository.countOpen(this.tenantContext.getOrgScope(), today);
  }
}
