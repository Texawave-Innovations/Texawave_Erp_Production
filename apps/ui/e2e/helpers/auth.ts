import { expect, type Page } from "@playwright/test";

/**
 * Signs in as the seeded Super Admin (packages/database/prisma/seed.ts) and
 * waits for the post-login redirect, so a spec can start from an
 * authenticated dashboard. Run `pnpm --filter database seed` first.
 */
export async function signInAsAdmin(page: Page): Promise<void> {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Organization").fill("texawave-innovations");
  await page.getByLabel("Email").fill("admin@texawave.com");
  // The field has a "Show password" toggle, so the label alone matches two
  // elements; target the textbox itself.
  await page.locator("#password").fill("ChangeMe123!");
  await page.locator("button[type='submit']").click();
  // The landing page depends on the user's menu (features/auth/landing.ts),
  // so wait for leaving /login rather than for one fixed URL.
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });
}

/** A name unique per run, so reruns against the same dev DB never collide. */
export function uniqueName(prefix: string): string {
  return `${prefix} ${Date.now()}`;
}

/** The seeded Super Admin's user id, read from the real API — for fixtures
 * that must name the signed-in user (e.g. as a record's creator, to check
 * maker-checker buttons are hidden from them). */
export async function adminUserId(page: Page): Promise<number> {
  const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
  const login = await page.request.post(`${api}/auth/login`, {
    data: {
      organizationSlug: "texawave-innovations",
      email: "admin@texawave.com",
      password: "ChangeMe123!",
    },
  });
  const token = ((await login.json()) as { data: { accessToken: string } }).data
    .accessToken;
  const me = await page.request.get(`${api}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return ((await me.json()) as { data: { userId: number } }).data.userId;
}
