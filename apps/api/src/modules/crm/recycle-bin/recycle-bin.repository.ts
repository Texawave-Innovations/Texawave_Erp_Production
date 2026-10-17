import { Injectable } from "@nestjs/common";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import { userNamesByIds } from "../shared/actor-names.js";

/** Read-only helpers the Recycle Bin list needs to enrich its page of items
 * (deleter display names and cascade child counts). */
@Injectable()
export class RecycleBinRepository {
  constructor(private readonly prisma: PrismaService) {}

  @OrgScoped()
  async userNames(scope: OrgScope, ids: Iterable<number | null>) {
    return userNamesByIds(this.prisma, scope.organizationId, ids);
  }

  /** Records soft-deleted together with an Account (same `deletedAt`
   * instant — see AccountsRepository.softDelete / restoreDeleted): contacts,
   * deals (+ products), quotations, notes and the rolled-up meetings,
   * follow-ups, activities, tasks and documents. Keyed by account id. */
  @OrgScoped()
  async accountCascadeCounts(
    scope: OrgScope,
    accounts: { id: number; deletedAt: Date }[],
  ): Promise<Map<number, number>> {
    const out = new Map<number, number>();
    await Promise.all(
      accounts.map(async (a) => {
        const where = {
          accountId: a.id,
          organizationId: scope.organizationId,
          deletedAt: a.deletedAt,
        };
        const org = scope.organizationId;
        const [contactRows, dealRows] = await Promise.all([
          this.prisma.contact.findMany({ where, select: { id: true } }),
          this.prisma.opportunity.findMany({ where, select: { id: true } }),
        ]);
        const dealIds = dealRows.map((d) => d.id);
        const poly = {
          organizationId: org,
          deletedAt: a.deletedAt,
          OR: [
            { relatedType: "account", relatedId: a.id },
            {
              relatedType: "contact",
              relatedId: { in: contactRows.map((c) => c.id) },
            },
            { relatedType: "opportunity", relatedId: { in: dealIds } },
          ],
        };
        const [products, meetings, followUps, activities, tasks, docs] =
          await Promise.all([
            this.prisma.opportunityProduct.count({
              where: { opportunityId: { in: dealIds }, deletedAt: a.deletedAt },
            }),
            this.prisma.crmMeeting.count({ where: poly }),
            this.prisma.crmFollowUp.count({ where: poly }),
            this.prisma.crmActivity.count({ where: poly }),
            this.prisma.crmTask.count({ where: poly }),
            this.prisma.crmDocument.count({ where: poly }),
          ]);
        const [quotes, notes] = await Promise.all([
          this.prisma.quotation.count({ where }),
          this.prisma.crmNote.count({ where }),
        ]);
        out.set(
          a.id,
          contactRows.length +
            dealRows.length +
            quotes +
            notes +
            products +
            meetings +
            followUps +
            activities +
            tasks +
            docs,
        );
      }),
    );
    return out;
  }
}
