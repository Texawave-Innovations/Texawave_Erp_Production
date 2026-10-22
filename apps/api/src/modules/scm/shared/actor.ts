import type { User } from "@/types";

/** Display name recorded as `createdBy`/`performedBy` on SCM documents and audit entries. */
export function actorName(
  user: Pick<User, "name" | "username"> | null | undefined,
  fallback = "Unknown",
): string {
  return user?.name || user?.username || fallback;
}
