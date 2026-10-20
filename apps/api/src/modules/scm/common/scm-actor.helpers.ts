import type { Prisma } from "@texawave-erp/database";

/** Display name of the acting user, stored on documents next to the user id
 * so a later rename or deactivation never rewrites history. */
export async function actorName(
  tx: Prisma.TransactionClient,
  organizationId: number,
  userId: number,
): Promise<string> {
  const user = await tx.user.findFirst({
    where: { id: userId, organizationId },
    select: { fullName: true },
  });
  return user?.fullName ?? `User ${userId}`;
}

export const toDate = (value: string | undefined | null): Date | null =>
  value ? new Date(value) : null;
