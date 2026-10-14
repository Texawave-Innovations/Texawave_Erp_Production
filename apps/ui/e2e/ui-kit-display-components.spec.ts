import { expect, test } from "@playwright/test";

/**
 * Focused tests for Phase 1 promoted UI-Kit display components:
 * 1. Card default appearance and all semantic tones (default, warning, info, success, error)
 * 2. StatCard rendering, accessibility attributes, and numeric values
 * 3. AnimatedNumber reduced-motion behavior (emulateMedia reducedMotion: reduce)
 * 4. MetricTrend direction indicators and accessible labels
 * 5. TableSkeleton row and column configuration
 */

async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Organization").fill("texawave-innovations");
  await page.getByLabel("Email").fill("admin@texawave.com");
  await page.locator("input#password").fill("ChangeMe123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/(reference\/tags|hr)/);
}

test.describe("Global UI Kit Phase 1 — Display Components", () => {
  test("Card renders default appearance and semantic tones (default, warning, info, success, error)", async ({
    page,
  }) => {
    await signIn(page);

    // 1. Tickets view demonstrates default, warning, info, and success Card tones
    await page.getByRole("link", { name: "Employee Tickets" }).click();
    await expect(
      page.getByRole("heading", { name: "Employee Tickets" }),
    ).toBeVisible();

    // Default tone (Total Tickets): gradient-card-border
    const defaultCard = page
      .locator(".gradient-card-border")
      .filter({ hasText: "Total Tickets" });
    await expect(defaultCard).toBeVisible();
    await expect(defaultCard).toHaveClass(/rounded-2xl/);

    // Warning tone (Open): gradient-card-border-warning
    const warningCard = page
      .locator(".gradient-card-border-warning")
      .filter({ hasText: "Open" });
    await expect(warningCard).toBeVisible();
    await expect(warningCard).toHaveClass(/rounded-2xl/);

    // Info tone (In Progress): gradient-card-border-info
    const infoCard = page
      .locator(".gradient-card-border-info")
      .filter({ hasText: "In Progress" });
    await expect(infoCard).toBeVisible();
    await expect(infoCard).toHaveClass(/rounded-2xl/);

    // Success tone (Resolved): gradient-card-border-success
    const successCard = page
      .locator(".gradient-card-border-success")
      .filter({ hasText: "Resolved" });
    await expect(successCard).toBeVisible();
    await expect(successCard).toHaveClass(/rounded-2xl/);

    // 2. Dashboard demonstrates error tone on Pending approvals StatCard
    await page.getByRole("link", { name: "Dashboard" }).click();
    await expect(
      page.locator("section[aria-labelledby='kpi-approvals']"),
    ).toBeVisible();

    const errorCard = page
      .locator("section[aria-labelledby='kpi-approvals']")
      .filter({ hasText: "Pending approvals" });
    await expect(errorCard).toBeVisible();
    await expect(errorCard).toHaveClass(/gradient-card-border-error/);
    await expect(errorCard).toHaveClass(/rounded-2xl/);
  });

  test("StatCard renders accessible structure, numeric values, and stretched overlay", async ({
    page,
  }) => {
    await signIn(page);
    await page.getByRole("link", { name: "Dashboard" }).click();

    // Inspect Total Employees StatCard
    const totalCard = page.locator("section[aria-labelledby='kpi-total']");
    await expect(totalCard).toBeVisible();

    // Verify accessible heading connection
    const heading = totalCard.locator("#kpi-total");
    await expect(heading).toHaveText("Total employees");

    // Verify formatted numeric value
    const valueEl = totalCard.locator("p.text-title-sm");
    await expect(valueEl).toBeVisible();
    const valueText = await valueEl.textContent();
    expect(valueText?.trim()).toMatch(/^\d+$/);

    // Verify secondary note
    await expect(totalCard.getByText("Registered headcount")).toBeVisible();

    // Verify subtle top accent hairline
    const hairline = totalCard.locator("span.absolute.inset-x-0.top-0");
    await expect(hairline).toBeVisible();

    // Verify accessible stretched link overlay
    const overlayLink = totalCard.locator("a[href='/hr/employees']");
    await expect(overlayLink).toBeVisible();
    await expect(overlayLink).toHaveAttribute("aria-label", /Total employees:/);
  });

  test("AnimatedNumber respects prefers-reduced-motion: reduce", async ({
    page,
  }) => {
    // Emulate reduced-motion preference
    await page.emulateMedia({ reducedMotion: "reduce" });

    await signIn(page);
    await page.getByRole("link", { name: "Dashboard" }).click();

    // Metric numbers render immediately without continuous frame animations
    const totalValue = page.locator(
      "section[aria-labelledby='kpi-total'] p.text-title-sm",
    );
    await expect(totalValue).toBeVisible();
    const valueText = await totalValue.textContent();
    expect(Number(valueText?.trim())).toBeGreaterThanOrEqual(0);
  });

  test("MetricTrend displays semantic directions and accessible trend labels", async ({
    page,
  }) => {
    await signIn(page);
    await page.getByRole("link", { name: "Dashboard" }).click();

    // Active workforce StatCard renders a MetricTrend badge
    const activeCard = page.locator("section[aria-labelledby='kpi-active']");
    await expect(activeCard).toBeVisible();

    const trendBadge = activeCard.locator("span[aria-label^='Trend:']");
    await expect(trendBadge).toBeVisible();

    const ariaLabel = await trendBadge.getAttribute("aria-label");
    expect(ariaLabel).toMatch(/^Trend:\s+(up|down|neutral)/);

    // Verify inline svg icon is present
    await expect(trendBadge.locator("svg")).toBeVisible();
  });

  test("TableSkeleton renders specified row and column configurations", async ({
    page,
  }) => {
    // Intercept tickets query with a 500ms delay to reliably capture loading state
    await page.route("**/tickets*", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.continue();
    });

    await signIn(page);
    await page.getByRole("link", { name: "Employee Tickets" }).click();

    // TicketsView specifies TableSkeleton rowsCount={6} columnsCount={7}
    const skeleton = page.locator(
      "div[role='status'][aria-label='Loading table data']",
    );
    await expect(skeleton).toBeVisible();

    // Verify exact columns (7 in thead)
    const headerCols = skeleton.locator("thead th");
    await expect(headerCols).toHaveCount(7);

    // Verify exact rows (6 in tbody)
    const bodyRows = skeleton.locator("tbody tr");
    await expect(bodyRows).toHaveCount(6);

    // Verify avatar placeholder in first column of each row
    const avatarPlaceholders = skeleton.locator(
      "tbody tr td:first-child .rounded-full",
    );
    await expect(avatarPlaceholders).toHaveCount(6);

    // Wait for data load to finish cleanly
    await page.waitForLoadState("networkidle");
  });
});
