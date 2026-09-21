import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../shared/prisma/prisma.service.js";

/**
 * `organizations` is the tenant root — it has no `organization_id` of its
 * own, so these lookups are deliberately NOT `@OrgScoped()`. Used only for
 * resolving which org a login/signup request is for; nothing else should
 * query this table directly.
 */
@Injectable()
export class OrganizationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findBySlug(slug: string) {
    return this.prisma.organization.findUnique({
      where: { slug, deletedAt: null },
    });
  }

  findById(id: number) {
    return this.prisma.organization.findUnique({
      where: { id, deletedAt: null },
    });
  }
}
