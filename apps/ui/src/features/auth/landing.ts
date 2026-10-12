import { getMyEmployee } from "@/features/onboarding/api";

/**
 * Where a freshly signed-in user should land. A user with an employee record
 * that has not finished onboarding goes to the onboarding wizard; a
 * completed employee lands inside the dashboard shell (/self-service) so
 * the sidebar's self-service navigation is actually reachable, rather than
 * the old standalone /portal page, which had no navigation at all. Everyone
 * else (including accounts with no self-service access at all — most roles
 * in this app, by design, never hold employee_self_service.* permissions;
 * see Docs/CODING_STANDARDS.md §10a) goes to the admin area. Any lookup
 * failure falls back to the admin area, which has its own guards.
 */
export async function landingPathAfterLogin(): Promise<string> {
  try {
    const employee = await getMyEmployee();
    return employee.onboardingStatus === "COMPLETE"
      ? "/self-service"
      : "/onboarding";
  } catch {
    return "/reference/tags";
  }
}
