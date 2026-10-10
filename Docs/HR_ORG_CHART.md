# TexaWave ERP — HR Org Chart Specification

**Owner:** Human Resources Engineering Team  
**Last verified:** 2026-10-09, against active codebase implementation  
**Status:** Living reference document for the HR Organization Chart (`/hr/org-chart`). Companion documents: [`Docs/DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md), [`Docs/HR_EMPLOYEES.md`](HR_EMPLOYEES.md), [`Docs/HR_DASHBOARD.md`](HR_DASHBOARD.md), [`Docs/HR_API.md`](HR_API.md), [`Docs/HR_LEGACY_PARITY.md`](HR_LEGACY_PARITY.md).

---

## 1. Overview & Architectural Philosophy

The HR Organization Chart (`/hr/org-chart`) delivers a responsive, visual reporting hierarchy of the workforce visible to the authenticated user. It translates nested tree data returned by `GET /hr/org-chart` into an interactive tree visualization designed for quick scanning, reporting relationship auditing, and personnel telemetry.

### Core Principles

1. **Hierarchy as Primary Focus:** Replaces empty cards with a clear parent-child structure connected by unbroken tree lines. Instantly answers "Who reports to whom?", "Which team/department does each person belong to?", and "How many direct reports are managed?".
2. **Zero Backend Modifications:** Operates entirely over the existing backend endpoints (`GET /hr/org-chart` and `GET /hr/employees/:id`), preserving all role-based scoping (`all`, `team`, `own`), cycle prevention, and permission boundaries (`hr.employee.read`).
3. **Component Reusability:** Leverages canonical shared HR primitives (`EmployeeIdentity`, `EmployeeStatusBadge`, `@texawave-erp/ui-kit`), ensuring visual consistency across Employees, Attendance, Leaves, Work Logs, and Directory.
4. **Lightweight Pure-CSS Rendering:** Avoids heavy third-party canvas or SVG dependencies. Connector lines, expand/collapse transitions, and branch layouts use semantic HTML `<ul>`/`<li>` lists and CSS layout geometry for top performance across large organizations.
5. **Non-Destructive Filtering:** Free-text search and department filters operate without re-fetching or destroying tree context; matching nodes are highlighted and their ancestor branches are automatically expanded so search hits are never hidden.

---

## 2. Page Architecture & Layout

The Org Chart page resides at `apps/ui/src/app/(dashboard)/hr/org-chart/page.tsx` and delegates to `OrgChartView.tsx` in `apps/ui/src/features/hr/org-chart/components/`.

### 2.1 Layout Structure

```
┌────────────────────────────────────────────────────────────────────────┐
│ Page Header: Title ("Org chart"), Member Count, Subtitle              │
├────────────────────────────────────────────────────────────────────────┤
│ Compact Toolbar Card:                                                  │
│ [ Search by name, code... ⌕ ] [ All departments ▼ ]                    │
│ [ Zoom − ] [ 100% ] [ Zoom + ]  [ Collapse all ] [ Expand all ]        │
├────────────────────────────────────────────────────────────────────────┤
│ Hierarchy Canvas (Dot-grid texture, pan/scroll viewport):              │
│                                                                        │
│                       ┌─────────────────────┐                          │
│                       │    Managing Dir     │                          │
│                       │   EMP-000001 (Active)│                          │
│                       └──────────┬──────────┘                          │
│                                  │                                     │
│               ┌──────────────────┴──────────────────┐                  │
│               │                                     │                  │
│       ┌───────▼───────┐                     ┌───────▼───────┐          │
│       │ Eng Manager   │                     │ Operations Dir│          │
│       │ [2 reports] ▾ │                     │ [0 reports]   │          │
│       └───────┬───────┘                     └───────────────┘          │
│         ┌─────┴─────┐                                                  │
│   ┌─────▼───┐ ┌─────▼───┐                                              │
│   │ Dev A   │ │ Dev B   │                                              │
│   └─────────┘ └─────────┘                                              │
├────────────────────────────────────────────────────────────────────────┤
│ Slide-Out Drawer (Appears when node clicked):                          │
│  - Full Identity & Status                                              │
│  - Reporting Chain Telemetry                                           │
│  - Organization & Contact Details                                      │
│  - "View full profile" Action                                          │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Hierarchy Visualization & Tree Connectors

### 3.1 Pure-CSS Tree Layout (`OrgTree.tsx`)

Hierarchy branches are rendered as nested semantic lists (`<ul>` and `<li>`), ensuring keyboard accessibility and screen-reader navigable document structure:

1. **Manager Trunk Line:** A centered vertical drop line (`w-px h-6 bg-neutral-300 dark:bg-neutral-700`) descends from the manager card to the horizontal sibling bus.
2. **Sibling Cross-Branch Line:** A horizontal line connecting children:
   - First child: connects from center rightward (`left-1/2 right-0`).
   - Last child: connects from center leftward (`left-0 right-1/2`).
   - Middle children: spans full width (`left-0 right-0`).
   - Single child: omits horizontal span and drops vertically straight down.
3. **Child Drop Line:** An upper vertical line on each child node (`h-6 w-px`) connects from the horizontal line into the child card's top anchor.

### 3.2 Zoom & Viewport Canvas

- **Canvas Background:** Subtle radial dot pattern (`[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:[radial-gradient(#262626_1px,transparent_1px)]`) providing depth and context.
- **Zoom Scale:** Stepped hardware-accelerated CSS transform (`scale(0.5)` to `scale(1.5)` in increments of 0.15) with `transform-origin: top center`.
- **Reset to 100%:** Instant one-click reset to default 1.0 scale.
- **Scrollable Container:** Horizontal and vertical native kinetic overflow scrolling with accessible focus.

---

## 4. Employee Node Card Anatomy (`OrgNodeCard.tsx`)

Every node in the tree is rendered as an interactive, compact card adhering strictly to the TEXA design system:

```
┌──────────────────────────────────────────────────────────┐
│ [Avatar]  Arun Kumar                           [Active]  │
│           EMP-000002                                     │
│                                                          │
│           Senior Frontend Engineer                       │
│           Engineering · Frontend                         │
│                                                          │
│           👥 3 direct reports                        [▾] │
└──────────────────────────────────────────────────────────┘
```

### Component Breakdown

1. **Avatar & Identity:** Reuses the shared `EmployeeIdentity` component (`apps/ui/src/features/hr/components/EmployeeIdentity.tsx`) for deterministic avatar initials and color styling.
2. **Employee Code & Name:** Primary bold title with secondary monospace code badge.
3. **Status Indicator:** Small colored dot with label (`Active`, `Inactive`, etc.).
4. **Designation & Department:** Structured hierarchy caption (`Designation` on line 1, `Department · Team` on line 2).
5. **Direct Report Pill:** Displays report count (`X direct reports`) when `directReportCount > 0`.
6. **Expand/Collapse Pill:** Interactive trigger allowing branches to be folded without opening the inspection drawer.
7. **Active Selection State:** Highlighted border with primary tint (`ring-2 ring-brand-500 border-brand-500 shadow-md`) when selected.
8. **Search Match Highlight:** Amber accent ring and subtle golden glow (`ring-2 ring-amber-400 border-amber-300`) when matching search criteria.

---

## 5. Toolbar Controls & Search Behavior

The compact toolbar (`OrgChartView.tsx`) provides high-density controls without consuming vertical canvas real estate:

1. **Search Input (`role="searchbox"`):**
   - Live debounced search across `fullName`, `employeeCode`, and `designation`.
   - Displays real-time matching node count badge (`"3 matches"`).
   - "Clear search" quick button (`X`).
   - **Auto-Expansion:** Automatically computes and expands all ancestor nodes of matches (`collectAncestorsOfMatches`), guaranteeing search hits are never concealed behind collapsed branches.
2. **Department Filter (`role="combobox"`):**
   - Populated dynamically via `useDepartments()` lookup.
   - Refetches hierarchy for the selected department scope via `GET /hr/org-chart?departmentId=:id`.
3. **Zoom Controls:**
   - Zoom Out (`−`), Zoom Reset (`100%`), and Zoom In (`+`).
   - Bounds: `50%` min, `150%` max.
4. **Branch Expand / Collapse:**
   - "Expand all": Clears the collapsed set, revealing the entire tree.
   - "Collapse all": Populates the collapsed set with all manager node IDs, folding all branches up to root managers.

---

## 6. Slide-Out Employee Detail Drawer (`EmployeeDetailDrawer.tsx`)

Clicking any node card opens the enterprise inspection drawer:

### Drawer Architecture

1. **Overlay & Dialog:** Dark backdrop overlay with accessible `role="dialog"` and `aria-modal="true"`.
2. **Keyboard Dismiss:** Closes immediately on `Escape` keypress or clicking the backdrop overlay.
3. **Live Telemetry Query:** Fetches full employee profile details via `useEmployee(node.id)` to enrich tree nodes with email, phone, joining date, and reporting manager name.
4. **Hero Header:**
   - Large `EmployeeIdentity` avatar and heading.
   - Status badge using shared `EmployeeStatusBadge`.
   - Designation and Department/Team subtitle.
5. **Reporting Structure Section:**
   - Direct reports count.
   - Manager card showing direct reporting supervisor.
6. **Organization & Contact Details:**
   - Department, Team, Designation.
   - Email address, Contact phone, Date of joining.
7. **Primary Action Link:**
   - Accessible button linking to `/hr/employees/${node.id}/profile` ("View full profile").

---

## 7. State Handling & Edge Cases

| State                 | Component / UI Trigger                | Behavior                                                                                    |
| --------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------- |
| **Loading**           | `chart.isPending`                     | Skeletons mirroring manager + child cards connected with placeholder lines.                 |
| **Error (Generic)**   | `chart.isError` (500, network)        | Clean `ErrorState` card with accessible `Retry` action.                                     |
| **Error (Forbidden)** | `chart.error.isPermissionError` (403) | `Alert` banner with exact message: _"You don't have access to this part of the org chart"_. |
| **Empty (Overall)**   | `chart.data` is empty                 | `EmptyState` explaining that no employees exist to display.                                 |
| **Empty (Filtered)**  | No matches for dept/search            | `EmptyState` with a "Clear filters" action button.                                          |
| **No Children**       | Node with 0 reports                   | Omits expand/collapse trigger and bottom connector line.                                    |

---

## 8. Accessibility & Compliance (WCAG 2.1 AA)

- **Semantic Tree Roles:** Rendered as nested HTML `<ul>` and `<li>` items.
- **Card Interactive Role:** Rendered as an accessible `<button>` element with descriptive `aria-label="View [Name]'s details"`.
- **Accessible Drawer:** Standard modal dialog pattern (`role="dialog"`, `aria-modal="true"`, `aria-label="Employee details"`, focus trapping, `Escape` key close).
- **Search Accessibility:** `type="search"`, labeled with `aria-label="Search org chart"`.
- **Department Select:** Native `<select>` element labeled with `aria-label="Filter by department"`.
- **Keyboard Navigation:** Full Tab, Enter, Space, and Escape navigation support across all controls.
- **Reduced Motion:** All transitions (`scale`, `slide-in`, `hover`) respect `prefers-reduced-motion: reduce`.
