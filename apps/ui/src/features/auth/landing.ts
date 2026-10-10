import type { MeUser } from "@texawave-erp/api-types";
import { getMyEmployee } from "@/features/onboarding/api";
import { apiClient } from "@/lib/api-client";

/**
 * Where a freshly signed-in user should land.
 * - Users with administrative / staff permissions go directly to the ERP dashboard (/hr).
 * - Regular employees who haven't completed onboarding go to the onboarding wizard (/onboarding).
 * - Regular employees with completed onboarding go to the employee portal (/portal).
 * - Any lookup failure falls back to /hr, which has its own guards.
 */
export async function landingPathAfterLogin(): Promise<string> {
  try {
    const me = await apiClient.get<MeUser>("/auth/me").then((res) => res.data);
    const hasAdminAccess =
      me.permissions.length === 0 ||
      me.permissions.some((p) => !p.startsWith("employee_self_service."));
    if (hasAdminAccess) {
      return "/hr";
    }

    const employee = await getMyEmployee();
    return employee.onboardingStatus === "COMPLETE" ? "/portal" : "/onboarding";
  } catch {
    return "/hr";
  }
}
