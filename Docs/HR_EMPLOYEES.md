# TexaWave ERP — HR Employees Feature Area Reference

**Owner:** Human Resources Engineering Team  
**Last verified:** 2026-10-09, against active codebase implementation  
**Status:** Living reference document for the entire HR Employees feature area: Directory (`/hr/employees`), New Hire (`/hr/employees/new`), Details & Profile (`/hr/employees/[id]` & `/hr/employees/[id]/profile`), and Onboarding (`/hr/employees/[id]/onboarding` & `/onboarding`). Companion documents: [`Docs/DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md), [`Docs/HR_DASHBOARD.md`](HR_DASHBOARD.md), [`Docs/HR_ORG_CHART.md`](HR_ORG_CHART.md), [`Docs/HR_API.md`](HR_API.md), [`Docs/HR_LEGACY_PARITY.md`](HR_LEGACY_PARITY.md).

---

## 1. Overview & Architectural Philosophy

The HR Employees module represents the unified workforce identity and personnel management engine for TexaWave ERP. It provides administrators, HR managers, and employees with four integrated operational workflows:

1. **Employee Directory (`/hr/employees`):** High-density, accessible employee directory supporting real-time search, multi-dimensional filtering, deterministic column sorting, summary telemetry, customizable row actions, and responsive layout adaptations.
2. **Create New Employee (`/hr/employees/new` & edit `/hr/employees/[id]/edit`):** Structured intake and update forms organized into clear numbered sections with live validation feedback, password requirement checklists, and copy temporary password workflow.
3. **Employee Details & Profile (`/hr/employees/[id]` & `/hr/employees/[id]/profile`):** High-fidelity identity cards with live status badges, employment details, contact details, reporting manager relationships, audit-logged status history, and audited access to statutory/bank records.
4. **Employee Onboarding (`/hr/employees/[id]/onboarding` & `/onboarding`):** Telemetry-driven onboarding readiness console mapping 25+ compliance requirements into a 6-section checklist with real-time percentage progress and step guidance.

### Core Principles

- **Zero Breaking Changes:** Preserves all backend API contracts (`/employees`, `/lookups/departments`, `/lookups/teams`, `/lookups/designations`, `/roles`, `/employee/profile`, `/hr/employees/:id/onboarding`), RBAC permissions (`READ_ANY_SCOPE`, `WRITE_TEAM_OR_ALL`, `STATUS_WRITE`, `STATUS_CORRECT`, `PROFILE_READ_ANY_SCOPE`, `ACCOUNT_WRITE`), and validation schemas.
- **Strict Architecture Compliance:** Adheres strictly to `Docs/CODING_STANDARDS.md` §4. Thin Next.js App Router files (`apps/ui/src/app/`), shared HR components in `apps/ui/src/features/hr/components/`, and domain views in `apps/ui/src/features/hr/employees/` and `apps/ui/src/features/onboarding/`. Zero rogue folders created.
- **Build Once, Reuse Everywhere:** All foundational components (`EmployeeIdentity`, `FilterChips`, `TableSkeleton`, `PasswordField`, `FormSection`) are packaged as shared building blocks reusable across Attendance, Leaves, Work Logs, Regularization, Payroll, and Tickets.

---

## 2. Screen 1: Employee Directory (`EmployeesView.tsx`)

### 2.1 Layout Structure

```
┌────────────────────────────────────────────────────────────────────────┐
│ Page Header: Title ("Employees"), Active Count Badge, "+ New employee" │
├────────────────────────────────────────────────────────────────────────┤
│ Summary Telemetry Strip (Total, Active, On Leave, In Onboarding)       │
├────────────────────────────────────────────────────────────────────────┤
│ Compact Toolbar:                                                       │
│ [ Search by name, code... ⌕ ] [ Filters (Active) ⊞ ] [ Sort by ⇅ ]     │
├────────────────────────────────────────────────────────────────────────┤
│ Expandable Filter Panel (Status, Dept, Team, Desig, Type, Loc, Dates)   │
├────────────────────────────────────────────────────────────────────────┤
│ Active Filter Chips Strip: [Dept: Software ×] [Status: Active ×] Clear │
├────────────────────────────────────────────────────────────────────────┤
│ Responsive Data Table (or TableSkeleton when query is fetching)        │
│ [Avatar + Name + Code] [Role] [Department] [Type] [Joined] [Status] [⋮] │
├────────────────────────────────────────────────────────────────────────┤
│ Pagination: Showing X-Y of Z, [Previous] [Page Numbers] [Next]        │
└────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Search & Filtering UX

1. **Compact Toolbar:** Replaces the legacy full-width permanent filter grid with a clean toolbar containing:
   - **Search Input:** Accessible `searchbox` with debounce (300ms) and one-click clear button (`X`). Matches employee name, code, or work email.
   - **Filters Toggle Button:** Displays active filter count badge (`bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300`) and toggles the drawer panel.
   - **Sort Select:** Native select supporting `employeeCode`, `fullName`, `dateOfJoining`, `status`, and `createdAt` order.
   - **Quick Clear Action:** Appears dynamically when any filter or query is active.
2. **Expandable Filter Panel:** Smooth accordion transition revealing 6 distinct dimension controls:
   - Status (multi-select / single select against canonical `EMPLOYEE_STATUSES`)
   - Department (`useLookup("departments")`)
   - Designation (`useLookup("designations")`)
   - Employment Type (`PERMANENT`, `PROBATION`, `CONTRACT`, `INTERN`)
   - Work Location (`HEADQUARTERS`, `BRANCH_OFFICE`, `REMOTE`, `HYBRID`)
   - Joining Date Range (`From` and `To` HTML5 date pickers)
3. **Active Filter Chips (`FilterChips`):**
   - Automatically computes human-readable chips for all non-empty filter parameters.
   - Clickable `×` icon removes individual filters without page reload.
   - "Clear all" button resets all active filters in one action.

### 2.3 Table & Column Hierarchy

The employee table is rendered via the shared `@texawave-erp/ui-kit` `DataTable` component:

- **Employee Column (`EmployeeIdentity`):** Renders high-contrast avatar with initials (hash-based color assignment) alongside full name and mono-styled employee code (`EMP-000001`).
- **Designation & Department:** Structured hierarchy showing primary title with department badge.
- **Employment Type:** Formatted human-readable badge with subtle background.
- **Joined Date:** Formatted localized date (`MMM D, YYYY`).
- **Status & Onboarding:** Features `EmployeeStatusBadge` and `OnboardingStatusBadge` with semantic colors (Active, Inactive, Suspended, Terminated, Resigned).
- **Actions Menu (`ActionMenu`):** Right-aligned contextual `⋯` trigger exposing "View profile", "Edit employee", and "Onboarding progress" actions without table clutter.

---

## 3. Screen 2: Create New Employee & Edit (`NewHireView.tsx` & `EmployeeForm.tsx`)

### 3.1 Information Hierarchy

To eliminate form fatigue while preserving all required fields, both create and edit forms are structured into numbered `FormSection` containers:

```
┌────────────────────────────────────────────────────────┐
│ Header: Title ("New hire"), Back to Employees action   │
├────────────────────────────────────────────────────────┤
│ 01 Personal Information                                │
│ [First Name *         ] [Last Name *         ]         │
│ [Mobile Number        ] [Email (sign-in) *   ]         │
├────────────────────────────────────────────────────────┤
│ 02 Organization                                        │
│ [Department *         ] [Team                ]         │
│ [Designation *        ] [Employment Type *   ]         │
│ [Role *               ] [Date of Joining *   ]         │
├────────────────────────────────────────────────────────┤
│ 03 Account Setup                                       │
│ [Temporary Password *                                ] │
│  👁 Toggle  |  Live Requirements Checklist             │
│  ✓ 8+ Chars  ✓ Uppercase  ✓ Lowercase  ✓ Number  ✓ Spec │
├────────────────────────────────────────────────────────┤
│ Actions: [Cancel]                     [Create new hire]│
└────────────────────────────────────────────────────────┘
```

### 3.2 Form UX & Validation Feedback

- **`PasswordField` Component:** Real-time criteria validation checklist evaluating length (8+), casing, numbers, and special symbols against the backend Zod contract.
- **Duplicate Submission Guard:** Submit button enters a disabled loading state (`isPending`) preventing double clicks.
- **Error Feedback:** Accessible `Alert` banner surfaces validation or server error messages without clearing form state.
- **Confirmation State:** Renders temporary password with a 1-click copy button upon successful creation.

---

## 4. Screen 3: Employee Details & Profile (`EmployeeDetailView.tsx` & `ProfileView.tsx`)

### 4.1 Master Employee Record (`/hr/employees/[id]`)

```
┌────────────────────────────────────────────────────────────────────────┐
│ ← Back to employees                                                    │
├────────────────────────────────────────────────────────────────────────┤
│ Hero Card: [Avatar LG] Arun Kumar (Active)                             │
│ EMP-000001 · Frontend Developer · Engineering (Software)              │
│ Joined 2026-10-01 · Headquarters · Login Active                        │
│ [Profile] [Onboarding] [Edit] [Change status] [Link/Unlink account]   │
├────────────────────────────────────┬───────────────────────────────────┤
│ Employment Details Card            │ Contact & Communication Card      │
│ • Date of joining: 2026-10-01      │ • Work email: arun@texawave.com   │
│ • Employment type: Permanent       │ • Phone: +91 9841055667           │
│ • Department: Software             │ • Quick Action: View Profile      │
│ • Reporting manager: Priya Sharma  │ • Quick Action: View Onboarding   │
├────────────────────────────────────┴───────────────────────────────────┤
│ Status History Audit Card (DataTable with change reasons & author)     │
└────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Comprehensive Profile Record (`/hr/employees/[id]/profile`)

- **Hero Card:** Avatar + Full Name + StatusBadge + Last updated timestamp + "Edit profile" action.
- **Personal Information:** Title, DOB, Gender, Marital status, Blood group, Languages spoken.
- **Family Details:** Father's name, Mother's name, Spouse name.
- **Contact & Emergency Details:** Work email, Phone, Emergency contact name, Relationship, Phone.
- **Residential Addresses:** Current Address card and Permanent Address card.
- **Prior Experience:** Fresher status, Total experience years, Previous company, Previous designation.
- **Statutory & Bank Details (Audited):** Hidden by default with an audit disclosure warning. Reveal button toggles PAN, Aadhaar, ESI, PF, Bank name, Branch, Account No, IFSC.

---

## 5. Screen 4: Employee Onboarding (`EmployeeOnboardingProgress.tsx` & `OnboardingWizard.tsx`)

### 5.1 HR Onboarding Progress Cockpit (`/hr/employees/[id]/onboarding`)

Transforms the plain text view into an enterprise onboarding telemetry console:

```
┌────────────────────────────────────────────────────────────────────────┐
│ ← Back to employee record                                              │
├────────────────────────────────────────────────────────────────────────┤
│ Employee Hero Card: [Avatar LG] Priya Sharma (In onboarding)           │
│ EMP-000002 · Senior QA Engineer · QA Team · Joined 2026-10-01          │
├────────────────────────────────────────────────────────────────────────┤
│ Onboarding Readiness: 84% Complete                                     │
│ [████████████████████░░░░] 21 of 25 requirements met · 4 of 6 complete │
├────────────────────────────────────────────────────────────────────────┤
│ Guidance Banner: Action Required from Employee via /onboarding         │
├────────────────────────────────────┬───────────────────────────────────┤
│ 1. Personal Information (✓)        │ 2. Emergency Contact (✓)          │
│ All 4 fields complete              │ All 3 fields complete             │
├────────────────────────────────────┼───────────────────────────────────┤
│ 3. Address Information (✓)         │ 4. Bank Information (◐)           │
│ All 5 fields complete              │ 3 of 4 fields complete (Missing:  │
│                                    │ IFSC code)                        │
├────────────────────────────────────┼───────────────────────────────────┤
│ 5. Statutory Information (○)       │ 6. Compliance Documents (◐)       │
│ 2 items missing: Aadhaar, PAN      │ 5 of 7 uploaded (Missing: Bank    │
│                                    │ statement, Graduation cert)       │
└────────────────────────────────────┴───────────────────────────────────┘
```

### 5.2 Canonical Onboarding Checklist Mapping

Tracks the 25 canonical items verified by the backend (`onboarding-completeness.ts`):

1. **Personal Information (4):** `dateOfBirth`, `gender`, `fatherName`, `motherName`.
2. **Emergency Contact (3):** `emergencyContactName`, `emergencyContactRelation`, `emergencyContactPhone`.
3. **Address Information (5):** `addressLine`, `district`, `city`, `state`, `pincode`.
4. **Bank Information (4):** `accountHolderName`, `accountNumberEncrypted`, `ifsc`, `bankName`.
5. **Statutory Identification (2):** `aadhaarNumber`, `panNumber`.
6. **Compliance Documents (7):** `PROFILE_PHOTO`, `AADHAAR`, `PAN`, `BANK_STATEMENT`, `CERT_10TH`, `CERT_12TH`, `CERT_GRADUATION`.

### 5.3 Self-Service Wizard (`/onboarding`)

- Multi-step progress bar showing current step index (`Step X of 6`) and completed indicator dots.
- Local state preservation per step ensuring network/validation errors never discard user entries.

---

## 6. Shared Reusable Components

All new components reside in `apps/ui/src/features/hr/components/` and are exported through the module barrel `index.ts`:

### 6.1 `EmployeeIdentity`

- **Location:** `apps/ui/src/features/hr/components/EmployeeIdentity.tsx`
- **Purpose:** Standard presentation of an employee across all HR tables, cards, work logs, and approval queues.
- **Features:**
  - Avatar initials computed from full name.
  - Consistent deterministic color palette derived from string hashing (6 distinct color pairs).
  - Sizes: `sm` (28px), `md` (36px), `lg` (48px).
  - Optional link navigation and subtitle.
- **Reuse Locations:** Employees, Attendance, Leaves, Work Logs, Regularization, Payroll, Org Chart, Tickets.

### 6.2 `FilterChip` & `FilterChips`

- **Location:** `apps/ui/src/features/hr/components/FilterChip.tsx`
- **Purpose:** Removable token indicators for active query filters with global reset.
- **Features:**
  - Compact badge style with dismiss button (`aria-label="Remove filter {label}"`).
  - Container automatically hides when no active chips are present.
  - "Clear all" action with subtle hover animation.
- **Reuse Locations:** Employees, Attendance, Leaves, Expense Approvals, Recruitment, Tickets.

### 6.3 `TableSkeleton`

- **Location:** `apps/ui/src/features/hr/components/TableSkeleton.tsx`
- **Purpose:** High-fidelity loading skeleton for tabular layouts.
- **Features:**
  - Customizable row count and column configurations.
  - Cell anatomy simulation: supports `'avatar'`, `'badge'`, `'actions'`, and standard text lines.
  - Respects user accessibility preferences (`prefers-reduced-motion`).
- **Reuse Locations:** All HR data tables and self-service lists.

### 6.4 `PasswordField`

- **Location:** `apps/ui/src/features/hr/components/PasswordField.tsx`
- **Purpose:** Enterprise-grade password input with live rule evaluation.
- **Features:**
  - Show / hide toggle with keyboard accessibility (`aria-label`).
  - Live criteria checklist matching `strongPasswordSchema` (8+ chars, upper, lower, number, symbol).
  - Smooth color and icon transition (neutral dot → green checkmark).
- **Reuse Locations:** New Hire form, Change Password modal, User Management.

### 6.5 `FormSection`

- **Location:** `apps/ui/src/features/hr/components/FormSection.tsx`
- **Purpose:** Structural containers for grouping enterprise forms into digestible numbered steps.
- **Features:**
  - Numbered badge (`01`, `02`, `03`) with accent background.
  - Title and descriptive subtext for clear user guidance.
  - Clean responsive grid layout for enclosed fields.
- **Reuse Locations:** New Hire, Employee Edit, Job Requisition, Leave Application, Onboarding Setup.

---

## 7. Animation & Interaction Specifications

All animations are hardware-accelerated, lightweight, and respect user motion settings:

| Animation            | Trigger         | Properties                               | Duration | Easing                          | Reduced Motion         |
| -------------------- | --------------- | ---------------------------------------- | -------- | ------------------------------- | ---------------------- |
| **Page Enter**       | Route mount     | `opacity: 0 → 1`, `translateY: 6px → 0`  | 200ms    | `cubic-bezier(0.16, 1, 0.3, 1)` | Instant (`opacity: 1`) |
| **Filter Accordion** | Toggle click    | `height: auto`, `opacity: 0 → 1`         | 220ms    | `cubic-bezier(0.16, 1, 0.3, 1)` | Instant display        |
| **Progress Bar**     | Progress update | `width` transition                       | 500ms    | `ease-out`                      | Instant bar width      |
| **Password Rule**    | Keyup event     | `color`, `background`, `scale: 0.95 → 1` | 150ms    | `ease-out`                      | Color change only      |
| **Chip Dismiss**     | Click `×`       | `opacity: 1 → 0`, `scale: 1 → 0.9`       | 120ms    | `ease-in`                       | Instant removal        |
| **Table Row Hover**  | Cursor enter    | `background-color` subtle tint           | 100ms    | `ease`                          | Standard hover         |

---

## 8. Accessibility & Compliance (WCAG 2.1 AA)

- **Semantic Landmark Roles:** Accessible table with `aria-label="Employees"`, accessible filter trigger button with `aria-expanded` and `aria-controls`, accessible search with `type="search"` and `aria-label="Search employees"`.
- **Keyboard Navigation:** Full tab order through toolbar, filters, individual chips, table sorting, action menu triggers, pagination buttons, and profile tabs.
- **Focus Indicators:** Explicit ring outlines (`focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-hidden`) across all interactive inputs and buttons.
- **Color Contrast:** All status badges and text tokens maintain minimum 4.5:1 contrast against light and dark background surfaces.
- **Screen Reader Announcements:** Form validation alerts and active filter counts announce errors and changes via live regions.
