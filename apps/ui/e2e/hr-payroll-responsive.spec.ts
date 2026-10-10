import { expect, type Page, type Route, test } from "@playwright/test";
import { signInAsAdmin } from "./helpers/auth";

/**
 * Phone-width coverage for HR → Payroll and HR → Compliance: every tab
 * renders at 375px without widening the page (wide tables scroll inside
 * their own wrapper), filters stack full-width, and the tab bar stays
 * keyboard-operable.
 *
 * Signs in for real, then serves the payroll/compliance list endpoints from
 * empty fixtures — layout, not data, is under test here.
 */

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

test.use({ viewport: { width: 375, height: 812 } });

const empty = {
  data: [],
  meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
};

async function mockEmpty(page: Page) {
  for (const path of [
    "/hr/payroll/**",
    "/hr/payslips**",
    "/hr/payment-batches**",
    "/hr/bonuses**",
    "/hr/loans**",
    "/hr/compliance/**",
    "/self-service/**",
  ]) {
    await page.route(`${API}${path}`, (route: Route) =>
      route.fulfill({ status: 200, json: empty }),
    );
  }
}

/** True when the page itself scrolls sideways — the thing to avoid. */
const pageOverflows = (page: Page) =>
  page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );

async function openFromSidebar(page: Page, name: string) {
  // At phone width the sidebar may be collapsed behind a menu button.
  const link = page.getByRole("link", { name, exact: true });
  if (!(await link.isVisible())) {
    await page
      .getByRole("button", { name: /menu|sidebar|navigation/i })
      .first()
      .click();
  }
  await link.click();
}

test("every payroll tab fits a phone screen", async ({ page }) => {
  await mockEmpty(page);
  await signInAsAdmin(page);
  await openFromSidebar(page, "Payroll");
  await expect(
    page.getByRole("heading", { name: "Payroll", level: 1 }),
  ).toBeVisible();

  const tabs = page.getByRole("tablist", { name: "Payroll sections" });
  const names = await tabs.getByRole("tab").allTextContents();
  expect(names.length).toBeGreaterThan(1);
  for (const name of names) {
    await tabs.getByRole("tab", { name }).click();
    await expect(tabs.getByRole("tab", { name })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByRole("tabpanel")).toBeVisible();
    expect(await pageOverflows(page), `${name} tab overflows`).toBe(false);
  }

  // Filters stack full-width instead of squeezing side by side.
  await tabs.getByRole("tab", { name: "Bonuses" }).click();
  const status = await page.getByLabel("Filter by bonus status").boundingBox();
  const period = await page
    .getByLabel("Filter by payroll period")
    .boundingBox();
  expect(status && period && period.y > status.y).toBe(true);
});

test("both compliance tabs fit a phone screen", async ({ page }) => {
  await mockEmpty(page);
  await signInAsAdmin(page);
  await openFromSidebar(page, "Compliance");
  await expect(
    page.getByRole("heading", { name: "PF registration" }),
  ).toBeVisible();
  expect(await pageOverflows(page)).toBe(false);

  // Keyboard: arrow keys move between tabs.
  await page.getByRole("tab", { name: "PF" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "ESI" })).toBeFocused();
  await expect(
    page.getByRole("heading", { name: "ESI registration" }),
  ).toBeVisible();
  expect(await pageOverflows(page)).toBe(false);
});
