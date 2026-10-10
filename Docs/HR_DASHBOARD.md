# TexaWave ERP — HR Dashboard & Design System Reference

**Owner:** Human Resources Engineering Team  
**Last verified:** 2026-10-08, against active codebase implementation  
**Status:** Living reference document for the HR Dashboard and shared HR Design System primitives. Companion documents: [`Docs/DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md), [`Docs/HR_API.md`](HR_API.md), [`Docs/HR_LEGACY_PARITY.md`](HR_LEGACY_PARITY.md).

---

## 1. Overview & Philosophy

The HR Dashboard serves as the central operational cockpit and telemetry console for TexaWave ERP's People Operations. It translates complex, distributed HR data streams (headcount, attendance, leave balances, recruitment throughput, helpdesk tickets, and claims) into an information-dense, highly actionable, and calm interface.

### Core Principles

1. **Restrained Enterprise ERP:** Strictly adheres to the content-driven minimalism established in `Docs/DESIGN_SYSTEM.md`. Zero visual clutter, no decorative neon gradients, and no generic placeholders.
2. **Zero Synthetic Data:** Every rendered figure derives from verified, authenticated endpoints. If a metric cannot be queried due to backend gaps (e.g. candidate application pipeline, hiring status, employee date of birth for birthdays), it is explicitly excluded or marked "Not tracked" rather than fabricated.
3. **Fail-Isolated Telemetry:** Every widget operates through its own query key. An endpoint failure isolates its error to that specific card, rendering an accessible `ErrorState` with a retry trigger, while leaving the rest of the dashboard fully functional.
4. **Build Once, Reuse Everywhere:** All foundational components introduced for the Dashboard (`StatCard`, `QuickAction`, `DashboardSection`, `DonutChart`, `Legend`, `AbsenceHeatmap`, `PipelineFunnel`, `ActivityFeed`, `GlanceSection`, `WidgetState`, `NavigationGroup`, `NavigationItem`) are designed as shared building blocks for all subsequent HR modules (Attendance, Leaves, Recruitment, Payroll, Tickets).

---

## 2. Dashboard Architecture & Layout

The dashboard occupies the main workspace of the authenticated ERP shell (`(dashboard)/hr/page.tsx` and `(dashboard)/hr/dashboard/page.tsx`), sitting alongside the leftmost ERP Primary Module Sidebar (`ErpPrimarySidebar`) and the dynamic contextual sub-navigation (`DynamicSidebar`).

### Layout Hierarchy

```
┌────────────────────────────────────────────────────────────────────────┐
│ GlobalHeader (Live IST Clock, Search, Notifications, User Profile)     │
├──────────────┬──────────────┬──────────────────────────────────────────┤
│ Primary      │ Contextual   │ MAIN WORKSPACE                           │
│ Module Nav   │ HR Nav       │                                          │
│ (ErpPrimary  │ (Dynamic     │ A. Compact Introduction Header           │
│  Sidebar)    │  Sidebar)    ├──────────────────────────────────────────┤
│              │              │ B. Workforce & Operational KPIs (Grid)   │
│              │              │    [Total] [Active] [Present] [Approvals]│
│              │              │    [Tickets] [Expenses]                  │
│              │              ├──────────────────────────────────────────┤
│              │              │ C. Quick Actions (Interactive Tiles)     │
│              │              ├──────────────────────────────────────────┤
│              │              │ D. Recruitment & Talent Pipeline         │
│              │              ├────────────────────┬─────────────────────┤
│              │              │ E. Attendance      │ F. Leave Breakdown  │
│              │              │    (Donut & Legend)│    (Donut & Legend) │
│              │              ├────────────────────┴─────────────────────┤
│              │              │ G. Absence Heatmap by Weekday            │
│              │              ├────────────────────┬─────────────────────┤
│              │              │ H. Activity Feed   │ I. Today at Glance  │
│              │              │    (Tickets/Claims)│    (Holidays/Anniv) │
└──────────────┴──────────────┴────────────────────┴─────────────────────┘
```

### Layout Sections

1. **Introduction Header:** Compact card featuring the active date context, dynamic time-of-day greeting ("Good morning / afternoon / evening"), real-time telemetry badge, and primary action buttons (`Add employee`, `Employee directory`).
2. **Workforce & Operational KPIs:** 6 responsive `StatCard` widgets displaying key telemetry: Total Registered Headcount, Active Workforce, Present Today Turnout, Pending Approvals, Open Tickets, and Pending Expense Claims.
3. **Quick Actions:** High-priority, compact action tiles linking directly to supported HR workflows (`/hr/employees/new`, `/hr/employees`, `/hr/attendance`, `/hr/leaves`, `/hr/expense-approvals`, `/hr/recruitment`).
4. **Recruitment & Talent Pipeline:** Visual funnel tracker mapping candidate progression across confirmed interview and offer stages (Scheduled → Interviewed → Selected → Offered → Hired [Not tracked]).
5. **Two-Column Analytics:**
   - **Left Column (Attendance Telemetry):** Daily attendance breakdown (Present, Absent, On Leave) using `DonutChart` + `Legend`, and a 3-week weekday absence pattern visualizer (`AbsenceHeatmap`).
   - **Right Column (Time-Off Analytics):** Categorical leave request breakdown (`DonutChart` + `Legend`) with interactive toggle between "This month" and "All time".
6. **Operational Stream & Glance:**
   - **Left Column (Operational Stream):** Combined chronological feed (`ActivityFeed`) of recent employee tickets and expense claims with status badges and timestamps.
   - **Right Column (Workforce Milestones):** `GlanceSection` displaying employees on leave today, upcoming holidays within the next 7 days, and company work anniversaries.

---

## 3. Data Contracts & Permissions Mapping

Every section is protected by permission gates (`usePermission`) ensuring users only view data they are authorized to access. Codes in the table that name a scoped family (`hr.employee.read`, `hr.attendance_report.read`, `hr.leave_request.read`, `hr.attendance_correction.read`, `hr.ticket.read`, `hr.expense_claim.read`) match **any** of its `.own`/`.team`/`.all` grants — roles are only ever granted those, never the bare code — via the owning feature's `READ_ANY_SCOPE` list:

| Section / Widget       | Endpoint(s)                                                                                  | Permission Gate                                                    | Scope / Behavior                                         |
| ---------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------- |
| Headcount KPIs         | `GET /hr/employees`                                                                          | `hr.employee.read`                                                 | Reads registered total and active status counts.         |
| Attendance KPI & Donut | `GET /hr/attendance/reports/daily?date=`                                                     | `hr.attendance_report.read`                                        | Reads daily status records (PRESENT, ABSENT, ON_LEAVE).  |
| Absence Lookback       | `GET /hr/attendance/reports/daily` (21-day Mon-Fri window)                                   | `hr.attendance_report.read`                                        | Aggregates weekday absence loads; isolates peak day.     |
| Approvals KPI          | `GET /hr/leave-requests?status=PENDING`<br>`GET /hr/attendance/corrections?status=SUBMITTED` | `hr.leave_request.read` AND `hr.attendance_correction.read`        | Sums pending leave requests and submitted corrections.   |
| Tickets KPI & Feed     | `GET /hr/tickets?status=OPEN\|IN_PROGRESS`<br>`GET /hr/tickets?page=1&limit=6`               | `hr.ticket.read`                                                   | Sums active tickets; feeds recent tickets into stream.   |
| Expenses KPI & Feed    | `GET /hr/expense-claims?status=PENDING`<br>`GET /hr/expense-claims?page=1&limit=6`           | `hr.expense_claim.read`                                            | Sums claims awaiting decision; feeds into stream.        |
| Recruitment Funnel     | `GET /hr/interviews?status=`<br>`GET /hr/offer-letters`                                      | `hr.interview.read` AND `hr.offer_letter.read`                     | Counts interviews by stage + total offer letters.        |
| Leave Breakdown        | `GET /hr/leave-requests`                                                                     | `hr.leave_request.read`                                            | Categorizes requests by leave type name for month/all.   |
| Today at a Glance      | `GET /hr/holidays?from=&to=`<br>`GET /hr/employees`<br>`GET /hr/attendance/reports/daily`    | `hr.holiday.read`, `hr.employee.read`, `hr.attendance_report.read` | Correlates leaves today, 7-day holidays, and join dates. |
| Add Employee Action    | `POST /hr/employees`                                                                         | `WRITE_TEAM_OR_ALL`                                                | Gated by `hr.employee.write` (.team or .all).            |

---

## 4. Shared Reusable UI Components

All components below live in `apps/ui/src/features/hr/components/`, are exported via `index.ts`, and are designed for consumption across all HR screens.

### 4.1 `StatCard`

- **Purpose:** Primary metric card for dashboards, summary strips, and report headers.
- **Props:**
  - `headingId: string` (Accessible ID for `aria-labelledby`)
  - `label: string` (Metric title, rendered uppercase tracking-wider)
  - `value: string | number` (Rendered via `AnimatedNumber`)
  - `note: string` (Secondary contextual info / calculation base)
  - `tone?: "neutral" | "brand" | "info" | "warning" | "error" | "success"`
  - `icon?: LucideIcon` (Rendered in matching tonal container)
  - `trend?: MetricTrendProps` (Optional trend pill)
  - `href?: string` (Optional destination with accessible stretched-link overlay)
- **States:** Hover elevation, focus-visible outline, dark mode surface substitution.
- **Accessibility:** Maintains outer `<section>` with `aria-labelledby`, ensuring accessible name matches the heading.
- **Intended Reuse:** Leave balance summaries, attendance monthly summaries, payroll disbursement cards.

### 4.2 `AnimatedNumber`

- **Purpose:** Accessible count-up transition for numeric KPI values on initial load.
- **Props:**
  - `value: number`
  - `duration?: number` (Default: 500ms)
  - `formatter?: (val: number) => string`
- **Behavior:**
  - Uses `requestAnimationFrame` with cubic ease-out (`1 - (1 - t)^3`).
  - Strict `prefers-reduced-motion` compliance: immediately renders target value without animating.
  - Zero cascading re-renders (asynchronous frame scheduling).

### 4.3 `MetricTrend`

- **Purpose:** Trend indicator pill for performance comparisons.
- **Props:**
  - `value: number | string`
  - `direction: "up" | "down" | "neutral"`
  - `label?: string`
  - `isPositive?: boolean` (Overrides default where "up" is positive)
- **Accessibility:** Distinct arrow glyph (`TrendingUp`, `TrendingDown`, `Minus`) paired with full `aria-label` text description (never color alone).

### 4.4 `QuickAction` / `QuickActionTile`

- **Purpose:** Compact interactive action card linking to frequent workflows.
- **Props:**
  - `href: string`
  - `label: string`
  - `description: string`
  - `icon?: LucideIcon`
  - `badge?: string`
  - `tone?: "brand" | "info" | "warning" | "neutral"`
- **Interaction:** Hover micro-translation on arrow icon, subtle border highlight, keyboard focus ring.
- **Intended Reuse:** Self-service portal quick links, workflow action toolbars.

### 4.5 `DashboardSection` / `SectionCard`

- **Purpose:** Standardized container card with consistent border, padding, and header hierarchy.
- **Props:**
  - `title: string`
  - `headingId: string`
  - `description?: string`
  - `icon?: LucideIcon`
  - `aside?: ReactNode` (Slot for action buttons, pills, or mode toggles)
  - `children: ReactNode`
- **Surface:** `rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900`.

### 4.6 `DonutChart` & `Legend`

- **Purpose:** Dependency-free, accessible SVG Donut Chart with interactive legend.
- **Props (`DonutChart`):**
  - `segments: DonutSegment[]` (label, value, tone)
  - `centerValue: string`
  - `centerLabel: string`
  - `label: string` (Accessible name for `role="img"`)
- **Props (`Legend`):**
  - `items: LegendItem[]` (label, value, tone, detail)
- **Accessibility:** Renders embedded `sr-only` HTML `<table>` for screen readers alongside the visual SVG donut.

### 4.7 `AbsenceHeatmap`

- **Purpose:** Weekday absence load distribution visualization.
- **Props:**
  - `days: WeekdayAbsence[]` (Mon..Fri)
- **Tones:** 4 calculated visual intensity tiers (`none`, `low`, `mid`, `high`) based on relative load against maximum absence.

### 4.8 `PipelineFunnel`

- **Purpose:** Sequential multi-stage recruitment throughput visualizer.
- **Props:**
  - `stages: PipelineStage[]` (label, count)
  - `href?: string`
- **Calculations:** Computes conversion percentages between consecutive active stages automatically.

### 4.9 `ActivityFeed`

- **Purpose:** Chronological stream of operational events (tickets and claims).
- **Props:**
  - `items: ActivityItem[]`
- **Features:** Truncated subject, employee detail, semantic type badge, and localized IST time formatting.

### 4.10 `GlanceSection`

- **Purpose:** Schedule and workforce milestone widget.
- **Props:**
  - `events: GlanceEvent[]`
- **Indicators:** Distinct color dots for Leaves (`warning`), Holidays (`chart-1`), and Anniversaries (`brand`).

### 4.11 `WidgetState`

- **Purpose:** Standardized wrapper handling loading skeletons and error boundaries with retry.
- **Props:**
  - `isPending: boolean`
  - `isError: boolean`
  - `onRetry?: () => void`
  - `label: string`
  - `skeletonHeight?: string`
- **Behavior:** Never renders zero for failed requests; isolates errors per card.

---

## 5. Navigation Enhancement (`DynamicSidebar`)

The Tier 2 contextual navigation (`apps/ui/src/components/DynamicSidebar.tsx`) has been enhanced to implement Reference C principles:

### Organizational Grouping

The 21 HR sub-navigation items are structured into 6 logical, expandable categories:

1. **Overview:** Dashboard (`/hr/dashboard`)
2. **Workforce:** Employees, Profiles, Employee Documents, Org Chart, Recruitment, Exit Requests
3. **Time & Attendance:** Attendance, Regularization, Work Logs, Location Privilege, Full Month Present
4. **Leave & Calendar:** Leaves, Holidays
5. **Operations & Claims:** Tasks, Expense Approvals, Employee Tickets, Payroll, Compliance
6. **Organization:** Departments, Teams

Each item is shown only when the user's permission-filtered menu (`GET /menu/my-menu`) contains its
`menuCode` — i.e. when the user holds that catalogue item's permission — and a category with no
visible item is hidden. See `MENU_NAVIGATION_API.md` §5.1.

### Features & Behavior

- **Collapsible Groups (`NavigationGroup`):** Each category header includes an expand/collapse toggle with a rotating chevron and active child indicator dot.
- **Route-Aware Auto-Expansion:** When the route changes, the navigation group containing the active page automatically expands so the current location is always in view.
- **Active State Highlights:** Active links display a left accent bar (`bg-brand-500`), bold font weight, and brand-tinted background (`bg-brand-50 text-brand-800`).
- **Full Keyboard Navigation:** Enter / Space toggles expandable groups; standard Tab navigation traverses items.
- **Settings Context Preservation:** If the user enters the admin or settings section, `DynamicSidebar` seamlessly swaps to the settings navigation menu.

---

## 6. Animation System

The animation system relies exclusively on lightweight CSS keyframes and transitions defined in `apps/ui/src/app/globals.css`:

```css
@keyframes pageReveal {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-reveal {
  animation: pageReveal 240ms cubic-bezier(0.16, 1, 0.3, 1) both;
}
```

### Motion Patterns

| Pattern              | Mechanism                               | Duration             | Usage                                                              |
| -------------------- | --------------------------------------- | -------------------- | ------------------------------------------------------------------ |
| **Page Reveal**      | `.animate-reveal`                       | 240ms                | Root dashboard container entrance.                                 |
| **Section Stagger**  | `.stagger-1` … `.stagger-6`             | +30ms increments     | Sequential appearance of KPI, quick actions, analytics, and feeds. |
| **Number Count-Up**  | `AnimatedNumber` (`rAF`)                | 500ms cubic ease-out | Numeric figures inside `StatCard`.                                 |
| **Card Hover**       | CSS `transition-all duration-200`       | 200ms                | Subtle border color change, shadow-sm elevation, icon scale.       |
| **Sidebar Collapse** | CSS `transition-transform duration-200` | 200ms                | Chevron rotation and height visibility toggle.                     |

### Accessibility & Reduced Motion

In compliance with WCAG guidelines:

```css
@media (prefers-reduced-motion: reduce) {
  .animate-reveal,
  .animate-fade-in {
    animation: none !important;
    transform: none !important;
  }
}
```

All keyframe animations are disabled, and `AnimatedNumber` instantly renders the final value without running animation loops.

---

## 7. Responsive Behavior

| Breakpoint                        | Layout Adaptations                                                                                                          |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Large Desktop (`≥ 1280px`)**    | 6-column KPI grid, 12-column analytics split (7/5), full multi-column quick actions.                                        |
| **Standard Desktop (`≥ 1024px`)** | 3-column KPI grid, 12-column analytics split (7/5), 3-column quick action grid.                                             |
| **Tablet (`768px – 1023px`)**     | 2-column KPI grid, single-column analytics stack, 2-column quick actions.                                                   |
| **Mobile (`< 768px`)**            | 1-column KPI cards, full-width donuts and heatmaps, single-column quick actions, compact header without badge overcrowding. |

Zero horizontal scroll overflow across all tested viewports (from 375px mobile to 1366px desktop).

---

## 8. Verification & Test Compatibility

The implementation was verified against:

- `pnpm --filter ui typecheck` (Passed with 0 errors under TypeScript strict mode).
- `pnpm --filter ui lint` (Passed clean with zero ESLint errors or warnings).
- `apps/ui/e2e/hr-dashboard.spec.ts` (All selectors, heading roles, image roles, error labels, and glance assertions preserved).
- `apps/ui/e2e/dynamic-sidebar.spec.ts` (All navigation locators `a[href='/hr/dashboard']`, `a[href='/hr/employees']`, `a[href='/hr/recruitment']` verified).
