import type { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import { classifyDbError } from "../../../common/database/db-errors.js";
import type { PaginationDto } from "../../../common/dto/pagination.dto.js";
import { ResourceConflictException } from "../../../common/exceptions/business.exception.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../../common/tenancy/tenant-where.js";
import type { AuditWriter } from "../../../platform/audit/audit-writer.js";
import type { PrismaService } from "../../../shared/prisma/prisma.service.js";

export interface MasterDataFilter {
  search?: string | undefined;
  isActive?: boolean | undefined;
  sortBy?: "name" | "code" | "createdAt" | undefined;
}

export interface MasterDataRow {
  id: number;
  isActive: boolean;
}

/** The slice of a Prisma model delegate this base needs. Declared with method
 * syntax so each module's generated delegate is assignable to it. */
export interface MasterDataDelegate<Row> {
  findMany(args: {
    where: object;
    skip: number;
    take: number;
    orderBy: object[];
  }): Promise<Row[]>;
  count(args: { where: object }): Promise<number>;
  findFirst(args: { where: object }): Promise<Row | null>;
  create(args: { data: object }): Promise<Row>;
  update(args: { where: { id: number }; data: object }): Promise<Row>;
}

type Client = PrismaService | Prisma.TransactionClient;

/** The only place `PrismaService` is called for a master-data module. Every
 * write runs in one transaction together with its audit row, so the two
 * commit or roll back as one. A concrete repository supplies the Prisma
 * delegate, the audit snapshot and, where it has them, the hooks for rules
 * specific to that entity (see shifts). */
export abstract class MasterDataRepository<
  Row extends MasterDataRow,
  CreateDto extends object,
  UpdateDto extends object,
> {
  protected abstract readonly entityType: string;
  /** Lower-case singular used in error messages, e.g. "work location". */
  protected abstract readonly noun: string;

  constructor(
    protected readonly prisma: PrismaService,
    protected readonly audit: AuditWriter,
  ) {}

  protected abstract delegate(client: Client): MasterDataDelegate<Row>;

  /** Allow-listed fields recorded in the audit trail (never the raw row). */
  protected abstract snapshot(row: Row): Record<string, unknown>;

  /** Extra column values derived from the DTO, merged into the create. */
  protected prepareCreate(_dto: CreateDto): Record<string, unknown> {
    return {};
  }

  /** May add derived columns to `changed` (or throw) before the update. */
  protected prepareUpdate(
    _before: Row,
    _changed: Record<string, unknown>,
  ): void {}

  /** Throws when the row may not be deactivated right now. */
  protected async assertCanDeactivate(
    _tx: Prisma.TransactionClient,
    _scope: OrgScope,
    _row: Row,
  ): Promise<void> {}

  @OrgScoped()
  async findMany(
    scope: OrgScope,
    filter: MasterDataFilter,
    pagination: PaginationDto,
  ) {
    const where = tenantWhere<Record<string, unknown>>(scope, {
      deletedAt: null,
      ...(filter.isActive !== undefined ? { isActive: filter.isActive } : {}),
      ...(filter.search
        ? {
            OR: [
              { code: { contains: filter.search, mode: "insensitive" } },
              { name: { contains: filter.search, mode: "insensitive" } },
            ],
          }
        : {}),
    });
    const [items, total] = await Promise.all([
      this.delegate(this.prisma).findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [
          { [filter.sortBy ?? "name"]: pagination.order ?? "asc" },
          { id: "asc" },
        ],
      }),
      this.delegate(this.prisma).count({ where }),
    ]);
    return { items, total };
  }

  @OrgScoped()
  findOne(scope: OrgScope, id: number) {
    return this.delegate(this.prisma).findFirst({
      where: tenantWhere(scope, { id, deletedAt: null }),
    });
  }

  @OrgScoped()
  findByCode(scope: OrgScope, code: string) {
    return this.delegate(this.prisma).findFirst({
      where: tenantWhere(scope, { code, deletedAt: null }),
    });
  }

  @OrgScoped()
  findByName(scope: OrgScope, name: string) {
    return this.delegate(this.prisma).findFirst({
      where: tenantWhere<Record<string, unknown>>(scope, {
        name: { equals: name, mode: "insensitive" },
        deletedAt: null,
      }),
    });
  }

  @OrgScoped()
  async create(scope: OrgScope, dto: CreateDto, actorId: number) {
    try {
      // Derived values are computed (and validated) before the transaction opens.
      const derived = this.prepareCreate(dto);
      return await this.prisma.$transaction(async (tx) => {
        const row = await this.delegate(tx).create({
          data: {
            ...dto,
            description: (dto as { description?: string }).description || null,
            ...derived,
            organizationId: scope.organizationId,
            createdBy: actorId,
            updatedBy: actorId,
          },
        });
        await this.audit.write(tx, {
          entityType: this.entityType,
          entityId: row.id,
          action: "create",
          after: this.snapshot(row),
        });
        return row;
      });
    } catch (error) {
      throw this.asConflict(error);
    }
  }

  /** Returns `null` when the row does not exist in this organization, and the
   * unchanged row (no write, no audit entry) when nothing actually changes. */
  @OrgScoped()
  async update(scope: OrgScope, id: number, dto: UpdateDto, actorId: number) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const before = await this.delegate(tx).findFirst({
          where: tenantWhere(scope, { id, deletedAt: null }),
        });
        if (!before) return null;

        const changed: Record<string, unknown> = {};
        for (const [key, raw] of Object.entries(
          dto as Record<string, unknown>,
        )) {
          if (raw === undefined) continue;
          const value = key === "description" && raw === "" ? null : raw;
          if ((before as unknown as Record<string, unknown>)[key] !== value) {
            changed[key] = value;
          }
        }
        if (Object.keys(changed).length === 0) return before;

        this.prepareUpdate(before, changed);

        const after = await this.delegate(tx).update({
          where: { id },
          data: { ...changed, updatedBy: actorId },
        });
        await this.audit.write(tx, {
          entityType: this.entityType,
          entityId: id,
          action: "update",
          before: this.snapshot(before),
          after: this.snapshot(after),
        });
        return after;
      });
    } catch (error) {
      throw this.asConflict(error);
    }
  }

  @OrgScoped()
  async setActive(
    scope: OrgScope,
    id: number,
    isActive: boolean,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const before = await this.delegate(tx).findFirst({
        where: tenantWhere(scope, { id, deletedAt: null }),
      });
      if (!before) return null;
      if (before.isActive === isActive) return before;

      if (!isActive) {
        await this.assertCanDeactivate(tx, scope, before);
      }

      const after = await this.delegate(tx).update({
        where: { id },
        data: { isActive, updatedBy: actorId },
      });
      await this.audit.write(tx, {
        entityType: this.entityType,
        entityId: id,
        action: isActive ? "activate" : "deactivate",
        before: this.snapshot(before),
        after: this.snapshot(after),
      });
      return after;
    });
  }

  /** A unique-constraint race the service's pre-check could not see. */
  private asConflict(error: unknown): unknown {
    return classifyDbError(error)?.kind === "unique"
      ? new ResourceConflictException(
          `A ${this.noun} with this code or name already exists`,
        )
      : error;
  }
}
