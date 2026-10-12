import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import { TeamScoped } from "../../../common/decorators/team-scoped.decorator.js";
import type { PaginationDto } from "../../../common/dto/pagination.dto.js";
import { BusinessRuleViolationException } from "../../../common/exceptions/business.exception.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import type { TeamScope } from "../../../common/tenancy/team-scope.js";
import { teamWhere } from "../../../common/tenancy/team-where.js";
import { tenantWhere } from "../../../common/tenancy/tenant-where.js";
import { AuditWriter } from "../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import type { CreateContactDto, UpdateContactDto } from "./dto/contact.dto.js";

const ENTITY_TYPE = "crm_contact";

/** Contact owns its own `teamId`/`createdBy` directly (no relation hop
 * needed), but `ownerField` must be pointed at `createdBy` — `teamWhere()`
 * defaults `ownerField` to `userId`, which this table doesn't have. */
const SCOPE_FIELDS = { ownerField: "createdBy" };
const INCLUDE = {
  account: { select: { id: true, name: true } },
} satisfies Prisma.ContactInclude;
type ContactRow = Prisma.ContactGetPayload<{ include: typeof INCLUDE }>;

export interface ContactFilter {
  q?: string | undefined;
  accountId?: number | undefined;
  isPrimary?: boolean | undefined;
  isDecisionMaker?: boolean | undefined;
}

function snapshot(row: ContactRow) {
  return {
    accountId: row.accountId,
    name: row.name,
    designation: row.designation,
    department: row.department,
    email: row.email,
    phone: row.phone,
    whatsapp: row.whatsapp,
    isPrimary: row.isPrimary,
    isDecisionMaker: row.isDecisionMaker,
    isActive: row.isActive,
  };
}

/** Search across name/designation/email/phone + the resolved account name,
 * mirroring the legacy Contacts.tsx search box exactly (case-insensitive
 * substring). */
function filterWhere(filter: ContactFilter): Prisma.ContactWhereInput {
  const clauses: Prisma.ContactWhereInput[] = [];
  clauses.push({ deletedAt: null });
  if (filter.accountId !== undefined) {
    clauses.push({ accountId: filter.accountId });
  }
  if (filter.isPrimary !== undefined) {
    clauses.push({ isPrimary: filter.isPrimary });
  }
  if (filter.isDecisionMaker !== undefined) {
    clauses.push({ isDecisionMaker: filter.isDecisionMaker });
  }
  if (filter.q) {
    clauses.push({
      OR: [
        { name: { contains: filter.q, mode: "insensitive" } },
        { designation: { contains: filter.q, mode: "insensitive" } },
        { email: { contains: filter.q, mode: "insensitive" } },
        { phone: { contains: filter.q, mode: "insensitive" } },
        { account: { name: { contains: filter.q, mode: "insensitive" } } },
      ],
    });
  }
  return { AND: clauses };
}

@Injectable()
export class ContactsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
  ) {}

  @TeamScoped()
  async findMany(
    scope: TeamScope,
    filter: ContactFilter,
    pagination: PaginationDto,
  ) {
    const where = teamWhere(scope, filterWhere(filter), SCOPE_FIELDS);
    const [items, total] = await Promise.all([
      this.prisma.contact.findMany({
        where,
        include: INCLUDE,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [{ name: pagination.order ?? "asc" }, { id: "asc" }],
      }),
      this.prisma.contact.count({ where }),
    ]);
    return { items, total };
  }

  @TeamScoped()
  async findOne(scope: TeamScope, id: number) {
    return this.prisma.contact.findFirst({
      where: teamWhere(scope, { id, deletedAt: null }, SCOPE_FIELDS),
      include: INCLUDE,
    });
  }

  /** Validates `accountId` belongs to the caller's organization before
   * inserting (legacy guarantee: a contact can never point at an account
   * that doesn't exist, or exists in a different organization). */
  @TeamScoped()
  async create(scope: TeamScope, dto: CreateContactDto, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      const account = await tx.account.findFirst({
        where: {
          id: dto.accountId,
          organizationId: scope.organizationId,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!account) {
        throw new BusinessRuleViolationException(
          `Account ${dto.accountId} does not exist in this organization`,
          "INVALID_ACCOUNT",
        );
      }
      const created = await tx.contact.create({
        data: {
          organizationId: scope.organizationId,
          teamId: scope.level === "team" ? (scope.teamIds[0] ?? null) : null,
          accountId: dto.accountId,
          name: dto.name,
          designation: dto.designation ?? null,
          department: dto.department ?? null,
          email: dto.email ?? null,
          phone: dto.phone ?? null,
          whatsapp: dto.whatsapp ?? null,
          isPrimary: dto.isPrimary ?? false,
          isDecisionMaker: dto.isDecisionMaker ?? false,
          createdBy: actorId,
          updatedBy: actorId,
        },
        include: INCLUDE,
      });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: created.id,
        action: "create",
        after: snapshot(created),
      });
      return created;
    });
  }

  @TeamScoped()
  async update(
    scope: TeamScope,
    id: number,
    dto: UpdateContactDto,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.contact.findFirst({
        where: teamWhere(scope, { id, deletedAt: null }, SCOPE_FIELDS),
        include: INCLUDE,
      });
      if (!before) return null;
      const after = await tx.contact.update({
        where: { id },
        data: {
          name: dto.name ?? before.name,
          designation:
            dto.designation === undefined
              ? before.designation
              : dto.designation || null,
          department:
            dto.department === undefined
              ? before.department
              : dto.department || null,
          email: dto.email === undefined ? before.email : dto.email || null,
          phone: dto.phone === undefined ? before.phone : dto.phone || null,
          whatsapp:
            dto.whatsapp === undefined ? before.whatsapp : dto.whatsapp || null,
          isPrimary: dto.isPrimary ?? before.isPrimary,
          isDecisionMaker: dto.isDecisionMaker ?? before.isDecisionMaker,
          updatedBy: actorId,
        },
        include: INCLUDE,
      });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: id,
        action: "update",
        before: snapshot(before),
        after: snapshot(after),
      });
      return after;
    });
  }

  /** Soft-delete only — never a hard delete (Docs/ARCHITECTURE.md §5). */
  @TeamScoped()
  async softDelete(scope: TeamScope, id: number, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.contact.findFirst({
        where: teamWhere(scope, { id, deletedAt: null }, SCOPE_FIELDS),
        include: INCLUDE,
      });
      if (!before) return null;
      const after = await tx.contact.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false, updatedBy: actorId },
        include: INCLUDE,
      });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: id,
        action: "delete",
        before: snapshot(before),
        after: snapshot(after),
      });
      return after;
    });
  }

  /** Used by the service to validate an `accountId` filter is at least
   * in-organization before handing it to `teamWhere()`. */
  @OrgScoped()
  async accountExists(scope: OrgScope, accountId: number): Promise<boolean> {
    const found = await this.prisma.account.findFirst({
      where: tenantWhere(scope, { id: accountId, deletedAt: null }),
      select: { id: true },
    });
    return found !== null;
  }
}
