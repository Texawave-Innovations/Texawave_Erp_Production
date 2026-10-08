import { getMyEmployee } from "@/features/onboarding/api";

/**
 * Where a freshly signed-in user should land. A user with an employee record
 * that has not finished onboarding goes to the onboarding wizard; everyone
 * else (including accounts with no employee record) goes to the admin area.
 * Any lookup failure falls back to the admin area, which has its own guards.
 */
export async function landingPathAfterLogin(): Promise<string> {
  try {
    const employee = await getMyEmployee();
    return employee.onboardingStatus === "COMPLETE" ? "/portal" : "/onboarding";
  } catch {
    return "/hr";
  }
}
