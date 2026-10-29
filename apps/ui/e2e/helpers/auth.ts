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

/** The SCM shell (features/scm/shell/ScmOnboardingTour.tsx) shows a one-time
 * product tour on first visit, tracked in localStorage per user id — every
 * Playwright run gets a fresh browser context, so it appears every time and
 * its modal intercepts clicks on the page behind it. It only ever auto-opens
 * once per `Page` instance (a React ref guards it), so this only needs to
 * check once per page — a WeakSet tracks that, letting the one real check use
 * a safely generous timeout without every later navigation paying for it
 * (the SCM nav flyout underneath auto-closes if left idle too long). */
const tourChecked = new WeakSet<Page>();
async function dismissScmTourIfOpen(page: Page): Promise<void> {
  if (tourChecked.has(page)) return;
  tourChecked.add(page);
  await page
    .getByRole("button", { name: "Close tour" })
    .click({ timeout: 2_000 })
    .catch(() => {});
}

/** Opens an SCM category's screen from the top nav — shared by every live
 * SCM spec. Clicking "SCM" navigates to /scm/overview, which auto-opens the
 * one-time product tour on a fresh browser context; the wait to check for
 * and dismiss it is enough idle time for the category flyout underneath to
 * auto-close, so this re-opens it if that happened rather than assuming it's
 * still there. */
export async function openScmCategory(
  page: Page,
  category: string,
  link: string,
): Promise<void> {
  const scmButton = page.getByRole("button", { name: "SCM", exact: true });
  const menu = page.getByRole("menu", { name: "SCM categories" });
  await scmButton.click();
  await dismissScmTourIfOpen(page);
  if (!(await menu.isVisible().catch(() => false))) {
    await scmButton.click();
  }
  await menu.getByRole("button", { name: category }).click();
  await page.getByRole("link", { name: link, exact: true }).first().click();
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
