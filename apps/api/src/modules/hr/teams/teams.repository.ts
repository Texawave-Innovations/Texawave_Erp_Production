import { Injectable } from "@nestjs/common";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../../common/tenancy/tenant-where.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";

@Injectable()
export class TeamsRepository {
  constructor(private readonly prisma: PrismaService) {}

  @OrgScoped()
  findActive(scope: OrgScope) {
    return this.prisma.team.findMany({
      where: tenantWhere(scope, { isActive: true, deletedAt: null }),
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    });
  }
}
