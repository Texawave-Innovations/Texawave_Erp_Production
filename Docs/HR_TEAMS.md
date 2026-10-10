# TexaWave ERP — HR Teams Specification

**Owner:** Human Resources Engineering Team  
**Last verified:** 2026-10-10, against active codebase implementation  
**Status:** Living reference document for HR Teams (`/hr/teams`). Companion documents: [`Docs/ARCHITECTURE.md`](ARCHITECTURE.md) (§5.5), [`Docs/DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md), [`Docs/HR_DEPARTMENTS.md`](HR_DEPARTMENTS.md), [`Docs/HR_EMPLOYEES.md`](HR_EMPLOYEES.md), [`Docs/HR_API.md`](HR_API.md).

---

## 1. Overview & Architectural Philosophy

The **Teams** module (`/hr/teams`) delivers an enterprise-grade card-view interface for organizational team divisions with scoped access permissions in **TexaWave ERP Production**.

As specified in `ARCHITECTURE.md` §5.5:

- Teams serve as the actual authorization boundary for team-scoped data (`.own`, `.team`, `.all` permission suffixes).
- Team membership is linked to employees and users via `user_team_access`, where leads have `is_lead = true`.
- HR/Admin users hold `.all`-scoped permissions and bypass team query filters.

### Core Principles

1. **Zero Backend Modifications:** Preserves existing backend architecture, Prisma `Team` and `UserTeamAccess` models, `@OrgScoped` endpoints, API contracts, and authentication boundaries.
2. **Deterministic Code Generation & Presentation:** Automatic generation of standard uppercase team codes (e.g. `TEAM-SW`, `TEAM-ME`, `TEAM-EE`) while keeping the code read-only in detail views with explanatory guidance.
3. **Approved 4-Screen Parity:** Strictly aligned with the approved 4-screen visual specification:
   - Screen 1: Teams — Card View (With Data)
   - Screen 2: Teams — Empty State
   - Screen 3: New Team Modal
   - Screen 4: View / Edit Team Modal (Team Details)
4. **Scoped Access Permissions Integrity:** Scoped team queries and user assignments remain strictly bounded to the active organization tenant.
5. **Accessible Modal Architecture:** Centered `<Dialog size="lg">` with dark translucent blurred backdrops, autofocus management, Escape key trapping, live character count (`0 / 500`), and form validation.

---

## 2. Screen Anatomy & Layout Specification

The module route resides at `apps/ui/src/app/(dashboard)/hr/teams/page.tsx` and renders `TeamsView` (`apps/ui/src/features/hr/teams/components/TeamsView.tsx`).

### 2.1 Screen 1: Teams — Card View (With Data)

- **Page Header**:
  - Breadcrumbs: `Home / HR / Teams`
  - Title: **Teams**
  - Subtitle: _"Organizational team divisions with scoped access permissions."_
  - Primary Action: `+ New Team` (brand green button with `Plus` icon).
- **Summary Metrics (3 Stat Cards)**:
  - **Total Teams**: Large metric count with `Users` icon in blue rounded container (`bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400`).
  - **Active Teams**: Large metric count with `CheckCircle2` icon in emerald/green rounded container (`bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400`).
  - **Leads Pending**: Large metric count of teams lacking an active team lead, with `User` icon in teal rounded container (`bg-teal-50 text-teal-600 dark:bg-teal-950/60 dark:text-teal-400`).
- **Search & Status Toolbar**:
  - Search input with magnifying glass icon: _"Search teams..."_ (filters across team name, code, description, and lead).
  - Status select dropdown: `All statuses`, `Active`, `Inactive`.
- **Responsive Team Grid**:
  - 3-column layout on desktop (`lg:grid-cols-3`), 2-column on tablet (`md:grid-cols-2`), 1-column on mobile.
  - Consistent spacing, alignment, and hover shadows (`hover:shadow-theme-sm`).
- **Team Card Component (`TeamCard.tsx`)**:
  - **Top Row**:
    - Domain Icon: Styled container (`bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400`) dynamically mapped to team domain (e.g. `Laptop` for Software, `Wrench` for Mechanical, `Zap` for Electrical, `TrendingUp` for Sales, `Palette` for Design, `Users` fallback).
    - Status Badge: Accessible `StatusBadge` (`Active` with `success` token, `Inactive` with `gray` token).
  - **Primary Heading**: Team name (e.g. "Software Team", "Mechanical Team", "Electrical Team").
  - **Description**: Secondary text clamped gracefully to 2 lines (`min-h-[36px]`).
  - **Compact Details Section**:
    - `Team Code`: Monospace uppercase font (e.g. `TEAM-SW`, `TEAM-ME`, `TEAM-EE`).
    - `Team Lead`: Assigned lead name (e.g. `Super Admin`) or distinguishable pending lead (`Pending Assignment` in muted slate).
    - `Assigned Members`: Dynamic count formatted as a pill badge (e.g. `2 Members` in emerald pill `bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400`).
  - **Footer Actions**:
    - `View Team` secondary button: Opens the centered Team Details modal.
    - `...` contextual `ActionMenu` with `triggerIcon="horizontal"`:
      - _Edit Team_: Opens Team Details modal for editing.
      - _Activate / Deactivate Team_: Toggles team status with immediate feedback.
      - _Delete Team_: Opens accessible `DeleteConfirmDialog`.

### 2.2 Screen 2: Teams — Empty State

- **Unfiltered Empty State**:
  - Displayed when no teams are available in the organization.
  - Large restrained `Users` icon in circular container (`bg-blue-50 text-blue-500 dark:bg-blue-950/40 dark:text-blue-400`).
  - Heading: **No teams yet**.
  - Subtitle: _"Create your first team to organize your workforce with scoped access permissions."_
  - Primary Action: `+ New Team` CTA button.
- **Filtered Empty State**:
  - Displayed when active search or status filtering matches zero teams.
  - Heading: **No matching teams**.
  - Subtitle: _"Try adjusting your search query or status filter to find what you're looking for."_
  - Secondary Action: `Reset Filters` button.

### 2.3 Screen 3: New Team Modal

- **Interaction Pattern**: Centered `<Dialog size="lg">` with dark translucent blurred backdrop (`backdrop:bg-gray-900/60 backdrop:backdrop-blur-sm`).
- **Header**:
  - Title: **New Team**
  - Subtitle: _"Create a new team for your organization."_
  - Accessible top-right Close button.
- **Form Fields**:
  - `Team Name *`: Required text input with placeholder _"Enter team name..."_ and validation.
  - `Description`: Optional textarea with placeholder _"Enter team description..."_, maximum 500 characters, and live character counter (`0 / 500`).
  - `Active` checkbox: Checked by default, accompanied by explanatory subtext: _"Team will be active after creation."_
- **Footer Actions**:
  - `Cancel` secondary button.
  - `Create Team` primary green button.

### 2.4 Screen 4: View / Edit Team Modal (Team Details)

- **Interaction Pattern**: Centered `<Dialog size="lg">` with dark translucent blurred backdrop.
- **Header**:
  - Title: **Team Details**
  - Subtitle: _"View or update team information."_
- **Form Fields**:
  - `Team Name *`: Populated team name input.
  - `Team Code`: Read-only, disabled monospace input displaying the automatic code (e.g. `TEAM-SW`), accompanied by permanent helper text: _"Code is generated automatically and cannot be edited."_
  - `Description`: Populated textarea with live character counter (e.g. `57 / 500`).
  - `Active` checkbox: Reflects current team status with explanatory subtext: _"Team is active and available for use."_
- **Footer Actions**:
  - `Cancel` secondary button.
  - `Update Team` primary green button.

---

## 3. Data Flow & Scoped Access

- **Initial Baseline & Storage Sync:**
  The module loads teams initialized from the TexaWave seed architecture (Software, Mechanical, Electrical), persisted in local storage (`texawave_teams_data`) for session state and user mutations.
- **Correlating Members & Leads:**
  The view queries `useUsers({ page: 1, limit: 100 })` to dynamically resolve active member counts and assigned team leads from user team memberships (`user.teams`).
- **Code Generation:**
  `generateTeamCode(name)` produces deterministic uppercase codes formatted with the `TEAM-` prefix (e.g. "Software Team" → `TEAM-SW`).
- **Status Transitions:**
  Activating or deactivating teams updates the status badge, recalculates summary metrics (`Active Teams`), and notifies via `useToast()`.

---

## 4. Accessibility & Performance

- **Keyboard Trapping & Modals:** Native `<dialog>` element backing with `showModal()`, Escape key dismissal, and backdrop click handling.
- **Focus Indicators:** Visible ring outlines with brand color offsets.
- **Motion & Fluidity:** Clean transitions (180–200 ms) with complete respect for `prefers-reduced-motion`.
- **Zero Mock Polluting:** No test mocks or temporary placeholders in production bundles.
