# TexaWave ERP — HR Departments Specification

**Owner:** Human Resources Engineering Team  
**Last verified:** 2026-10-10, against active codebase implementation  
**Status:** Living reference document for HR Departments (`/hr/departments`). Companion documents: [`Docs/DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md), [`Docs/HR_EMPLOYEES.md`](HR_EMPLOYEES.md), [`Docs/HR_ORG_CHART.md`](HR_ORG_CHART.md), [`Docs/HR_API.md`](HR_API.md), [`Docs/HR_LEGACY_PARITY.md`](HR_LEGACY_PARITY.md).

---

## 1. Overview & Architectural Philosophy

The **Departments** module (`/hr/departments`) delivers enterprise-grade management of organizational departments within TexaWave ERP Production. It serves as foundational master data for organizational hierarchy, employee placement, and cross-functional grouping.

### Core Principles

1. **Zero Backend Modifications:** Operates strictly over the established REST endpoints (`/departments`, `/departments/:id`), preserving authentication, tenant isolation (`@OrgScoped`), and permission scopes (`departments.department.read`, `departments.department.write`).
2. **Deterministic Code Generation:** Automatically resolves and generates standardized department codes (e.g. `SALE`, `SOFT`, `HR`, `FIN`, `OPS`), preserving custom fields without manual user entry or frontend mismatch.
3. **Enterprise UI/UX Alignment:** Conforms to the approved 4-screen reference specification across populated lists, empty states, New Department modal, and Department Details modal.
4. **Accessible Dialog Semantics:** Uses centered `<Dialog size="lg">` with dark translucent blurred backdrops, autofocus management, Escape key trapping, and native accessible form elements.
5. **Usability & Autocomplete Protection:** Department input forms use `autoComplete="off"` to prevent browser-saved credential and address overlays from obstructing the form inputs.

---

## 2. Screen Anatomy & Layout Specification

The module resides at `apps/ui/src/app/(dashboard)/hr/departments/page.tsx` and delegates to `DepartmentsView.tsx` (`apps/ui/src/features/departments/components/`).

### 2.1 Screen 1: Departments List (With Data)

- **Page Header**:
  - Breadcrumbs: `Home / HR / Departments`
  - Title: **Departments**
  - Subtitle: _"Manage organizational departments and their active status."_
  - Primary Action: `+ New Department` primary brand button with Plus icon.
- **Search & Status Toolbar**:
  - Search input with debounced query (300 ms) and search icon: _"Search departments..."_
  - Status dropdown: `All statuses`, `Active`, `Inactive`.
  - Reset action: Resets search, status filter, and returns to page 1.
- **Enterprise Data Table**:
  - `#`: 1-based sequential row index (`(page - 1) * PAGE_SIZE + index + 1`).
  - `Department Name`: Domain-specific icon container matching department category (e.g. `Truck` for Logistics, `TrendingUp` for Sales, `Zap` for Electrical, `Cog` for Mechanical, `Code` for Software) with harmonized color palette, and bold department name.
  - `Code`: Uppercase mono department code (e.g. `SALE`, `SOFT`, `HR`, `FIN`, `OPS`).
  - `Status`: Accessible `StatusBadge` (`Active` with `success` token, `Inactive` with `gray` token).
  - `Created On`: Formatted date `DD MMM YYYY` (e.g. `15 Jan 2024`).
  - `Actions`: Contextual `ActionMenu` with `...` horizontal icon button, containing:
    - _Edit department_: Opens Department Details modal in edit mode.
    - _Delete department_: Opens accessible `DeleteConfirmDialog`.
- **Table Footer**:
  - Record counter: _"Showing X to Y of Z records"_.
  - Standard pagination controls (`< 1 2 3 >`).

### 2.2 Screen 2: Departments Empty State

- **Unfiltered Empty State**:
  - Displayed when no department records exist in the organization.
  - Features a restrained `Building2` icon in a soft neutral rounded container.
  - Heading: **No departments yet**.
  - Subtitle: _"Add your first department to organize your workforce."_
  - Primary CTA: `+ New Department`.
- **Filtered Empty State**:
  - Displayed when active search or status filters return zero results.
  - Heading: **No departments match your filters**.
  - Subtitle: _"Try searching with a different term or reset the active filters."_
  - Action: `Reset filters` button.

### 2.3 Screen 3: New Department Modal

- **Dialog Spec**: Centered native `<Dialog size="lg">` with dark translucent blurred backdrop.
- **Header**:
  - Title: **New Department**.
  - Subtitle: _"Create a new department for your organization."_
- **Fields**:
  - `Department Name *`: Required text input (1-100 chars), `autoComplete="off"`.
  - `Active` Checkbox: Checked by default, with label _Active_ and subtext _"Department will be active after creation."_
- **Actions**:
  - `Cancel` (secondary button)
  - `Create Department` (primary green brand button with pending spinner)

### 2.4 Screen 4: Edit / View Department Modal (Department Details)

- **Dialog Spec**: Centered native `<Dialog size="lg">` with dark translucent blurred backdrop.
- **Header**:
  - Title: **Department Details**.
  - Subtitle: _"View or update department information."_
- **Fields**:
  - `Department Name *`: Editable input with current department name.
  - `Department Code`: Read-only / disabled input displaying the auto-generated code, with helper hint: _"Code is generated automatically and cannot be edited."_
  - `Active` Checkbox: Controlled checkbox with label _Active_ and subtext _"Department is active and available for use."_
- **Actions**:
  - `Cancel` (secondary button)
  - `Update Department` (primary green brand button with pending spinner)

---

## 3. Data Flow, APIs & Code Generation

### 3.1 Endpoints

| Method   | Path               | Permission                     | Description                                                           |
| -------- | ------------------ | ------------------------------ | --------------------------------------------------------------------- |
| `GET`    | `/departments`     | `departments.department.read`  | Lists organizational departments with optional search and pagination. |
| `GET`    | `/departments/:id` | `departments.department.read`  | Fetches single department details.                                    |
| `POST`   | `/departments`     | `departments.department.write` | Creates a new department.                                             |
| `PATCH`  | `/departments/:id` | `departments.department.write` | Updates department name, active status, or custom fields.             |
| `DELETE` | `/departments/:id` | `departments.department.write` | Soft-deletes a department.                                            |

### 3.2 Department Code Generation

Department codes are generated automatically and deterministically via `getDepartmentCode(name, customFields)`:

1. If `customFields.code` exists as a non-empty string, it is preserved.
2. Canonical organizational abbreviations are mapped:
   - `Human Resources` / `HR` → `HR`
   - `Sales Marketing` / `Sales` → `SALE`
   - `Software` → `SOFT`
   - `Finance` → `FIN`
   - `Operations` → `OPS`
   - `Information Technology` / `IT Support` → `IT`
   - `Engineering` → `ENG`
   - `Administration` → `ADMIN`
3. Fallback: 3–4 letter uppercase prefix derived from the department name.

---

## 4. Accessibility & Performance Standards

- **Keyboard Navigation**: Dialogs capture focus upon opening and release focus on close; pressing `Escape` triggers modal dismissal without loss of background state.
- **Accessible Action Menus**: Row action triggers use `aria-haspopup="menu"`, `aria-expanded`, and descriptive `aria-label` per row.
- **Contrast & Token Compliance**: Status badges use text and theme tokens (`success`, `gray`) rather than color alone.
- **Lightweight Transitions**: Modal open/close transitions run within 180–250 ms, respecting user's `prefers-reduced-motion` settings.
