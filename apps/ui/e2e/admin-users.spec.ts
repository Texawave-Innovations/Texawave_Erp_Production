import { expect, test, type Page } from "@playwright/test";
import { signInAsAdmin, uniqueName } from "./helpers/auth";

/** Tokens live in memory, so open Users by clicking (sidebar Settings lands
 * on /admin/users), never with page.goto after signing in. */
async function openUsers(page: Page) {
  await signInAsAdmin(page);
  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page).toHaveURL(/\/admin\/users$/);
}

test("creates a user and assigns a role and a team", async ({ page }) => {
  await openUsers(page);
  await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();

  const fullName = uniqueName("PW user");
  const email = `pw-${Date.now()}@texawave.com`;
  await page.getByRole("button", { name: "New user" }).click();
  await page.getByLabel("Full Name").fill(fullName);
  await page.getByLabel("Email").fill(email);
  await page.getByRole("textbox", { name: "Password" }).fill("ChangeMe123!");
  await page.getByRole("button", { name: "Create user" }).click();
  await expect(page.getByText("User created")).toBeVisible();

  const row = page.getByRole("row", { name: new RegExp(fullName) });
  await expect(row).toBeVisible();

  await row.getByRole("button", { name: /^Actions for / }).click();
  await page.getByRole("menuitem", { name: "Manage roles" }).click();
  const rolesDialog = page.getByRole("dialog");
  await expect(rolesDialog.getByText("Assign Roles")).toBeVisible();
  await rolesDialog.getByRole("checkbox").first().check();
  await rolesDialog.getByRole("button", { name: "Save roles" }).click();
  await expect(page.getByText(`Updated roles for "${fullName}"`)).toBeVisible();

  await row.getByRole("button", { name: /^Actions for / }).click();
  await page.getByRole("menuitem", { name: "Manage teams" }).click();
  const teamsDialog = page.getByRole("dialog");
  await teamsDialog.getByRole("checkbox").first().check();
  await teamsDialog.getByRole("button", { name: "Save teams" }).click();
  await expect(page.getByText(`Updated teams for "${fullName}"`)).toBeVisible();
});

test("shows an error toast when creating a user with a duplicate email", async ({
  page,
}) => {
  await openUsers(page);
  await page.getByRole("button", { name: "New user" }).click();
  await page.getByLabel("Full Name").fill("Duplicate Admin");
  await page.getByLabel("Email").fill("admin@texawave.com");
  await page.getByLabel("Password").fill("ChangeMe123!");
  await page.getByRole("button", { name: "Create user" }).click();
  await expect(page.getByText("Could not create user")).toBeVisible();
});

test("refuses to remove the last way you manage roles, and says why", async ({
  page,
}) => {
  // Safety for the shared dev DB: only run when Super Admin is the admin's
  // ONLY source of "Manage roles" — then the API must refuse and nothing changes.
  const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
  const login = await page.request.post(`${api}/auth/login`, {
    data: {
      organizationSlug: "texawave-innovations",
      email: "admin@texawave.com",
      password: "ChangeMe123!",
    },
  });
  const token = ((await login.json()) as { data: { accessToken: string } }).data
    .accessToken;
  const headers = { Authorization: `Bearer ${token}` };
  const me = (await (
    await page.request.get(`${api}/auth/me`, { headers })
  ).json()) as { data: { userId: number } };
  const effective = (await (
    await page.request.get(
      `${api}/users/${me.data.userId}/effective-permissions`,
      { headers },
    )
  ).json()) as {
    data: {
      permissions: { code: string; grantedBy: { roleName: string }[] }[];
    };
  };
  const sources =
    effective.data.permissions
      .find((p) => p.code === "settings.role.write")
      ?.grantedBy.map((g) => g.roleName) ?? [];
  test.skip(
    sources.length !== 1 || sources[0] !== "Super Admin",
    "Manage roles comes from more than Super Admin here; the change could succeed",
  );

  await openUsers(page);
  await page.getByLabel("Search users").fill("admin@texawave.com");
  const row = page.getByRole("row", { name: /admin@texawave\.com/ });
  await row.getByRole("button", { name: /^Actions for / }).click();
  await page.getByRole("menuitem", { name: "Manage roles" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("checkbox", { name: "Super Admin" }).uncheck();
  await dialog.getByRole("button", { name: "Save roles" }).click();
  await expect(page.getByText("Could not update roles")).toBeVisible();
  await expect(
    page.getByText(
      /nobody able to manage roles|remove “Manage roles” from you/,
    ),
  ).toBeVisible();
});
