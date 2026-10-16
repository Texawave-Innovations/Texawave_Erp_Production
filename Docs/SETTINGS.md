# Settings & Access Control — Architecture, Rules and Parity

Scope: Users management (`/admin/users`), Roles & RBAC (`/admin/roles`), Navigation Menu (`/admin/navigation`), and Reference Tags (`/reference/tags`). Backend controllers, Prisma persistence, and frontend views.

Written for: Engineers reviewing or extending the Settings and Access Control module, and administrators managing organizational security.

## 1. Architecture

| Piece                 | Where                                                                                                           |
| --------------------- | --------------------------------------------------------------------------------------------------------------- |
| Pure rules            | `settings/roles/roles-domain.ts` — role version locking, system role protection, lockout prevention guards      |
| Persistence & locking | `settings/roles/roles.repository.ts` — Prisma caller managing roles, permissions, and grants with audit logging |
| Orchestration         | `settings/roles/roles.service.ts` — business logic for cloning, updating grants, and scope assignments          |
| HTTP                  | `settings/roles.controller.ts`, `settings/users.controller.ts`, `settings/navigation.controller.ts`             |
| RBAC Guard            | `platform/roles-permissions/permissions.guard.ts` — evaluates permission codes and team/org scopes              |

Tables (schema `platform`): `users`, `roles`, `permissions`, `role_permissions`, `user_roles`, `menu_items`, `tags`.

---

## 2. Role Lifecycle & Security Rules

### 2.1 System Roles & Protection

- **System Roles:** The platform ships with four immutable system roles: `Super Admin`, `HR Manager`, `Team Lead`, and `Employee`.
- **Protection Rules:** System roles cannot be renamed or deactivated (enforced via backend policy: `SYSTEM_ROLE_PROTECTED`). However, their assigned permission grants are fully customizable.
- **Optimistic Locking:** Every role record carries a `version` field. Concurrent updates are checked against this version to prevent race conditions during permission edits (`VERSION_CONFLICT`).

### 2.2 Access Lockout Prevention

- **Lockout Guard:** The system prevents any write operation (such as deactivating a user, revoking role permissions, or deleting an admin account) that would leave the organization with **zero active users holding role-administration privileges** (`ACCESS_LOCKOUT`). This ensures administrators cannot accidentally lock themselves out of the system.

---

## 3. Data Scopes & Permission Architecture

Permissions follow the standard TexaOne format: `<module>.<entity>.<action>.<scope>` (or without scope if organization-wide).

| Scope Level | Meaning                                                        | Example Use Case                   |
| ----------- | -------------------------------------------------------------- | ---------------------------------- |
| `OWN`       | Restricted strictly to records created by or belonging to user | Employee viewing their own profile |
| `TEAM`      | Records belonging to teams assigned to the user                | Team Lead managing team attendance |
| `ALL`       | Organization-wide access across all teams                      | HR Manager / Super Admin oversight |

---

## 4. Sub-Modules & UI Specifications

### 4.1 Users Management (`/admin/users`)

- **Purpose:** Central user directory and lifecycle management.
- **Presentation:** Uses generic `DataTable` with `TableToolbar`, search (name/email), filters (`Role`, `Team`, `Status`), and row actions.
- **Dialogs:** `UserForm` modal supporting creation (`+ New user`) with role and team bindings, and status toggling (`Active` / `Inactive`).

### 4.2 Roles & Access Control (`/admin/roles`)

- **Purpose:** Split-pane administrative interface for managing permissions, navigation visibility, and role membership.
- **Tabs:**
  - **Permissions:** Categorized permission matrix with toggle switches and scope indicators (with lock icons for restricted items).
  - **Navigation:** Assigns visibility of sidebar and top-nav routes per role.
  - **Members:** Audits users currently holding the selected role.
  - **History:** Immutable audit log tracking who changed which permissions and when.
- **Actions:** Role cloning (`Clone`) and metadata editing (`Edit details`).

### 4.3 Navigation Menu (`/admin/navigation`)

- **Purpose:** Manages the hierarchical application routing tree, parent-child relationships, display order, and status.
- **Data Resolution:** Parent items correctly resolve to their corresponding menu labels (fixing raw ID displays such as `#5`).
- **Presentation:** Global system-wide routing view with breadcrumb alignment (`Settings › Configuration › Navigation Menu`).

### 4.4 Reference Tags (`/reference/tags`)

- **Purpose:** Organization-wide classification tags used across modules (HR, Finance, Projects).
- **Presentation:** Standardized header layout (`PageHeader`), search/filter toolbar, and responsive tag grid/table with color coding.

---

## 5. Audit & Compliance

- **Forensics:** Every permission grant modification, role creation, and user status change writes an entry to the immutable `audit_logs` table (schema `platform`), capturing `before` and `after` JSON snapshots.
