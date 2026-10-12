import { expect, type Page } from "@playwright/test";

/**
 * Signs in as the seeded Super Admin (packages/database/prisma/seed.ts) and
 * waits for the post-login redirect, so a spec can start from an
 * authenticated dashboard. Run `pnpm --filter database seed` first.
 */
export async function signInAsAdmin(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Organization").fill("texawave-innovations");
  await page.getByLabel("Email").fill("admin@texawave.com");
  await page.getByLabel("Password").fill("ChangeMe123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/reference\/tags/);
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
