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

// ---- Periods & runs ---------------------------------------------------------

async function openPayroll(page: import("@playwright/test").Page) {
  await signInAsAdmin(page);
  await page.getByRole("link", { name: "Payroll", exact: true }).click();
  await expect(
    page.getByRole("tab", { name: "Periods & runs" }),
  ).toHaveAttribute("aria-selected", "true");
}

test("creating a period with an end date before its start is blocked client-side", async ({
  page,
}) => {
  await openPayroll(page);
  let posted = false;
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().endsWith("/hr/payroll/periods"))
      posted = true;
  });

  await page.getByRole("button", { name: "New period" }).click();
  const dialog = page.getByRole("dialog", { name: "New payroll period" });
  await dialog.getByLabel("Start date").fill("2099-06-30");
  await dialog.getByLabel("End date").fill("2099-06-01");
  await dialog.getByRole("button", { name: "Create period" }).click();

  await expect(
    dialog.getByText("End date cannot be before start date"),
  ).toBeVisible();
  expect(posted).toBe(false);
});

test("creates a period, opens it, runs payroll and cancels it", async ({
  page,
}) => {
  await openPayroll(page);

  // A far-future year/month nobody uses, unique per run, so reruns against
  // the same dev DB don't hit the "period already exists" conflict.
  const stamp = Date.now();
  const year = 2050 + (Math.floor(stamp / 12) % 50);
  const month = (stamp % 12) + 1;
  const monthName = new Date(Date.UTC(2000, month - 1, 1)).toLocaleString(
    "en-US",
    { month: "long", timeZone: "UTC" },
  );
  const label = `${monthName} ${year}`;

  await page.getByRole("button", { name: "New period" }).click();
  const dialog = page.getByRole("dialog", { name: "New payroll period" });
  await dialog.getByLabel("Year").fill(String(year));
  await dialog.getByLabel("Month").selectOption(String(month));
  await dialog.getByRole("button", { name: "Create period" }).click();
  await expect(page.getByText(`Payroll period ${label} created`)).toBeVisible();

  // The new period is listed and opened for management.
  await expect(
    page.getByRole("table", { name: "Payroll periods" }).getByText(label),
  ).toBeVisible();
  const detail = page.getByRole("region", { name: label });
  await expect(detail).toBeVisible();
  await expect(detail.getByText("No runs yet")).toBeVisible();

  // Running payroll either processes a run or explains why it can't
  // (no salaries / no eligible employees in this dev DB) — both are handled.
  await detail.getByRole("button", { name: "Run payroll" }).click();
  const runDialog = page.getByRole("dialog", { name: "Run payroll" });
  await runDialog.getByRole("button", { name: "Run payroll" }).click();
  await expect(
    page.getByText(/^Run #\d+ processed$/).or(runDialog.getByRole("alert")),
  ).toBeVisible();
  if (await runDialog.isVisible()) {
    await runDialog.getByRole("button", { name: "Cancel" }).click();
  } else {
    // A processed run is listed; its creator is not offered as approver
    // only by the server (maker-checker), so the button may show.
    await expect(
      detail.getByRole("table", { name: "Payroll runs" }),
    ).toBeVisible();
  }

  // Clean up: cancel the period.
  await detail.getByRole("button", { name: "Cancel period" }).click();
  const confirm = page.getByRole("dialog", { name: "Cancel period" });
  await confirm.getByRole("button", { name: "Cancel period" }).click();
  await expect(page.getByText(`${label} cancelled`)).toBeVisible();
  await expect(detail.getByText("Cancelled", { exact: true })).toBeVisible();
});
