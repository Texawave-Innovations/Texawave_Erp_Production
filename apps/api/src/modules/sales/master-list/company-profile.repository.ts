import { Injectable } from "@nestjs/common";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../../common/tenancy/tenant-where.js";
import { AuditWriter } from "../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";

const ENTITY_TYPE = "sales_company_profile";

const SELECT = {
  id: true,
  legalName: true,
  tagline: true,
  address: true,
  gstin: true,
  stateCode: true,
  pan: true,
  email: true,
  phone: true,
  logoStorageKey: true,
  logoMimeType: true,
  updatedAt: true,
} as const;

type ProfileRow = {
  updatedAt: Date;
  logoStorageKey: string | null;
  logoMimeType: string | null;
};

/** Audited fields: everything but timestamps and storage internals. */
function auditView<T extends ProfileRow>(row: T) {
  const { updatedAt: _u, logoStorageKey, logoMimeType: _m, ...rest } = row;
  return { ...rest, hasLogo: logoStorageKey !== null };
}

export interface CompanyProfileData {
  legalName: string;
  tagline: string | null;
  address: string;
  gstin: string | null;
  stateCode: string;
  pan: string | null;
  email: string | null;
  phone: string | null;
}

/** The only place `PrismaService` is called for the Sales company profile. */
@Injectable()
export class CompanyProfileRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
  ) {}

  @OrgScoped()
  find(scope: OrgScope) {
    return this.prisma.salesCompanyProfile.findFirst({
      where: tenantWhere(scope, { deletedAt: null }),
      select: SELECT,
    });
  }

  /** Creates the profile on first save, else replaces it; the change and
   * its audit row commit together. */
  @OrgScoped()
  async upsert(scope: OrgScope, data: CompanyProfileData, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.salesCompanyProfile.findFirst({
        where: tenantWhere(scope, { deletedAt: null }),
        select: SELECT,
      });
      const row = existing
        ? await tx.salesCompanyProfile.update({
            where: { id: existing.id },
            data: { ...data, updatedBy: actorId },
            select: SELECT,
          })
        : await tx.salesCompanyProfile.create({
            data: {
              ...data,
              organizationId: scope.organizationId,
              createdBy: actorId,
              updatedBy: actorId,
            },
            select: SELECT,
          });
      const before = existing ? auditView(existing) : null;
      const after = auditView(row);
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: row.id,
        action: existing ? "update" : "create",
        ...(before ? { before } : {}),
        after,
      });
      return row;
    });
  }

  /** Points the profile at a newly stored logo (null = remove it). Returns
   * the replaced key for the caller to delete, or undefined when there is no
   * profile. */
  @OrgScoped()
  async setLogo(
    scope: OrgScope,
    logo: { storageKey: string; mimeType: string } | null,
    actorId: number,
  ): Promise<string | null | undefined> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.salesCompanyProfile.findFirst({
        where: tenantWhere(scope, { deletedAt: null }),
        select: SELECT,
      });
      if (!existing) return undefined;
      await tx.salesCompanyProfile.update({
        where: { id: existing.id },
        data: {
          logoStorageKey: logo?.storageKey ?? null,
          logoMimeType: logo?.mimeType ?? null,
          updatedBy: actorId,
        },
      });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: existing.id,
        action: logo ? "set_logo" : "remove_logo",
        before: { hasLogo: existing.logoStorageKey !== null },
        after: { hasLogo: logo !== null },
      });
      return existing.logoStorageKey;
    });
  }
}
