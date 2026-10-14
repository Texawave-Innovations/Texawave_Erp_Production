import { Injectable } from "@nestjs/common";
import type { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../common/decorators/org-scoped.decorator.js";
import type { PaginationDto } from "../../common/dto/pagination.dto.js";
import type { OrgScope } from "../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../common/tenancy/tenant-where.js";
import { PrismaService } from "../../shared/prisma/prisma.service.js";

export interface NewNotification {
  userId: number;
  type: string;
  title: string;
  body: string;
  link?: string | null;
  /** Same key for the same user is stored once (see the model comment). */
  dedupKey?: string | null;
}

const SELECT = {
  id: true,
  type: true,
  title: true,
  body: true,
  link: true,
  readAt: true,
  createdAt: true,
} satisfies Prisma.NotificationSelect;

export type NotificationRow = Prisma.NotificationGetPayload<{
  select: typeof SELECT;
}>;

/** Only place PrismaService is used for notifications. Every read and write
 * is keyed by organization AND recipient, so a user can only ever see or
 * mark their own rows. */
@Injectable()
export class NotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Idempotent bulk insert: a (user, dedupKey) pair already stored is
   * skipped. Recipients must belong to the organization (checked here, so a
   * caller bug cannot deliver across tenants). Returns how many were new. */
  @OrgScoped()
  async createMany(
    scope: OrgScope,
    items: readonly NewNotification[],
  ): Promise<number> {
    if (items.length === 0) return 0;
    const userIds = [...new Set(items.map((i) => i.userId))];
    const members = await this.prisma.user.findMany({
      where: tenantWhere(scope, { id: { in: userIds } }),
      select: { id: true },
    });
    const allowed = new Set(members.map((m) => m.id));
    const data = items
      .filter((i) => allowed.has(i.userId))
      .map((i) => ({
        organizationId: scope.organizationId,
        userId: i.userId,
        type: i.type,
        title: i.title,
        body: i.body,
        link: i.link ?? null,
        dedupKey: i.dedupKey ?? null,
      }));
    if (data.length === 0) return 0;
    const { count } = await this.prisma.notification.createMany({
      data,
      skipDuplicates: true,
    });
    return count;
  }

  @OrgScoped()
  async findMine(
    scope: OrgScope,
    userId: number,
    unreadOnly: boolean,
    pagination: PaginationDto,
  ): Promise<{ items: NotificationRow[]; total: number }> {
    const where = this.mine(scope, userId, unreadOnly);
    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        select: SELECT,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.notification.count({ where }),
    ]);
    return { items, total };
  }

  @OrgScoped()
  async countUnread(scope: OrgScope, userId: number): Promise<number> {
    return this.prisma.notification.count({
      where: this.mine(scope, userId, true),
    });
  }

  /** Marks one of the caller's notifications read. Returns null when it is
   * not theirs (the caller answers 404, never revealing someone else's row).
   * Re-marking keeps the first read time. */
  @OrgScoped()
  async markRead(
    scope: OrgScope,
    userId: number,
    id: number,
  ): Promise<NotificationRow | null> {
    const where = { ...this.mine(scope, userId, false), id };
    const existing = await this.prisma.notification.findFirst({
      where,
      select: SELECT,
    });
    if (!existing) return null;
    if (existing.readAt) return existing;
    await this.prisma.notification.updateMany({
      where: { ...where, readAt: null },
      data: { readAt: new Date() },
    });
    return this.prisma.notification.findFirst({ where, select: SELECT });
  }

  @OrgScoped()
  async markAllRead(scope: OrgScope, userId: number): Promise<number> {
    const { count } = await this.prisma.notification.updateMany({
      where: this.mine(scope, userId, true),
      data: { readAt: new Date() },
    });
    return count;
  }

  private mine(
    scope: OrgScope,
    userId: number,
    unreadOnly: boolean,
  ): Prisma.NotificationWhereInput {
    return tenantWhere<Prisma.NotificationWhereInput>(scope, {
      userId,
      deletedAt: null,
      ...(unreadOnly ? { readAt: null } : {}),
    });
  }
}
