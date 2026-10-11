import { expect, test, type Page } from "@playwright/test";
import { signInAsAdmin, uniqueName } from "./helpers/auth";

/**
 * Access control (Admin → Roles): create a role, grant a scoped permission,
 * see the navigation follow, review and save, reserved scopes, unsaved-change
 * guard, and a user's effective access. Uses the seeded Super Admin against
 * the running dev API/UI. Tokens live in memory, so navigation is by clicks.
 */
async function openRoles(page: Page) {
  await signInAsAdmin(page);
  // Sidebar Settings → "Roles & Permissions" links to the legacy
  // /settings/roles path, which forwards to /admin/roles.
  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByRole("link", { name: "Roles & Permissions" }).click();
  await expect(page).toHaveURL(/\/admin\/roles$/);
  await expect(
    page.getByRole("heading", { name: "Access control" }),
  ).toBeVisible();
}

async function createRole(page: Page): Promise<string> {
  const name = uniqueName("PW role");
  await page.getByRole("button", { name: "New role" }).click();
  await page.getByLabel("Name").fill(name);
  await page.getByRole("button", { name: "Create role" }).click();
  await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
  return name;
}

test("creates a role, grants Team scope, reviews and saves", async ({
  page,
}) => {
  await openRoles(page);
  const name = await createRole(page);

  await page
    .getByRole("searchbox", { name: "Search permissions" })
    .fill("attendance records");
  const view = page.getByRole("radiogroup", { name: "Attendance: View" });
  await view.getByRole("radio", { name: "Team" }).click();
  await expect(view.getByRole("radio", { name: "Team" })).toHaveAttribute(
    "aria-checked",
    "true",
  );

  // The navigation panel edits the same draft.
  await page.getByRole("tab", { name: "Navigation" }).click();
  await expect(
    page.getByRole("region", { name: "Unsaved changes" }),
  ).toContainText("1 unsaved change");

  await page.getByRole("button", { name: "Review & save" }).click();
  const review = page.getByRole("dialog", { name: `Review changes — ${name}` });
  await expect(
    review.getByRole("table", { name: "Permission changes" }),
  ).toContainText("Team scope");
  await review.getByRole("button", { name: "Save 1 change" }).click();
  await expect(page.getByText(`Saved “${name}”`)).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Unsaved changes" }),
  ).toHaveCount(0);

  await page.getByRole("tab", { name: "Permissions" }).click();
  await page
    .getByRole("searchbox", { name: "Search permissions" })
    .fill("attendance records");
  await expect(
    page
      .getByRole("radiogroup", { name: "Attendance: View" })
      .getByRole("radio", { name: "Team" }),
  ).toHaveAttribute("aria-checked", "true");
});

test("a reserved Own scope cannot be chosen", async ({ page }) => {
  await openRoles(page);
  await createRole(page);
  await page
    .getByRole("searchbox", { name: "Search permissions" })
    .fill("manually edit attendance");
  await expect(
    page
      .getByRole("radiogroup", { name: "Attendance: Edit" })
      .getByRole("radio", { name: "Own" }),
  ).toBeDisabled();
});

test("switching roles with unsaved changes asks first, and discard clears them", async ({
  page,
}) => {
  await openRoles(page);
  await createRole(page);
  await page
    .getByRole("searchbox", { name: "Search permissions" })
    .fill("holiday calendar");
  await page.getByRole("switch", { name: "Holidays: View" }).click();
  await expect(
    page.getByRole("region", { name: "Unsaved changes" }),
  ).toBeVisible();

  await page
    .getByRole("navigation", { name: "Roles" })
    .getByRole("button")
    .filter({ hasText: "Super Admin" })
    .click();
  const confirm = page.getByRole("dialog", {
    name: "Discard unsaved changes?",
  });
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "Keep editing" }).click();

  await page.getByRole("button", { name: "Discard" }).click();
  await expect(
    page.getByRole("region", { name: "Unsaved changes" }),
  ).toHaveCount(0);
});

test("who has access shows a user's effective permissions and their source", async ({
  page,
}) => {
  await openRoles(page);
  await page.getByRole("tab", { name: "Who has access" }).click();
  const user = page.getByRole("combobox", { name: "User" });
  await user.selectOption({
    label: await user
      .locator("option", { hasText: "admin@texawave.com" })
      .innerText(),
  });
  await expect(
    page.getByRole("table", { name: /Administration — effective permissions/ }),
  ).toContainText("Super Admin");
});

test("the menu's legacy /settings/roles link lands on /admin/roles", async ({
  page,
}) => {
  await openRoles(page);
});

test("clone copies a role, and its history records the changes", async ({
  page,
}) => {
  await openRoles(page);
  const name = await createRole(page);

  await page
    .getByRole("searchbox", { name: "Search permissions" })
    .fill("holiday calendar");
  await page.getByRole("switch", { name: "Holidays: View" }).click();
  await page.getByRole("button", { name: "Review & save" }).click();
  await page
    .getByRole("dialog", { name: `Review changes — ${name}` })
    .getByRole("button", { name: "Save 1 change" })
    .click();
  await expect(page.getByText(`Saved “${name}”`)).toBeVisible();

  await page.getByRole("tab", { name: "History" }).click();
  await expect(page.getByText("Changed permissions")).toBeVisible();
  await expect(page.getByText(/Granted: Holidays · View/)).toBeVisible();
  await expect(page.getByText("Created the role")).toBeVisible();

  await page.getByRole("button", { name: "Clone" }).click();
  const dialog = page.getByRole("dialog", { name: `Clone role — ${name}` });
  await dialog.getByLabel("Role name").fill(`${name} copy`);
  await dialog.getByRole("button", { name: "Create copy" }).click();
  await expect(
    page.getByRole("heading", { level: 2, name: `${name} copy` }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Permissions" }).click();
  await page.getByRole("checkbox", { name: "Show granted only" }).check();
  await expect(
    page.getByRole("switch", { name: "Holidays: View" }),
  ).toHaveAttribute("aria-checked", "true");
});

test("a system role's name and status are locked in Edit details", async ({
  page,
}) => {
  await openRoles(page);
  await page
    .getByRole("navigation", { name: "Roles" })
    .getByRole("button")
    .filter({ hasText: "Super Admin" })
    .click();
  await expect(page.getByText("System role", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Edit details" }).click();
  const dialog = page.getByRole("dialog", { name: "Edit role — Super Admin" });
  await expect(dialog.getByLabel("Role name")).toBeDisabled();
  await expect(dialog.getByRole("checkbox")).toBeDisabled();
  await dialog.getByRole("button", { name: "Cancel" }).click();
});
