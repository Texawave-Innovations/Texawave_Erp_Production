import { Injectable } from "@nestjs/common";
import { OrgScoped } from "../../common/decorators/org-scoped.decorator.js";
import type { OrgScope } from "../../common/tenancy/org-scope.js";
import { PrismaService } from "../../shared/prisma/prisma.service.js";

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Login-time lookup: `scope` here comes from resolving the org by slug
   * (platform/auth), not from an authenticated request — there is no
   * session yet. Still explicit, still typed, still the only way in. */
  @OrgScoped()
  findByEmail(scope: OrgScope, email: string) {
    return this.prisma.user.findFirst({
      where: { organizationId: scope.organizationId, email, deletedAt: null },
    });
  }

  @OrgScoped()
  findById(scope: OrgScope, userId: string) {
    return this.prisma.user.findFirst({
      where: {
        id: userId,
        organizationId: scope.organizationId,
        deletedAt: null,
      },
    });
  }
}
