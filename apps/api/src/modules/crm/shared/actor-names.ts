import type { Prisma } from "@texawave-erp/database";

type Db = Prisma.TransactionClient;

/** Display-name fields added (additively) to CRM rows that carry user-id
 * audit columns. Resolved server-side from `users.full_name`, scoped to the
 * caller's organization, so the UI never has to show a bare user id. */
export interface ActorNames {
  createdByName: string | null;
  updatedByName: string | null;
  uploadedByName: string | null;
}

interface ActorColumns {
  createdBy?: number | null | undefined;
  updatedBy?: number | null | undefined;
  uploadedBy?: number | null | undefined;
}

/** id -> full name for the given user ids in one organization. */
export async function userNamesByIds(
  db: Db,
  organizationId: number,
  ids: Iterable<number | null | undefined>,
): Promise<Map<number, string>> {
  const unique = [
    ...new Set([...ids].filter((v): v is number => typeof v === "number")),
  ];
  if (unique.length === 0) return new Map();
  const users = await db.user.findMany({
    where: { organizationId, id: { in: unique } },
    select: { id: true, fullName: true },
  });
  return new Map(users.map((u) => [u.id, u.fullName]));
}

/** Returns the rows with `createdByName` / `updatedByName` /
 * `uploadedByName` added (null when the column is empty or the user is gone). */
export async function attachActorNames<T extends ActorColumns>(
  db: Db,
  organizationId: number,
  rows: T[],
): Promise<Array<T & ActorNames>> {
  const names = await userNamesByIds(
    db,
    organizationId,
    rows.flatMap((r) => [r.createdBy, r.updatedBy, r.uploadedBy]),
  );
  const nameOf = (id: number | null | undefined) =>
    typeof id === "number" ? (names.get(id) ?? null) : null;
  return rows.map((r) => ({
    ...r,
    createdByName: nameOf(r.createdBy),
    updatedByName: nameOf(r.updatedBy),
    uploadedByName: nameOf(r.uploadedBy),
  }));
}
