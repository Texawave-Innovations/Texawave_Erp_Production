import type { MeUser } from "@texawave-erp/api-types";
import { ApiError } from "@texawave-erp/core";
import { getMyEmployee } from "@/features/onboarding/api";
import { apiClient } from "@/lib/api-client";

/** Grants the HR workspace (dashboard) shell — see Docs/MENU_NAVIGATION_API.md §5.1. */
export const HR_WORKSPACE_PERMISSION = "hr.workspace.access";

/**
 * Whether these permissions open the dashboard shell. Besides
 * `hr.workspace.access`, anyone who can edit roles always gets it: that is
 * where `hr.workspace.access` is granted (Settings → Roles → Menu access), so
 * an administrator whose role predates the permission can never be locked
 * into the portal with no way to grant it.
 */
export function hasWorkspaceAccess(permissions: readonly string[]): boolean {
  return (
    permissions.includes(HR_WORKSPACE_PERMISSION) ||
    permissions.includes("settings.role.write")
  );
}

/**
 * Where a freshly signed-in user should land.
 * - Holders of `hr.workspace.access` (HR staff) and role administrators go to
 *   the HR workspace (/hr) — see `hasWorkspaceAccess`.
 * - Accounts with no employee record at all (e.g. Super Admin) also go to /hr.
 * - Every other employee — including Team Leads, whatever hr.* team reads
 *   their role holds — goes to the portal (/portal), or to the onboarding
 *   wizard (/onboarding) until their profile is complete. Their team tabs
 *   (Task Assignment, Team Attendance, ...) are portal menu items.
 * - Any other lookup failure falls back to /portal, which has its own guards.
 */
export async function landingPathAfterLogin(): Promise<string> {
  try {
    const me = await apiClient.get<MeUser>("/auth/me").then((res) => res.data);
    if (hasWorkspaceAccess(me.permissions)) {
      return "/hr";
    }

    const employee = await getMyEmployee();
    return employee.onboardingStatus === "COMPLETE" ? "/portal" : "/onboarding";
  } catch (error) {
    if (error instanceof ApiError && error.errorCode === "NOT_AN_EMPLOYEE") {
      return "/hr";
    }
    return "/portal";
  }
}
