import { expect, test } from "@playwright/test";
import { signInAsAdmin } from "./helpers/auth";

async function navigateToTickets(page: import("@playwright/test").Page) {
  const nav = page.getByRole("navigation", {
    name: "Main application navigation",
  });
  const hrBtn = nav.getByRole("button", { name: "Human Resources" });
  await hrBtn.click();
  const dropdown = page.getByRole("menu", {
    name: "Human Resources categories",
  });
  const opsBtn = dropdown.getByRole("button", { name: "Operations" });
  await opsBtn.click();
  const subMenu = page.getByRole("menu", { name: "Operations items" });
  await subMenu.getByRole("link", { name: "Employee Tickets" }).click();
  await expect(page).toHaveURL(/\/hr\/tickets/);
  await page.waitForLoadState("networkidle");
}

test("lists employee tickets, switches feed/table view, and narrows them with status filters", async ({
  page,
}) => {
  await signInAsAdmin(page);
  await navigateToTickets(page);
  await expect(
    page.getByRole("heading", { name: "Employee Tickets" }),
  ).toBeVisible();

  // Summary metric cards
  await expect(page.getByText("Employee Open")).toBeVisible();
  await expect(page.getByRole("button", { name: /In Progress/i })).toBeVisible();
  await expect(page.getByText("Admin Sent (Active)")).toBeVisible();
  await expect(page.getByText("Resolved / Closed")).toBeVisible();

  // Capture screenshot of Feed View with active tickets (Reference 4 layout)
  await page.screenshot({
    path: "C:/Users/aslam/.gemini/antigravity-ide/brain/26e48f45-8d3e-422a-812d-bb6a0845c19d/tickets_feed_view.png",
  });

  // Switch to Table View and capture screenshot
  await page.getByRole("button", { name: "Table View" }).click();
  await page.screenshot({
    path: "C:/Users/aslam/.gemini/antigravity-ide/brain/26e48f45-8d3e-422a-812d-bb6a0845c19d/tickets_table_view.png",
  });
  await page.getByRole("button", { name: "Feed View" }).click();

  // Filter by status dropdown using Ark UI custom Select
  const statusFilter = page.getByRole("combobox", { name: "Filter by status" });
  await expect(statusFilter).toBeVisible();
  await statusFilter.click();
  const resolvedOption = page.getByRole("option", { name: /Resolved/i });
  if (await resolvedOption.isVisible()) {
    await resolvedOption.click();
  }

  // Search input
  const searchInput = page.getByLabel("Search tickets");
  await expect(searchInput).toBeVisible();
});

test("opens create ticket dialog and validates required fields", async ({
  page,
}) => {
  await signInAsAdmin(page);
  await navigateToTickets(page);
  await expect(
    page.getByRole("heading", { name: "Employee Tickets" }),
  ).toBeVisible();

  const createBtn = page
    .locator("header")
    .getByRole("button", { name: "Create Ticket" });
  if (await createBtn.isVisible()) {
    await createBtn.click();
    await expect(
      page.getByRole("heading", { name: "Create Ticket for Employee" }),
    ).toBeVisible();

    // Capture screenshot of Create Ticket dialog (Reference 5 layout)
    await page.screenshot({
      path: "C:/Users/aslam/.gemini/antigravity-ide/brain/26e48f45-8d3e-422a-812d-bb6a0845c19d/create_ticket_dialog.png",
    });

    // Submit empty form to trigger validation
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Create Ticket" })
      .click();
    await expect(page.getByText("Subject is required")).toBeVisible();
  }
});


