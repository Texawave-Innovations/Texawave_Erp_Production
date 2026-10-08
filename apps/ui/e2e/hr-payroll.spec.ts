import { expect, test } from "@playwright/test";
import { signInAsAdmin } from "./helpers/auth";

/**
 * Real-browser coverage for HR → Payroll and HR → Compliance: both are
 * reachable from the sidebar, and their tab bars switch panels by mouse and
 * keyboard. Uses the seeded Super Admin (every permission, so every tab) —
 * run `pnpm --filter database seed` first so the menu rows exist.
 */

test("Payroll is reachable from the sidebar and its tabs switch panels", async ({
  page,
}) => {
  await signInAsAdmin(page);
  // Client-side link, not page.goto: a hard navigation drops the in-memory
  // auth store (Docs/CODING_STANDARDS.md §13).
  await page.getByRole("link", { name: "Payroll", exact: true }).click();
  await expect(page).toHaveURL(/\/hr\/payroll$/);
  await expect(
    page.getByRole("heading", { name: "Payroll", level: 1 }),
  ).toBeVisible();

  const tablist = page.getByRole("tablist", { name: "Payroll sections" });
  for (const name of [
    "Periods & runs",
    "Salaries",
    "Bonuses",
    "Loans",
    "Payslips",
    "Payments",
  ]) {
    await expect(tablist.getByRole("tab", { name })).toBeVisible();
  }
  await expect(
    tablist.getByRole("tab", { name: "Periods & runs" }),
  ).toHaveAttribute("aria-selected", "true");

  await tablist.getByRole("tab", { name: "Payslips" }).click();
  await expect(tablist.getByRole("tab", { name: "Payslips" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByRole("tabpanel", { name: "Payslips" })).toBeVisible();

  // Keyboard: ArrowRight moves to (and selects) the next tab; Home wraps back.
  await page.keyboard.press("ArrowRight");
  await expect(tablist.getByRole("tab", { name: "Payments" })).toBeFocused();
  await expect(tablist.getByRole("tab", { name: "Payments" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.keyboard.press("Home");
  await expect(
    tablist.getByRole("tab", { name: "Periods & runs" }),
  ).toHaveAttribute("aria-selected", "true");
});

test("Compliance is reachable from the sidebar with PF and ESI tabs", async ({
  page,
}) => {
  await signInAsAdmin(page);
  await page.getByRole("link", { name: "Compliance", exact: true }).click();
  await expect(page).toHaveURL(/\/hr\/compliance$/);
  await expect(
    page.getByRole("heading", { name: "Compliance", level: 1 }),
  ).toBeVisible();

  const tablist = page.getByRole("tablist", { name: "Compliance sections" });
  await expect(tablist.getByRole("tab", { name: "PF" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await tablist.getByRole("tab", { name: "ESI" }).click();
  await expect(page.getByRole("tabpanel", { name: "ESI" })).toBeVisible();
});
