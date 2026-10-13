import { expect, test } from "@playwright/test";
import { signInAsAdmin } from "./helpers/auth";

/**
 * Focused tests for Phase 2 promoted UI-Kit interaction components:
 * 1. ActionMenu (accessible trigger, open/close, callback firing, Escape/click-outside dismiss)
 * 2. ConfirmDialog / DeleteConfirmDialog (accessible title, item description, Cancel/Confirm actions)
 * 3. FilterChip / FilterChips (render active filter chips, accessible removal, Clear all action)
 */

test.describe("Global UI Kit Phase 2 — Interaction Components", () => {
  test("ActionMenu renders accessible trigger, opens menu on click, and closes on Escape", async ({
    page,
  }) => {
    await signInAsAdmin(page);

    // Navigate to /admin/users which consumes ActionMenu on each row
    await page
      .getByRole("navigation")
      .locator("a[href='/admin/users']")
      .click();
    await expect(page).toHaveURL(/\/admin\/users$/);
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();

    // Find the first user's ActionMenu trigger button
    const firstRow = page.locator("tbody tr").first();
    await expect(firstRow).toBeVisible();

    const actionMenuButton = firstRow.getByRole("button", {
      name: /^Actions for /,
    });
    await expect(actionMenuButton).toBeVisible();
    await expect(actionMenuButton).toHaveAttribute("aria-haspopup", "menu");
    await expect(actionMenuButton).toHaveAttribute("aria-expanded", "false");

    // Click to open menu
    await actionMenuButton.click();
    await expect(actionMenuButton).toHaveAttribute("aria-expanded", "true");

    const menu = page.locator("div[role='menu']");
    await expect(menu).toBeVisible();

    // Verify menu items
    const editItem = menu.getByRole("menuitem", { name: "Edit user" });
    const deleteItem = menu.getByRole("menuitem", { name: "Delete user" });
    await expect(editItem).toBeVisible();
    await expect(deleteItem).toBeVisible();

    // Verify destructive styling on delete item
    await expect(deleteItem).toHaveClass(/text-error/);

    // Test Escape key dismissal
    await page.keyboard.press("Escape");
    await expect(menu).not.toBeVisible();
    await expect(actionMenuButton).toHaveAttribute("aria-expanded", "false");

    // Test click-outside dismissal
    await actionMenuButton.click();
    await expect(menu).toBeVisible();
    await page.getByRole("heading", { name: "Users" }).click();
    await expect(menu).not.toBeVisible();
  });

  test("ActionMenu executes action callback and opens ConfirmDialog", async ({
    page,
  }) => {
    await signInAsAdmin(page);
    await page
      .getByRole("navigation")
      .locator("a[href='/admin/users']")
      .click();
    await expect(page).toHaveURL(/\/admin\/users$/);

    const firstRow = page.locator("tbody tr").first();
    const actionMenuButton = firstRow.getByRole("button", {
      name: /^Actions for /,
    });

    // Open ActionMenu and click Delete user
    await actionMenuButton.click();
    const menu = page.locator("div[role='menu']");
    await menu.getByRole("menuitem", { name: "Delete user" }).click();

    // Menu should close on action click
    await expect(menu).not.toBeVisible();

    // ConfirmDialog (DeleteConfirmDialog) should open
    const dialog = page.locator("dialog[open]");
    await expect(dialog).toBeVisible();

    // Verify accessible title and description
    await expect(
      dialog.getByRole("heading", { name: "Delete User" }),
    ).toBeVisible();
    await expect(
      dialog.getByText("Are you sure you want to delete"),
    ).toBeVisible();
    await expect(
      dialog.getByText("This action cannot be undone."),
    ).toBeVisible();

    // Verify Cancel button dismisses dialog without confirming
    const cancelButton = dialog.getByRole("button", { name: "Cancel" });
    const confirmButton = dialog.getByRole("button", { name: "Delete" });
    await expect(cancelButton).toBeVisible();
    await expect(confirmButton).toBeVisible();
    await expect(confirmButton).toHaveClass(/bg-error/);

    await cancelButton.click();
    await expect(dialog).not.toBeVisible();
  });

  test("FilterChips renders active tokens, supports accessible single removal and Clear-all", async ({
    page,
  }) => {
    await signInAsAdmin(page);

    // Navigate to /hr/employees which consumes FilterChips
    await page
      .getByRole("navigation")
      .locator("a[href='/hr/employees']")
      .click();
    await expect(page).toHaveURL(/\/hr\/employees$/);
    await expect(
      page.getByRole("heading", { name: "Employees" }),
    ).toBeVisible();

    // Search input to activate search filter chip
    const searchInput = page.getByRole("searchbox", {
      name: "Search employees",
    });
    await searchInput.fill("Engineering");

    // Wait for active filter chips container to appear
    const filterChipsContainer = page
      .locator(".pt-2\\.5")
      .filter({ hasText: "Active filters:" });
    await expect(filterChipsContainer).toBeVisible();

    // Verify FilterChip token rendering (Search: Engineering)
    const chip = filterChipsContainer.locator("span", {
      hasText: "Search:Engineering",
    });
    await expect(chip).toBeVisible();

    // Verify accessible removal button
    const removeButton = chip.getByRole("button", {
      name: "Remove filter for Search: Engineering",
    });
    await expect(removeButton).toBeVisible();

    // Verify Clear all button exists
    const clearAllButton = filterChipsContainer.getByRole("button", {
      name: "Clear all",
    });
    await expect(clearAllButton).toBeVisible();

    // Click individual removal button
    await removeButton.click();

    // Filter chip should be dismissed and search box cleared
    await expect(chip).not.toBeVisible();
    await expect(searchInput).toHaveValue("");
    await expect(filterChipsContainer).not.toBeVisible();

    // Now test Clear all button by typing again
    await searchInput.fill("Operations");
    await expect(filterChipsContainer).toBeVisible();
    await clearAllButton.click();

    await expect(filterChipsContainer).not.toBeVisible();
    await expect(searchInput).toHaveValue("");
  });
});
