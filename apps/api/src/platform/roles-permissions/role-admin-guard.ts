import { HttpStatus } from "@nestjs/common";
import type { Prisma } from "@texawave-erp/database";
import { BusinessException } from "../../common/exceptions/business.exception.js";

/** The permission that manages roles; the lock-out guard keeps it alive. */
export const ROLE_ADMIN_PERMISSION = "settings.role.write";

/** A change that would leave nobody — or the caller — able to manage roles
 * (409). Prevents an organization locking itself out of access control. */
export class AccessLockoutException extends BusinessException {
  constructor(reason: "nobody" | "self") {
    super(
      reason === "nobody"
        ? "This change would leave nobody able to manage roles. Keep “Manage roles” on at least one active user."
        : "This change would remove “Manage roles” from you. Ask another administrator to make it.",
      HttpStatus.CONFLICT,
      "ACCESS_LOCKOUT",
    );
  }
}

/** Active, non-deleted users who hold “Manage roles” through an active role
 * and an active grant — the same rule permission resolution applies. */
export async function roleAdminIds(
  tx: Prisma.TransactionClient,
  organizationId: number,
): Promise<Set<number>> {
  const rows = await tx.user.findMany({
    where: {
      organizationId,
      isActive: true,
      deletedAt: null,
      userRoles: {
        some: {
          isActive: true,
          role: {
            organizationId,
            isActive: true,
            rolePermissions: {
              some: {
                isActive: true,
                permission: { code: ROLE_ADMIN_PERMISSION, isActive: true },
              },
            },
          },
        },
      },
    },
    select: { id: true },
  });
  return new Set(rows.map((r) => r.id));
}

/**
 * Runs `change` inside the caller's transaction and refuses it (rolling the
 * whole transaction back) if afterwards nobody can manage roles, or if the
 * caller could before and no longer can. Used by every write that can take
 * the permission away: role grants, role status, user roles, user status and
 * user deletion (Docs/ARCHITECTURE.md §11, 2026-10-12).
 */
export async function withRoleAdminGuard<T>(
  tx: Prisma.TransactionClient,
  organizationId: number,
  callerId: number,
  change: () => Promise<T>,
): Promise<T> {
  const before = await roleAdminIds(tx, organizationId);
  const result = await change();
  const after = await roleAdminIds(tx, organizationId);
  if (before.size > 0 && after.size === 0)
    throw new AccessLockoutException("nobody");
  if (before.has(callerId) && !after.has(callerId))
    throw new AccessLockoutException("self");
  return result;
}
