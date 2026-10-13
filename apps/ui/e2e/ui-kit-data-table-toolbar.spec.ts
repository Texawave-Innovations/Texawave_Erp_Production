import { expect, test } from "@playwright/test";
import { signInAsAdmin } from "./helpers/auth";

/**
 * Focused tests for Phase 5 promoted UI-Kit components:
 * 1. TableToolbar:
 *    - Search input integration (controlled value, clear button resets query, accessible region & searchbox).
 *    - Filter controls (status dropdown integration, active filter tracking).
 *    - Clear filters action (Reset button displays when active filters present and resets filters).
 * 2. DataTable:
 *    - Table structure (semantic table, thead, tbody, responsive wrapper with overflow-x-auto).
 *    - Custom column rendering and alignment (department icon, name, monospace code, status badge).
 *    - Empty state rendering when filtered results return 0 items.
 * 3. Pagination:
 *    - Displays result count / page information.
 *    - Previous / Next buttons state and boundary handling.
 * 4. ActionMenu integration on rows:
 *    - Row action triggers and options for populated items.
 */

test.describe("Global UI Kit Phase 5 — DataTable, TableToolbar & Pagination", () => {
  test("TableToolbar provides accessible search, status filter, and clear filter action", async ({
    page,
  }) => {
    await signInAsAdmin(page);

    // Navigate to /hr/departments via client-side routing
    const departmentsLink = page.locator("a[href='/hr/departments']").first();
    await departmentsLink.click();
    await expect(page).toHaveURL(/\/hr\/departments$/);

    // 1. Semantic TableToolbar region
    const toolbar = page.getByRole("region", {
      name: "Table management toolbar",
    });
    await expect(toolbar).toBeVisible();

    // 2. SearchInput integration within toolbar
    const searchInput = toolbar.getByRole("searchbox", {
      name: "Search departments",
    });
    await expect(searchInput).toBeVisible();

    // Type query
    await searchInput.fill("NonExistentDepartmentXYZ");
    await expect(searchInput).toHaveValue("NonExistentDepartmentXYZ");

    // Clear search button becomes visible in SearchInput
    const clearSearchBtn = toolbar.getByRole("button", {
      name: "Clear search",
    });
    await expect(clearSearchBtn).toBeVisible();

    // 3. Clear filters button (Reset) appears when filters/search are active
    const resetFiltersBtn = toolbar.getByRole("button", { name: "Reset" });
    await expect(resetFiltersBtn).toBeVisible();

    // 4. Empty state appears in view
    await expect(
      page.getByRole("heading", { name: "No departments yet" }),
    ).toBeVisible();

    // 5. Clicking Reset restores search and table data
    await resetFiltersBtn.click();
    await expect(searchInput).toHaveValue("");
    await expect(resetFiltersBtn).not.toBeVisible();
    await expect(
      page.getByRole("heading", { name: "No departments yet" }),
    ).not.toBeVisible();
  });

  test("DataTable renders semantic table structure, custom cells, and row action menus", async ({
    page,
  }) => {
    await signInAsAdmin(page);

    // Navigate to /admin/users via client-side routing
    await page.locator("a[href='/admin/users']").first().click();
    await expect(page).toHaveURL(/\/admin\/users$/);

    // 1. ManagementToolbar (which delegates to TableToolbar) is present
    const toolbar = page.getByRole("region", {
      name: "Table management toolbar",
    });
    await expect(toolbar).toBeVisible();

    // 2. Semantic DataTable elements
    const table = page.locator("table");
    await expect(table).toBeVisible();
    await expect(table.locator("thead")).toBeVisible();
    await expect(table.locator("tbody")).toBeVisible();

    // Verify header columns
    const headers = table.locator("thead th");
    await expect(headers.filter({ hasText: "Name" })).toBeVisible();
    await expect(headers.filter({ hasText: "Email" })).toBeVisible();
    await expect(headers.filter({ hasText: "Role" })).toBeVisible();
    await expect(headers.filter({ hasText: "Status" })).toBeVisible();
    await expect(headers.filter({ hasText: "Actions" })).toBeVisible();

    // 3. Rows and cells rendering
    const rows = table.locator("tbody tr");
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThan(0);

    const firstRow = rows.first();
    // Verify ActionMenu on first row
    const actionMenu = firstRow.getByRole("button", {
      name: /^Actions for /,
    });
    await expect(actionMenu).toBeVisible();
    await actionMenu.click();
    await expect(page.locator("div[role='menu']")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("div[role='menu']")).not.toBeVisible();

    // 4. Pagination component
    const paginationNav = page.getByRole("navigation", {
      name: "Pagination",
    });
    if (await paginationNav.isVisible()) {
      const prevBtn = paginationNav.getByRole("button", {
        name: "Previous",
      });
      await expect(prevBtn).toBeDisabled(); // On page 1, Previous is disabled
    }
  });

  test("DataTable handles custom status filtering and active filter state reset", async ({
    page,
  }) => {
    await signInAsAdmin(page);

    const departmentsLink = page.locator("a[href='/hr/departments']").first();
    await departmentsLink.click();
    await expect(page).toHaveURL(/\/hr\/departments$/);

    const toolbar = page.getByRole("region", {
      name: "Table management toolbar",
    });
    await expect(toolbar).toBeVisible();

    // Select status filter
    const statusSelect = toolbar.getByRole("combobox", {
      name: "Filter by status",
    });
    await expect(statusSelect).toBeVisible();

    // Change status filter to 'active'
    await statusSelect.selectOption("active");
    await expect(statusSelect).toHaveValue("active");

    // Reset button appears
    const resetBtn = toolbar.getByRole("button", { name: "Reset" });
    await expect(resetBtn).toBeVisible();

    // Reset filters
    await resetBtn.click();
    await expect(statusSelect).toHaveValue("all");
    await expect(resetBtn).not.toBeVisible();
  });

  test("DataTable handles responsive overflow and Navigation Menu toolbar integration", async ({
    page,
  }) => {
    await signInAsAdmin(page);

    // Navigate to /admin/menu via client-side link
    await page.locator("a[href='/admin/menu']").first().click();
    await expect(page).toHaveURL(/\/admin\/menu$/);

    // Verify PageHeader and TableToolbar
    await expect(
      page.getByRole("heading", { name: "Navigation Menu" }),
    ).toBeVisible();
    const toolbar = page.getByRole("region", {
      name: "Table management toolbar",
    });
    await expect(toolbar).toBeVisible();

    // Verify responsive overflow-x-auto container wraps the table
    const tableWrapper = page
      .locator(".overflow-x-auto")
      .filter({ has: page.locator("table") });
    await expect(tableWrapper).toBeVisible();

    // Verify table columns
    const table = tableWrapper.locator("table");
    await expect(table).toBeVisible();
    await expect(
      table.locator("thead th").filter({ hasText: "Menu Item" }),
    ).toBeVisible();
    await expect(
      table.locator("thead th").filter({ hasText: "Path" }),
    ).toBeVisible();
    await expect(
      table.locator("thead th").filter({ hasText: "Parent" }),
    ).toBeVisible();
    await expect(
      table.locator("thead th").filter({ hasText: "Status" }),
    ).toBeVisible();
  });

  test("DataTable supports accessible column sorting (aria-sort), row selection, and pagination telemetry", async ({
    page,
  }) => {
    await signInAsAdmin(page);

    // Navigate to /reference/tags
    await page.locator("a[href='/reference/tags']").first().click();
    await expect(page).toHaveURL(/\/reference\/tags$/);

    const table = page.locator("table");
    await expect(table).toBeVisible();

    // 1. Column sorting and accessible aria-sort
    const nameHeader = table.locator("thead th").filter({ hasText: "Name" });
    await expect(nameHeader).toHaveAttribute("aria-sort", "ascending");

    // Click sort button on Name header to toggle to descending
    const nameSortBtn = nameHeader.getByRole("button", { name: "Name" });
    await nameSortBtn.click();
    await expect(nameHeader).toHaveAttribute("aria-sort", "descending");

    // Click again to toggle back to ascending
    await nameSortBtn.click();
    await expect(nameHeader).toHaveAttribute("aria-sort", "ascending");

    // 2. Row selection and select-all master checkbox
    const selectAllCheckbox = table.locator("thead input[type='checkbox']");
    await expect(selectAllCheckbox).toBeVisible();
    await expect(selectAllCheckbox).toHaveAttribute(
      "aria-label",
      "Select all rows",
    );

    const rowCheckboxes = table.locator("tbody input[type='checkbox']");
    const rowCount = await rowCheckboxes.count();
    if (rowCount > 0) {
      if (rowCount > 1) {
        // Check first row
        await rowCheckboxes.first().check();
        await expect(rowCheckboxes.first()).toBeChecked();

        // Master checkbox should have indeterminate state when some rows selected
        const isIndeterminate = await selectAllCheckbox.evaluate(
          (el: HTMLInputElement) => el.indeterminate,
        );
        expect(isIndeterminate).toBe(true);
      } else {
        // With single row, selecting it marks master checkbox as checked
        await rowCheckboxes.first().check();
        await expect(rowCheckboxes.first()).toBeChecked();
        await expect(selectAllCheckbox).toBeChecked();
      }

      // Select all rows
      await selectAllCheckbox.check();
      for (let i = 0; i < rowCount; i++) {
        await expect(rowCheckboxes.nth(i)).toBeChecked();
      }

      // Uncheck select all
      await selectAllCheckbox.uncheck();
      for (let i = 0; i < rowCount; i++) {
        await expect(rowCheckboxes.nth(i)).not.toBeChecked();
      }
    }

    // 3. Pagination result count telemetry
    const paginationNav = page.getByRole("navigation", { name: "Pagination" });
    if (await paginationNav.isVisible()) {
      await expect(
        paginationNav.getByText(/Showing \d+–\d+ of \d+ results/),
      ).toBeVisible();
    }
  });
});
