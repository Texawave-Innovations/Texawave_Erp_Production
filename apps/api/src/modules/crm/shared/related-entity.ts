import type { Prisma } from "@texawave-erp/database";
import { BusinessRuleViolationException } from "../../../common/exceptions/business.exception.js";

/**
 * Mirrors legacy's `CrmRelatedType` (domain/types.ts) exactly — the
 * polymorphic pair every Account-360 supporting entity (Meeting, FollowUp,
 * CrmActivity, CrmTask, CrmDocument) relates through. Prisma has no native
 * polymorphic relation, so `relatedId` carries no `@relation`/FK at the
 * schema level; this helper is the repository-layer substitute for that
 * referential-integrity check, same role as `OpportunitiesRepository`'s
 * explicit `accountId`/`contactId` existence checks.
 */
export const RELATED_TYPES = [
  "account",
  "contact",
  "opportunity",
  "lead",
] as const;
export type RelatedType = (typeof RELATED_TYPES)[number];

export async function assertRelatedEntityExists(
  tx: Prisma.TransactionClient,
  organizationId: number,
  relatedType: RelatedType,
  relatedId: number,
): Promise<void> {
  const row = await (() => {
    switch (relatedType) {
      case "account":
        return tx.account.findFirst({
          where: { id: relatedId, organizationId, deletedAt: null },
          select: { id: true },
        });
      case "contact":
        return tx.contact.findFirst({
          where: { id: relatedId, organizationId, deletedAt: null },
          select: { id: true },
        });
      case "opportunity":
        return tx.opportunity.findFirst({
          where: { id: relatedId, organizationId, deletedAt: null },
          select: { id: true },
        });
      case "lead":
        return tx.lead.findFirst({
          where: { id: relatedId, organizationId, deletedAt: null },
          select: { id: true },
        });
    }
  })();
  if (!row) {
    throw new BusinessRuleViolationException(
      `${relatedType} ${relatedId} does not exist in this organization`,
      "INVALID_RELATED_ENTITY",
    );
  }
}

/** Account roll-up (legacy `AccountDetail`'s `relevantIds`): an account's
 * related lists include records attached to the account itself, to any of
 * its live contacts and to any of its live opportunities. Returns a
 * `where` fragment valid for every polymorphic `relatedType`/`relatedId`
 * model (meetings, follow-ups, tasks, documents, activities). */
export async function accountRollupWhere(
  db: Prisma.TransactionClient,
  organizationId: number,
  accountId: number,
): Promise<{
  OR: Array<{
    relatedType: string;
    relatedId: number | { in: number[] };
  }>;
}> {
  const [contacts, opportunities] = await Promise.all([
    db.contact.findMany({
      where: { organizationId, accountId, deletedAt: null },
      select: { id: true },
    }),
    db.opportunity.findMany({
      where: { organizationId, accountId, deletedAt: null },
      select: { id: true },
    }),
  ]);
  return {
    OR: [
      { relatedType: "account", relatedId: accountId },
      { relatedType: "contact", relatedId: { in: contacts.map((c) => c.id) } },
      {
        relatedType: "opportunity",
        relatedId: { in: opportunities.map((o) => o.id) },
      },
    ],
  };
}
