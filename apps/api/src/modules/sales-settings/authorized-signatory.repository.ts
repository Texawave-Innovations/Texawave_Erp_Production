import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../common/decorators/org-scoped.decorator.js";
import type { OrgScope } from "../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../common/tenancy/tenant-where.js";
import { PrismaService } from "../../shared/prisma/prisma.service.js";
import type { UpsertAuthorizedSignatoryDto } from "./dto/upsert-authorized-signatory.dto.js";

/** One row per organization — the Bank & Signatory tab shows a single
 * Name/Designation form, not a list (contrast `SalespersonsRepository`). */
@Injectable()
export class AuthorizedSignatoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  @OrgScoped()
  findOne(scope: OrgScope) {
    return this.prisma.authorizedSignatory.findFirst({
      where: tenantWhere(scope, {}),
    });
  }

  @OrgScoped()
  async upsert(scope: OrgScope, dto: UpsertAuthorizedSignatoryDto) {
    const existing = await this.findOne(scope);
    const data = {
      ...dto,
      customFields: (dto.customFields ?? {}) as Prisma.InputJsonValue,
    };
    if (!existing) {
      return this.prisma.authorizedSignatory.create({
        data: { ...data, organizationId: scope.organizationId },
      });
    }
    return this.prisma.authorizedSignatory.update({
      where: { id: existing.id },
      data,
    });
  }
}
