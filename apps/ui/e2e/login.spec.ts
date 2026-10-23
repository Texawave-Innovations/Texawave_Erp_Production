import path from "node:path";
import { expect, test } from "@playwright/test";

const ARTIFACT_DIR =
  process.env.ARTIFACT_DIR ||
  "C:/Users/aslam/.gemini/antigravity-ide/brain/0f2a220b-9ce0-4336-b3f3-2319e43c0178";

test.describe("Login Form", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
  });

  test("renders all core login form fields and branding", async ({ page }) => {
    // Branding and header
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    await expect(page.getByText("Sign in to access TexaWave ERP")).toBeVisible();

    // Organization field
    const orgInput = page.getByLabel("Organization");
    await expect(orgInput).toBeVisible();
    await expect(orgInput).toHaveValue("texawave-innovations");

    // Email field
    const emailInput = page.getByLabel("Email");
    await expect(emailInput).toBeVisible();
    await expect(emailInput).toHaveAttribute("type", "email");
    await expect(emailInput).toHaveAttribute("placeholder", "you@texawave.com");

    // Password field
    const passwordInput = page.locator("#password");
    await expect(passwordInput).toBeVisible();
    await expect(passwordInput).toHaveAttribute("type", "password");

    // Show/hide password toggle
    const toggleButton = page.getByRole("button", { name: "Show password" });
    await expect(toggleButton).toBeVisible();

    // Remember me checkbox
    const rememberMeCheckbox = page.getByRole("checkbox");
    await expect(rememberMeCheckbox).toBeVisible();
    await expect(rememberMeCheckbox).toBeChecked();

    // Forgot password link
    const forgotPasswordLink = page.getByRole("link", { name: /Forgot password/i });
    await expect(forgotPasswordLink).toBeVisible();
    await expect(forgotPasswordLink).toHaveAttribute("href", "/forgot-password");

    // Submit button
    const submitButton = page.locator("button[type='submit']");
    await expect(submitButton).toBeVisible();
    await expect(submitButton).toContainText("Sign in");

    // Capture screenshot of rendered form
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "login_step1_rendered.png"),
      fullPage: true,
    });
  });

  test("toggles password visibility when eye button is clicked", async ({ page }) => {
    const passwordInput = page.locator("#password");
    await passwordInput.fill("SecretPassword123!");
    await expect(passwordInput).toHaveAttribute("type", "password");

    // Click show password
    const showButton = page.getByRole("button", { name: "Show password" });
    await showButton.click();
    await expect(passwordInput).toHaveAttribute("type", "text");

    // Capture screenshot with revealed password
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "login_step2_password_toggle.png"),
      fullPage: true,
    });

    // Click hide password
    const hideButton = page.getByRole("button", { name: "Hide password" });
    await expect(hideButton).toBeVisible();
    await hideButton.click();
    await expect(passwordInput).toHaveAttribute("type", "password");
  });

  test("displays an error alert on invalid credentials", async ({ page }) => {
    await page.getByLabel("Email").fill("invalid-user@texawave.com");
    await page.locator("#password").fill("WrongPassword999!");
    await page.locator("button[type='submit']").click();

    // Error alert banner should appear
    const errorAlert = page.locator("[role='alert'], .text-rose-500, .bg-rose-50");
    await expect(errorAlert.first()).toBeVisible({ timeout: 10_000 });
    // URL remains on /login
    await expect(page).toHaveURL(/\/login/);

    // Capture screenshot with error alert
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "login_step3_error_alert.png"),
      fullPage: true,
    });
  });

  test("successfully logs in with valid credentials and redirects to dashboard", async ({ page }) => {
    await page.getByLabel("Organization").fill("texawave-innovations");
    await page.getByLabel("Email").fill("admin@texawave.com");
    await page.locator("#password").fill("ChangeMe123!");

    await page.locator("button[type='submit']").click();

    // Expect redirection away from /login upon successful sign in
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });

    // Verify authenticated shell/page is displayed
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).toBeVisible();

    // Capture screenshot of authenticated dashboard landing page
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "login_step4_authenticated.png"),
      fullPage: true,
    });
  });
});
