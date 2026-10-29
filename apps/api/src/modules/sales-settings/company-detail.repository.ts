import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../common/decorators/org-scoped.decorator.js";
import type { OrgScope } from "../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../common/tenancy/tenant-where.js";
import { PrismaService } from "../../shared/prisma/prisma.service.js";
import type { UpsertCompanyDetailDto } from "./dto/upsert-company-detail.dto.js";

/** One row per organization. The only place `PrismaService` is called for
 * this resource (Docs/CODING_STANDARDS.md §3). */
@Injectable()
export class CompanyDetailRepository {
  constructor(private readonly prisma: PrismaService) {}

  @OrgScoped()
  findOne(scope: OrgScope) {
    return this.prisma.companyDetail.findFirst({
      where: tenantWhere(scope, {}),
    });
  }

  /** Create-or-replace: there is exactly one row per org (Company tab has no
   * list UI), so a save always upserts rather than requiring the caller to
   * know whether the row exists yet. */
  @OrgScoped()
  async upsert(scope: OrgScope, dto: UpsertCompanyDetailDto) {
    const existing = await this.findOne(scope);
    const data = {
      ...dto,
      customFields: (dto.customFields ?? {}) as Prisma.InputJsonValue,
    };
    if (!existing) {
      return this.prisma.companyDetail.create({
        data: { ...data, organizationId: scope.organizationId },
      });
    }
    return this.prisma.companyDetail.update({
      where: { id: existing.id },
      data,
    });
  }
}
