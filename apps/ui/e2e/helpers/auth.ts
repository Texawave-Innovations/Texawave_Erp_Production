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
