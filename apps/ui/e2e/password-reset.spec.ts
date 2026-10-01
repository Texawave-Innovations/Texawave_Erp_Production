import { expect, test } from "@playwright/test";

test("forgot-password shows the same confirmation for any email", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "Forgot your password?" }).click();
  await expect(page).toHaveURL(/\/forgot-password/);

  await page.getByLabel("Organization").fill("texawave-innovations");
  await page.getByLabel("Email").fill("nobody-here@texawave.com");
  await page.getByRole("button", { name: "Send reset link" }).click();

  // No account enumeration — identical response whether or not the email exists.
  await expect(page.getByText("Check your email")).toBeVisible();
});

test("reset-password without a token shows an invalid-link error", async ({
  page,
}) => {
  await page.goto("/reset-password");
  await expect(page.getByText("Invalid link")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "forgot password" }),
  ).toBeVisible();
});

test("reset-password with a bad token surfaces the server error", async ({
  page,
}) => {
  await page.goto("/reset-password?token=not-a-real-token");
  await page
    .getByLabel("New password", { exact: true })
    .fill("NewPassw0rd!123");
  await page.getByLabel("Confirm new password").fill("NewPassw0rd!123");
  await page.getByRole("button", { name: "Reset password" }).click();
  await expect(page.getByText("Could not reset password")).toBeVisible();
});
