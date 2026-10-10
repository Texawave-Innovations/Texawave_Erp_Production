# Menu & role-based navigation — API architecture

**Audience:** QA/testers who need to verify "role X sees/doesn't see tab Y," and UI developers
building a new page that should appear in a sidebar. **Status:** implemented, covers the dashboard
sidebar, the employee portal sidebar, and the Settings → Roles "Menu access" editor.

Related docs: [`ARCHITECTURE.md`](ARCHITECTURE.md) §7 (employee self-service vs HR separation),
[`CODING_STANDARDS.md`](CODING_STANDARDS.md) §10/§10a (`@OrgScoped()`/`@TeamScoped()`/
`@RequirePermission()`), `packages/database/prisma/menu/README.md` (how a menu item reaches
staging/production, not just local dev).

---

## 1. The one idea that explains everything here

**A menu item's visibility is never stored as its own fact.** There is no "is this tab enabled for
this role" checkbox anywhere. Instead:

```
MenuItem.permission (a permission code, or null)
            +
the caller's resolved permission set (what their role currently grants)
            =
whether the tab shows up in GET /menu/my-menu
```

If you want a role to see a tab, you grant it the permission that tab is gated by. If you want to
hide a tab, you revoke that permission. There is nothing else to configure — which is also why the
Settings → Roles "Menu access" matrix (§4) is just a friendlier view over the same permission grants
you could edit directly.

This matters for testing: **a tab disappearing from the sidebar proves nothing about security.** The
API enforces the same permission independently on every route. Hiding a button is convenience, not a
boundary — see §6 for how to actually verify the boundary.

---

## 2. Endpoints

All routes require a bearer access token (global `JwtAuthGuard`); 401 without one. Base path: `/menu`.

| Method & path            | Permission                    | Who calls it                                                                               |
| ------------------------ | ----------------------------- | ------------------------------------------------------------------------------------------ |
| GET `/menu/my-menu`      | none (any authenticated user) | Every app shell on login/navigation — returns **this caller's** filtered, nested menu tree |
| GET `/menu/items`        | `menu.item.read` ○            | Admin "Navigation Menu" screen — the full, unfiltered catalogue for this org               |
| GET `/menu/items/:id`    | `menu.item.read` ○            | Same screen, single row                                                                    |
| POST `/menu/items`       | `menu.item.write` ○           | Create a menu item (normally done via the catalogue + `menu:sync`, not by hand — see §5)   |
| PATCH `/menu/items/:id`  | `menu.item.write` ○           | Edit label/path/order/permission/parent                                                    |
| DELETE `/menu/items/:id` | `menu.item.write` ○           | **Soft** delete (`isActive: false` / `deletedAt`) — nothing is ever hard-deleted           |

`○` = organization-wide exact permission (no `.own`/`.team`/`.all` scope — menu administration itself
isn't team-scoped data).

### `GET /menu/my-menu` response shape

```json
{
  "data": [
    {
      "id": 101,
      "code": "portal",
      "label": "My Portal",
      "path": null,
      "icon": null,
      "order": 2,
      "children": [
        {
          "id": 120,
          "code": "portal-profile",
          "label": "My Profile",
          "path": "/portal/profile",
          "icon": null,
          "order": 1,
          "children": []
        }
      ]
    }
  ]
}
```

A node with `path: null` and `children` is a pure grouping node (e.g. "HR", "My Portal", "Admin") —
not clickable itself, just a container the UI renders as a collapsible section.

---

## 3. How the filter actually works (backend)

`apps/api/src/modules/menu/menu.service.ts`, `getMyMenu(userId)`:

1. Load every active `MenuItem` for the caller's organization (`tenantContext.getOrgScope()`).
2. Load the caller's resolved permission set — `PermissionsService.getPermissionsForUser(userId)`,
   Redis-cached per user, invalidated the moment an admin changes their role's grants (§4.1).
3. For each item:
   - `permission: null` → always included (visible to every authenticated user in the org).
   - `permission: "hr.task.write"` (a bare prefix, from `scopedPermission()`) → included if the
     caller holds **any** of `.own`/`.team`/`.all` for that family. This mirrors exactly how
     `PermissionsGuard`/`@RequireScopedPermission()` decide route access — same rule, so "can see the
     tab" and "can call the route" never disagree.
   - an exact unscoped code (e.g. `"reference.tags.read"`) → included only on an exact match.
4. Build the parent/child tree from `parentId`, drop empty groups, sort by `order`.

Nothing here is cached beyond the per-user permission set — the menu tree itself is read live, so a
permission grant takes effect on the caller's **next** `GET /menu/my-menu` call (next page load/login,
not instantly in an already-open tab — see §6.3).

---

## 4. How an admin controls it (UI)

Settings → Roles → a role → **"Menu access"** (`apps/ui/src/features/settings/role-menu-matrix/`,
component `RoleMenuMatrixView`). One row per menu item that has a scoped or flat permission:

- A **scoped** row (permission from `scopedPermission()`, e.g. `hr.task.write`) shows a dropdown:
  `None` / `Own records` / `Own team` / `All teams`. Picking one sets exactly that one permission
  variant on the role and clears the others for that family.
- A **flat** row (an exact, unscoped permission) shows a plain checkbox: granted or not.
- A row with `permission: null` is **not shown here at all** — there's nothing to toggle; it's
  visible to everyone by construction. If a new feature needs a per-role on/off switch, it must be
  gated by a real permission, not left ungated.

Saving calls the same `PUT /settings/roles/:id/permissions` full-replace endpoint the rest of Settings
→ Roles uses — this view only ever touches the permission ids it displays; every other grant the role
holds (e.g. write/approve permissions with no menu tab at all) is carried through unchanged.

### 4.1 Cache invalidation

`RolesService.setPermissions()` (`apps/api/src/modules/settings/roles/roles.service.ts`) calls
`invalidateUsersForRole()` after every grant change, which evicts the Redis-cached permission set for
every user currently holding that role. **The access token itself is memory-only on the frontend**
(`apps/ui/src/stores/auth-store.ts`) — a page reload logs the user out entirely. So after an admin
changes a grant, the affected user needs to **sign in again** (not just refresh) to see the new menu
state. This is the single most common "why doesn't the tab show up" surprise during manual testing —
see §6.3.

---

## 5. Adding a new menu item (for a UI developer)

1. **Don't call `POST /menu/items` by hand** for anything meant to exist beyond your own laptop. Add
   the item to `packages/database/prisma/menu/catalog.ts` instead:
   ```ts
   {
     code: "portal-task-assignment",
     label: "Task Assignment",
     path: "/portal/task-assignment",
     order: 10,
     parentCode: "portal",       // "portal" | "hr" | "admin" | null (top-level)
     permission: "hr.task.write",   // scoped family: any of .own/.team/.all shows it
   },
   ```
   `validate.ts` will reject the catalogue at `menu:check`/`menu:sync` time if `permission` doesn't
   match anything in `prisma/permissions/catalog.ts` — a typo'd permission string is caught before it
   ever reaches a database, instead of silently creating a tab nobody can ever see.
2. Run `pnpm --filter @texawave-erp/database menu:sync` locally to apply it to your dev org.
3. Build the actual Next.js page at the `path` you chose, then make it reachable (§5.1): a **portal**
   item needs nothing else — the portal sidebar renders whatever `GET /menu/my-menu` returns under
   `portal`. An **HR or Settings** tab also needs a link in `HR_NAV_GROUPS` / `SETTINGS_NAV_ITEMS`
   (`apps/ui/src/components/DynamicSidebar.tsx`) with `menuCode` set to the catalogue `code` — that
   is where its group, label and icon live; the menu only decides whether it is shown.
4. Grant the gating permission to whichever role(s) should see it, via Settings → Roles → Menu
   access (§4). The catalogue entry existing does **not** grant anyone access to anything.
5. In the same PR, make sure the API route behind that page independently enforces the same
   permission (`@RequirePermission()`/`@RequireScopedPermission()` + `@TeamScoped()` if it's
   team-scoped data) — the menu item is navigation, not authorization.

### 5.1 Dashboard vs portal shells

Both shells render `DynamicSidebar`, and both take their visibility from the same
`GET /menu/my-menu` response:

- **Portal** (`onlyRootCode="portal"`) — flattened to exactly the `portal` root's children, labels
  and paths straight from the menu. Used so nothing from `hr`/`admin` can ever leak into the
  self-service shell even if a permission is misconfigured.
- **Dashboard** (no prop) — the grouped HR nav (`HR_NAV_GROUPS`) or, under `/settings`,
  `/reference`, `/admin/users|roles|menu`, the Settings nav (`SETTINGS_NAV_ITEMS`). Every link there
  carries a `menuCode` and is shown **only if** that code is in the user's menu, so the catalogue
  `permission` (and the Menu access matrix, §4) decides who sees each tab. A group left with no tab
  is not rendered. While the menu loads, or if it fails, no link is shown (fail closed).

HR tab permissions are each page's own read family (e.g. `hr-leaves` → `hr.leave_request.read`, any
scope). Self-service users get their own records through the portal, not through these tabs; only
`hr-dashboard` stays `permission: null`, because each dashboard widget gates itself.

**Which shell a user lands in** (`apps/ui/src/features/auth/landing.ts`, guarded again in
`app/(dashboard)/layout.tsx`): an account with an employee record gets the dashboard only if it holds
`hr.workspace.access`; otherwise it is portal-only, whatever `hr.*` reads its role holds — so
Employees and Team Leads both work in the portal, and a Team Lead's team tabs (Task Assignment, Team
Attendance, Team Leaves) are `portal` items gated by the HR screen's own read family. Accounts with no
employee record (Super Admin) always get the dashboard. `hr.workspace.access` also gates the `hr` root
group itself, so it appears in the Menu access matrix as the **"HR"** row, and without it no HR tab is
in the user's menu at all. Holders of `settings.role.write` always get the dashboard shell too (the
lock-out guard in `hasWorkspaceAccess`), so after deploying, a Super Admin can still sign in, open
Settings → Roles → Menu access and tick "HR" for the Super Admin role itself and each role that
should keep the HR workspace (e.g. HR Manager) — `permissions:sync` never grants anything (the local
seed grants Super Admin every permission, so a re-seeded dev DB is covered).

A root group's `code` (`hr`, `portal`, `admin`) is what decides which shell an item can ever appear
in — get the `parentCode` right in the catalogue or the page will exist but be unreachable from
either sidebar.

**Permission namespace rule** (`ARCHITECTURE.md` §7): portal items are gated by
`employee_self_service.*` permissions, except for a documented exception — a genuinely team-scoped
HR capability surfaced in the portal shell (e.g. a Team Lead assigning tasks) may use an `hr.*.team`
permission instead. Don't invent a parallel `employee_self_service.*` permission for something that
isn't actually self-service just to satisfy the namespace convention.

---

## 6. For testers — verifying a role sees/doesn't see something

### 6.1 Quick manual check

1. In Settings → Roles, note (or temporarily change) the role's permission grants.
2. Sign in as a user holding that role.
3. Check the sidebar for the expected tab(s).
4. Change the grant in Settings → Roles.
5. **Sign out and sign back in** (not just reload — §4.1) and re-check.

### 6.2 What "pass" actually requires

Checking the UI is necessary but not sufficient. For every new gated tab, also confirm:

- **Hidden ⇏ 403 only.** Try the route directly (type the URL) without the permission — the page
  should still refuse to load real data, independent of whether the link was visible.
- **The API rejects it, not just the page.** Call the underlying endpoint directly (Postman/curl/the
  browser's network tab) without the permission granted — expect 403 (wrong permission) or 404 (right
  permission, wrong scope — e.g. a Team Lead hitting another team's record). A tab that's hidden but
  whose API happily serves the data anyway is a real vulnerability, not a cosmetic miss.
- **Scope, not just presence.** For a `.own`/`.team`/`.all` permission, confirm a `.team` holder
  really is restricted to their own team's rows, not merely "has _a_ task permission."

### 6.3 The two things that look like bugs but aren't

- **A newly granted tab doesn't appear after reload.** Expected — the access token is memory-only;
  the user must sign in again (§4.1). This is not a caching bug.
- **An ungated item (`permission: null`) has no row in the Menu access matrix.** Expected — there's
  nothing to toggle; it's visible to every authenticated user in the org by design (§4).

### 6.4 End-to-end test reference

`apps/ui/e2e/employee-portal-nav.spec.ts` is a worked example covering exactly this: creating a role
with specific permissions via the API, confirming a tab is absent, granting the permission, signing
in again, and confirming the tab appears and the underlying page actually loads data — not just that
a link exists.

---

## 7. Known limitations

- `menu.item.write` lets anyone holding it create a menu item by hand via `POST /menu/items`,
  bypassing the catalogue entirely — such a row becomes an **orphan** from `menu:sync`'s point of
  view (reported, never touched, never deleted). Prefer the catalogue (§5) unless you have a specific
  reason to create something outside it.
- The menu tree supports two levels in practice (a root group and its direct children). The
  resolution code in `sync.ts` is written to handle deeper trees, but nothing in the UI has been built
  or tested against one.
