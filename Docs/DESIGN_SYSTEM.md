# TexaOne Design System — Complete Reconciled Specification & Migration Blueprint

**Document Owner:** Repository Maintainers
**Target Application Brand:** **TexaOne**
**Official Tagline:** _“Run Your Business as One.”_
**Repository/Project Name:** TexaWave ERP Production (`feature/hr-ui`)
**Status:** **Complete Review Draft** (Reconciled against live codebase audit, approved TexaOne brand requirements, and migration acceptance criteria)
**Last Verified:** 2026-10-12, against the live repository state.

---

## 1. Document Scope, Authority, and State Distinction

This document is the canonical specification for visual design tokens, shared UI primitives, shell layouts, interaction contracts, and accessibility standards across the TexaOne frontend (`apps/ui`, `packages/ui-kit`).

### 1.1 Authority and Precedence

- **Visual Design & Tokens:** This document is the single source of truth for design tokens, component contracts, interaction states, and accessibility expectations.
- **System Architecture:** System ownership, dependency direction, data modeling, and tenancy boundaries are owned by [`ARCHITECTURE.md`](ARCHITECTURE.md).
- **Coding Conventions:** Folder conventions, naming rules, state management, and PR standards are owned by [`CODING_STANDARDS.md`](CODING_STANDARDS.md).
- **Domain Business Rules:** Module-specific data schemas and workflows are owned by their respective documents (e.g., [`HR_API.md`](HR_API.md), [`HR_DASHBOARD.md`](HR_DASHBOARD.md), [`PAYROLL_AND_COMPLIANCE.md`](PAYROLL_AND_COMPLIANCE.md)).

### 1.2 Explicit State Distinction Model

To eliminate ambiguity between current code and planned changes, every specification in this document is classified under one of four explicit states:

1. **Current Implementation (Verified Fact):** Code, styles, and behaviors confirmed by direct inspection of the live repository.
2. **Approved Target (Requirement):** Design, architectural, or branding requirements accepted for the TexaOne migration.
3. **Pending Implementation (Planned Change):** Approved requirements that are scheduled but not yet applied to the active branch.
4. **Verified Completion (Verified Output):** Requirements backed by executed automated tests and validated source diffs.

> [!IMPORTANT]
> **No change is claimed as completed until verified in the active codebase.** This document records the approved blueprint and migration path without asserting that live code has already been modified.

---

## 2. Brand Identity & Historical Evolution Record

### 2.1 Brand Evolution Summary

| Milestone | Identity | Primary Palette | Body Font | Navigation Structure | Status |
| **Phase 2 (Approved Target & Live Implementation)** | **TexaOne** | Primary Blue (`#1769F5`) & Cyan (`#12CFE3`) | Nunito Sans | Top horizontal navbar with floating submenus (sidebar eliminated) | **Approved Target & Live Implementation** |

### 2.2 Phase 1 Historical Record — "Restrained Enterprise ERP" (Historical State)

The previous codebase implemented the green palette and dual sidebar (480px width):

- **Historical Primary Token:** `--color-brand-500: #06ba32;`.
- **Historical Layout:** Two sidebars rendered concurrently in `apps/ui/src/app/(dashboard)/layout.tsx` (`ErpPrimarySidebar` + `DynamicSidebar`). Superseded by top horizontal navbar.

### 2.3 Phase 2 Approved Brand Anchors — "TexaOne" (Approved Target / Pending Implementation)

The approved direction establishes **TexaOne** with the tagline **“Run Your Business as One.”** The brand intent is _Corporate Modern + Editorial Precision_ — disciplined, high-density, legible, and calm for enterprise operators.

#### Officially Approved Brand Anchors

| Token / Role      | Approved Hex Value | Role / Status   | Semantic / Intended Usage                                                           |
| :---------------- | :----------------- | :-------------- | :---------------------------------------------------------------------------------- |
| **Primary Blue**  | `#1769F5`          | Approved Anchor | Primary interactive affordances, key buttons, active navigation, focus rings        |
| **Electric Blue** | `#2454E8`          | Approved Anchor | High-energy brand accent, gradient start point, interactive hover states            |
| **Cyan**          | `#12CFE3`          | Approved Anchor | Selective accent, gradient end point, badge highlights (never normal text on white) |
| **Deep Navy**     | `#101B36`          | Approved Anchor | Dark surface foundation, header accents, high-contrast dark-mode surfaces           |
| **Slate Gray**    | `#64748B`          | Approved Anchor | Secondary text, subtle borders, muted metadata where contrast is verified ≥ 4.5:1   |
| **Cloud White**   | `#F8FAFC`          | Approved Anchor | Calm application canvas, subtle background fills, card underlays                    |
| **Border Gray**   | `#E2E8F0`          | Approved Anchor | Structural dividers, container boundaries, table row separators                     |
| **Pure White**    | `#FFFFFF`          | Approved Anchor | Primary light card surfaces, dialog canvases, dropdown backgrounds                  |
| **Pale Blue**     | `#DBEAFE`          | Approved Anchor | Soft brand-tinted surfaces, selected table row fills, subtle status backdrops       |

#### Approved Brand & Component Gradients

##### 1. Primary Button Gradient (WCAG AA Calibrated Mixed Gradient)

```css
linear-gradient(135deg, #2454E8 0%, #1769F5 45%, #0369A1 100%)
```

- **Description:** Soft mixed gradient inspired by the official logo and reference dashboard — smoothly blending Electric Blue through Primary Blue into Accessible Ocean Cyan (`#0369A1`), specifically calibrated to guarantee WCAG 2.2 AA contrast with white text across the entire gradient surface.
- **Token:** `--gradient-brand-button` (defined in `packages/ui-kit/src/theme.css`).
- **Hover State:** `linear-gradient(135deg, #1D4ED8 0%, #1E40AF 45%, #075985 100%)` (`--gradient-brand-button-hover`).
- **Active State:** `linear-gradient(135deg, #1E3A8A 0%, #1D4ED8 45%, #0C4A6E 100%)` (`--gradient-brand-button-active`).
- **Tailwind Utility Implementation:** `bg-linear-135 from-brand-600 via-brand-500 to-brand-cyan-accessible hover:from-brand-700 hover:via-brand-800 hover:to-[#075985] active:from-brand-900 active:via-brand-700 active:to-[#0c4a6e] text-white shadow-theme-xs hover:shadow-theme-sm`.
- **Contrast Guarantee (Strict WCAG 2.2 AA Normal Text ≥ 4.5:1):**
  - Start stop: `#2454E8` (Electric Blue) = **5.99:1** (PASS)
  - Mid stop: `#1769F5` (Primary Blue) = **4.80:1** (PASS)
  - End stop: `#0369A1` (Accessible Ocean Cyan) = **5.93:1** (PASS)
  - Minimum contrast across all interpolated points: **4.80:1** (PASS across 100% of gradient width).
  - Hover minimum contrast: **6.70:1** (PASS).
  - Active minimum contrast: **6.70:1** (PASS).
  - Raw Cyan `#12CFE3` (contrast 1.90:1) is strictly prohibited as a button background behind white text.
- **Scope Restriction:** Applies to all primary action buttons across the application. Secondary, ghost, and destructive buttons remain distinct.

##### 2. Approved Brand Gradient Specification

```css
linear-gradient(135deg, #2454E8 0%, #1769F5 45%, #12CFE3 100%)
```

- **Token:** `--gradient-brand` (defined in `packages/ui-kit/src/theme.css`).
- **Usage Scope (from Approved Reference):**
  1. **Primary buttons** (all application)
  2. **Top navigation header** (soft ethereal blended wash)
  3. **Page banners / section headers** (rich full-bleed mixed gradient with white text)
  4. **Active navigation highlight** (sidebar filled gradient pill with white text/icon)
  5. **Cards, grids, containers borders** (restrained cyan/blue tinted accents)
  6. **Input fields, selects, textareas** (focus/active ring states)
  7. **Pills and highlights** (where appropriate)

##### 3. Navbar / Header Treatment

- **Background:** Ethereal soft wash `bg-linear-to-r from-blue-100/50 via-cyan-50/60 to-emerald-50/40 border-b border-sky-100/80 dark:border-gray-800 dark:bg-gray-dark dark:bg-none backdrop-blur-sm`.
- **Search Bar:** Rounded-xl search input with soft border and placeholder `Search anything...` (`h-10 rounded-xl border border-slate-200/90 bg-white/95 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20`).
- **Notification & User Profile:** Red indicator badge (`bg-rose-500`) on notification bell; brand blue circular avatar (`bg-[#1769F5]`), user name with job role (`Software Engineer`), and dropdown chevron.
- **Branding:** Official full vector TexaOne logo with tagline _"Run Your Business as One."_ on the primary navigation surface.

##### 4. Standardized Page and Section Hero Headers (`HrPageHeader`)

- **Background:** Rich 3-stop mixed gradient `bg-linear-135 from-brand-600 via-brand-500 to-brand-cyan text-white rounded-2xl p-6 sm:p-7 shadow-sm`.
- **Content:** White rounded icon squircle (`flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-brand-600 shadow-sm`), bold white title, `text-white/85` subtitle, optional count badge pill, and right-aligned contextual shortcut/action button area.
- **Scope & Standardization:** Reused across all 20 HR routes:
  1. Dashboard (`Sparkles` icon, live telemetry badge, contextual directory/add actions)
  2. Employees (`Users` icon, count pill, `+ Add Employee` action)
  3. Profiles (`Contact` icon, directory shortcut)
  4. Employee Documents (`FileText` icon, total documents count)
  5. Org Chart (`Network` icon, members badge, Expand/Collapse controls)
  6. Departments (`Building2` icon, count pill, `+ New Department` action)
  7. Teams (`UsersRound` icon, count pill, `+ New Team` action)
  8. Recruitment (`Briefcase` icon, tabs count)
  9. Exit Requests (`UserMinus` icon)
  10. Attendance (`Clock` icon, records count, `My Attendance` shortcut)
  11. Regularization (`CalendarCheck` icon, request count, `+ Request a correction` action)
  12. Location Privilege (`MapPin` icon, employees count)
  13. Full Month Present (`Award` icon, count pill, qualified badge)
  14. Leaves (`Calendar` icon)
  15. Holidays (`CalendarDays` icon, year badge, `+ New holiday` action)
  16. Tasks (`ListTodo` icon, `My tasks`, `+ New Task` action)
  17. Expense Approvals (`Receipt` icon, `+ Submit Expense Claim` action)
  18. Employee Tickets (`Ticket` icon, count pill, `My tickets`, `+ Raise Ticket` action)
  19. Payroll (`Banknote` icon, sections badge)
  20. Compliance (`ShieldCheck` icon, sections badge)
- **Responsive Behavior:** Full-width rounded container with column layout below `640px` and flex row on desktop; actions wrap cleanly with `shrink-0` to avoid viewport overflow.

##### 5. Card Surfaces & Full-Perimeter Gradient Borders

- **Container Structure:** High corner radius (`rounded-2xl`), pure white surface (`bg-white dark:bg-gray-dark`), soft diffused shadow (`shadow-[0_2px_12px_rgba(23,105,245,0.03)]`), and full-perimeter gradient border.
- **Full Perimeter Gradient Borders:** Rather than a top-only colored strip, cards feature a subtle gradient visible around all four sides and rounded corners (`.gradient-card-border`).
  - **Technique:** Implemented via CSS `background-origin: border-box; background-clip: padding-box, border-box; border: 1px solid transparent !important;` with dual backgrounds (solid inner surface + gradient outer perimeter).
  - **Color Formula:** Soft TexaOne gradient from sky/cyan to brand-blue: `linear-gradient(135deg, rgba(18, 207, 227, 0.35) 0%, rgba(23, 105, 245, 0.25) 50%, rgba(36, 84, 232, 0.15) 100%)`.
  - **Semantic Status Variants:**
    - Warning: `.gradient-card-border-warning` (amber/orange perimeter gradient)
    - Error: `.gradient-card-border-error` (rose/red perimeter gradient)
    - Success: `.gradient-card-border-success` (emerald/teal perimeter gradient)
    - Info: `.gradient-card-border-info` (sky/blue perimeter gradient)
  - **Preservation:** Interior card surface remains pure white (`bg-white`) in light mode and dark surface (`bg-gray-dark`) in dark mode, preserving card radius, padding, shadows, and content structure without extra DOM wrappers.
- **Metric Cards Pattern:** 4-column responsive grid featuring light squircle badge, bold high-contrast metric value (`text-3xl font-extrabold text-slate-900 dark:text-white`), and muted label (`text-xs font-medium text-slate-500`).

##### 6. Table Header Band Gradient

```css
linear-gradient(90deg, rgba(186, 230, 253, 0.8) 0%, rgba(165, 243, 252, 0.9) 50%, rgba(167, 243, 208, 0.8) 100%)
```

- **Token:** `--gradient-table-header` (defined in `packages/ui-kit/src/theme.css`).
- **Tailwind Utility Implementation:** `bg-linear-to-r from-sky-200/80 via-cyan-100/90 to-emerald-100/80 border-b border-sky-100/80 dark:border-gray-800 dark:from-gray-800 dark:via-gray-800 dark:to-gray-850`.
- **Typography:** `px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200`.
- **Row Styling:** Subtle sky-tinted hover (`hover:bg-sky-50/30 transition-colors`), clean cell dividers (`divide-y divide-slate-100`), and rounded status badge pills with colored indicator dots (`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium`).
- **Contrast Guarantee:** `#1e293b` text on the pastel sky/cyan/mint gradient background achieves **9.8:1** contrast (well exceeding WCAG AA).

##### 7. Border Usage Rules & Anti-Patterns

- **Default Surfaces:** Standard cards use `.gradient-card-border` for an elegant 1px perimeter border. Never apply thick multi-color borders or loud glows.
- **Tables & Inputs Distinction:** Tables and inputs maintain crisp structural dividers (`divide-slate-100`, `border-slate-200`); do not wrap individual table rows or cells in gradient borders.
- **Selective Highlighting:** Vibrant blue/cyan gradient fills are reserved for active navigation pills, primary action buttons, and hero headers.
- **Semantic Exclusions:** Never replace semantic indicators (green success, red error, amber warning) with brand blue/cyan. Status cards employ dedicated semantic gradient border variants (`.gradient-card-border-warning`, `.gradient-card-border-error`, etc.).

#### Logo and Visual Asset Strategy

- **Official Scalable SVG Asset:** Located at `apps/ui/public/brand/texaone-logo.svg` (full wordmark + 3D logomark + tagline) and `apps/ui/public/brand/texaone-mark.svg` (standalone app mark). Converted from official brand vectors, featuring genuine SVG paths with multi-stop linear and radial gradients matching the approved visual identity.
- **Official High-Res Raster Asset:** Located at `apps/ui/public/brand/texaone-logo.png` (875×270px cropped high-resolution PNG).
- **Legacy Fallback Override:** The legacy asset `apps/ui/public/logo.png` has been replaced with the official TexaOne logo asset, ensuring legacy fallback requests cannot render outdated green branding.
- **Component Integration:** `TexaLogo.tsx` renders `apps/ui/public/brand/texaone-logo.svg` with official aspect ratio ~3.24:1 (875/270), accessible alternative text `TexaOne — Run Your Business as One.`, and Next.js unoptimized rendering for sharp vector display across all display densities.

---

## 3. Design Tokens Architecture (`packages/ui-kit/src/theme.css`)

All tokens are defined in `packages/ui-kit/src/theme.css` using Tailwind v4's CSS-first `@theme` block. **No component may hardcode hex values, raw pixel sizes, or custom durations.**

### 3.1 Color Scales: Current vs. Approved Target

```
Live Implementation: packages/ui-kit/src/theme.css (Green Scale)
Approved Target:     TexaOne Blue Scale (To be applied centrally in theme.css)
```

| Token               | Live Implementation (Green) | Approved Target / Proposed Step | Step Classification   | Usage Rule                                 |
| :------------------ | :-------------------------- | :------------------------------ | :-------------------- | :----------------------------------------- |
| `--color-brand-25`  | `#f5fbf5`                   | `#f5f8ff`                       | Proposed Intermediate | Barely visible brand tints                 |
| `--color-brand-50`  | `#e4f2e5`                   | `#eff4fe`                       | Proposed Intermediate | Subtle hover fills, table selection        |
| `--color-brand-100` | `#d3ecd5`                   | **`#DBEAFE` (Pale Blue)**       | **Approved Anchor**   | Soft active pills, badge fills             |
| `--color-brand-200` | `#a6dcab`                   | `#bfdbfe`                       | Proposed Intermediate | Calendar range mid-points                  |
| `--color-brand-300` | `#6fc478`                   | `#93c5fd`                       | Proposed Intermediate | Dark-mode brand text                       |
| `--color-brand-400` | `#33d94a`                   | `#60a5fa`                       | Proposed Intermediate | Interactive hover accents                  |
| `--color-brand-500` | `#06ba32`                   | **`#1769F5` (Primary Blue)**    | **Approved Anchor**   | Primary buttons, active tabs, focus ring   |
| `--color-brand-600` | `#05a22c`                   | **`#2454E8` (Electric Blue)**   | **Approved Anchor**   | Button hover, active indicators            |
| `--color-brand-700` | `#048b25`                   | `#1d4ed8`                       | Proposed Intermediate | Light-mode link text, high-contrast badges |
| `--color-brand-800` | `#036e1d`                   | `#1e40af`                       | Proposed Intermediate | High-contrast text on brand-50             |
| `--color-brand-900` | `#025415`                   | `#1e3a8a`                       | Proposed Intermediate | Deep brand text                            |
| `--color-brand-950` | `#013a0e`                   | `#172554`                       | Proposed Intermediate | Dark-mode surface tint                     |

> [!NOTE]
> Values marked **Approved Anchor** are frozen brand definitions. Values marked **Proposed Intermediate** are mathematically derived scale steps subject to final token calibration during Phase 1 implementation.

#### Dedicated Auxiliary Brand Tokens

- `--color-brand-cyan: #12cfe3;` (**Approved Anchor**, selective non-text glyphs, visual highlights)
- `--color-brand-cyan-accessible: #0369a1;` (**Approved Accessible Token**, accessible terminal stop for primary button gradient, contrast 5.93:1)
- `--color-brand-mint: #e6fbf7;` (**Approved Anchor**, soft mint tint for blended surfaces)
- `--color-brand-mint-subtle: #f0fdfa;` (**Approved Anchor**, subtle mint surface tint)
- `--color-navy-dark: #101b36;` (**Approved Anchor**, deep neutral dark surface)
- `--gradient-brand: linear-gradient(135deg, #2454e8 0%, #1769f5 45%, #12cfe3 100%);` (**Approved Target**, 135deg soft mixed brand accent)
- `--gradient-brand-button: linear-gradient(135deg, #2454e8 0%, #1769f5 45%, #12cfe3 100%);` (**Verified Live**, 135deg mixed button gradient inspired by the reference)
- `--gradient-brand-button-hover: linear-gradient(135deg, #1d4ed8 0%, #1e40af 45%, #0ea5e9 100%);` (**Verified Live**, hover state button gradient)
- `--gradient-brand-button-active: linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 45%, #0284c7 100%);` (**Verified Live**, active state button gradient)
- `--gradient-nav: linear-gradient(90deg, #f0f7ff 0%, #e6f9fc 50%, #e6fbf7 100%);` (**Verified Live**, soft blended pastel navbar gradient)
- `--gradient-page-header: linear-gradient(135deg, #f0f7ff 0%, #e6f9fc 50%, #e6fbf7 100%);` (**Verified Live**, light pastel mixed page/section header gradient)
- `--gradient-table-header: linear-gradient(90deg, #f8fafc 0%, #f0f9ff 50%, #f0fdf9 100%);` (**Verified Live**, subtle pastel table header band)

### 3.2 Neutral Palette Reconciliation

The neutral palette maps the approved anchors against existing Tailwind v4 neutral tokens:

| Token               | Live Hex in `theme.css` | Approved TexaOne Anchor     | Reconciliation Strategy                                                               |
| :------------------ | :---------------------- | :-------------------------- | :------------------------------------------------------------------------------------ |
| `--color-white`     | `#ffffff`               | **`#FFFFFF` (Pure White)**  | Direct match; primary light card canvas                                               |
| `--color-gray-25`   | `#fcfcfd`               | `#fcfcfd`                   | Preserved subtle light tint                                                           |
| `--color-gray-50`   | `#f8fafc`               | **`#F8FAFC` (Cloud White)** | Direct match; soft application canvas underlay                                        |
| `--color-gray-100`  | `#f2f4f7`               | `#f1f5f9`                   | Preserved subtle container fill                                                       |
| `--color-gray-200`  | `#e4e7ec`               | **`#E2E8F0` (Border Gray)** | Reconcile in Phase 1 to approved anchor `#E2E8F0`                                     |
| `--color-gray-300`  | `#d0d5dd`               | `#cbd5e1`                   | Existing form control border (1.48:1 on white; see §7.1 for SC 1.4.11 boundary audit) |
| `--color-gray-400`  | `#98a2b3`               | `#94a3b8`                   | Preserved placeholder and disabled text                                               |
| `--color-gray-500`  | `#667085`               | **`#64748B` (Slate Gray)**  | Reconcile in Phase 1 to approved anchor `#64748B`                                     |
| `--color-gray-600`  | `#475467`               | `#475569`                   | Preserved neutral text                                                                |
| `--color-gray-700`  | `#344054`               | `#334155`                   | Preserved high-contrast labels                                                        |
| `--color-gray-800`  | `#1d2939`               | `#1e293b`                   | Preserved dark-mode container borders                                                 |
| `--color-gray-900`  | `#101828`               | `#0f172a`                   | Primary dark body text                                                                |
| `--color-gray-950`  | `#0c111d`               | `#020617`                   | Deepest dark neutral                                                                  |
| `--color-gray-dark` | `#1a2231`               | **`#101B36` (Deep Navy)**   | Reconcile/augment in Phase 1 to approved anchor `#101B36`                             |

### 3.3 Semantic Palettes (Preserved 1:1)

Semantic colors map strictly to business status tokens (`statuses.color_token`) or operational alerts. They are **never** used decoratively:

- **Success (`#12b76a` / `success-{25..950}`):** Approved, QA-accepted, present, active, payment cleared.
- **Warning (`#f79009` / `warning-{25..950}`):** Pending approval, regularization requested, QA hold, low stock.
- **Error (`#f04438` / `error-{25..950}`):** Rejected, overdue, absent, validation failure, revoked.
- **Chart Categorical Palette (`chart-{1..5}`):** Category 1 (`#3b82f6`), Category 2 (`#12b76a`), Category 3 (`#f79009`), Category 4 (`#7a5af8`), Category 5 (`#0ba5ec`). Restricted strictly to charts and metric graphs.

### 3.4 Dark Mode Pairing Strategy

Dark mode is activated via `@custom-variant dark (&:is(.dark *))` in `theme.css`. Every component utility ships with its `dark:` pair:

| Light Utility         | Dark Substitution                       | Purpose                        |
| :-------------------- | :-------------------------------------- | :----------------------------- |
| `bg-white`            | `dark:bg-gray-dark`                     | Primary surface                |
| `bg-gray-50`          | `dark:bg-gray-900` / `dark:bg-gray-800` | Canvas / subtle container fill |
| `text-gray-900`       | `dark:text-white/90`                    | High-contrast body text        |
| `text-gray-500`       | `dark:text-gray-400`                    | Muted metadata text            |
| `border-gray-200`     | `dark:border-gray-800`                  | Container outlines             |
| `bg-{semantic}-50`    | `dark:bg-{semantic}-950`                | Status badge background        |
| `text-{semantic}-700` | `dark:text-{semantic}-300`              | Status badge foreground        |

### 3.5 Typography Scale (Preserved)

- **Primary Body/UI Font:** **Nunito Sans** (`--font-sans: var(--font-nunito-sans)`). Wired in `apps/ui/src/app/layout.tsx`.
- **Monospace Font:** JetBrains Mono (`--font-mono: var(--font-jetbrains-mono)`).
- **Editorial Serif:** Merriweather (`--font-serif: var(--font-merriweather)`).

```
Heading Scale (Page & Section titles):
  --text-title-2xl: 72px (line-height: 90px)
  --text-title-xl:  60px (line-height: 72px)
  --text-title-lg:  48px (line-height: 60px)
  --text-title-md:  36px (line-height: 44px)
  --text-title-sm:  30px (line-height: 38px)

UI Typography Scale (Labels, controls, data cells):
  --text-theme-xl:  20px (line-height: 30px) — Card titles, modal headers
  --text-theme-sm:  14px (line-height: 20px) — Standard UI copy, form labels
  --text-theme-xs:  12px (line-height: 18px) — Badges, secondary metadata, table cells
```

### 3.6 Shadows and Focus Rings

- Standard Elevation: `--shadow-theme-{xs,sm,md,lg,xl}`.
- Focus Ring Token:
  - _Current Live:_ `--shadow-focus-ring: 0px 0px 0px 4px rgba(6, 186, 50, 0.12);`
  - _Approved Target:_ `--shadow-focus-ring: 0px 0px 0px 4px rgba(23, 105, 245, 0.25);`
- Modal Glow Token:
  - _Current Live:_ `--shadow-dialog-glow: 0px 0px 25px 0px rgba(6, 186, 50, 0.22), 0px 20px 25px -5px rgba(16, 24, 40, 0.1);`
  - _Approved Target:_ `--shadow-dialog-glow: 0px 0px 25px 0px rgba(23, 105, 245, 0.22), 0px 20px 25px -5px rgba(16, 24, 40, 0.1);`

### 3.7 Spacing & Density Conventions

- No custom spacing scale — Tailwind's default spacing scale (`p-4`, `gap-2`, etc.) is the spacing system.
- Density convention across `ui-kit`: form controls and buttons default to a comfortable density (`h-10` / `px-3.5`–`px-4` / `py-2.5`), with a `sm` variant (`h-8` / `px-3`) for compact contexts (table row actions, management toolbars). Never introduce an ad-hoc third density size without a concrete operational need.

### 3.8 Borders, Radii, and Form Boundaries

- Radii tokens: `rounded-lg` (buttons, inputs), `rounded-full` (badges, pills, checkbox), `rounded-xl` (cards, tables, dialogs).
- Container borders: `border-gray-200` / `dark:border-gray-800`.
- Form control borders: `border-gray-300` / `dark:border-gray-700` (audited in §7.1; see §7.2 for accessible boundary enhancement).

### 3.9 Layering (z-index) Scale

- Layering is strictly controlled: native `<dialog>` operates in the browser-managed top layer (`Dialog` component); fixed toast notifications mount at `z-50` (`ToastProvider`). Popovers and dropdowns use `z-40`. No ad-hoc z-index values may be introduced without documenting them here.

### 3.10 Motion & Reduced Motion

- Micro-transitions: `transition-colors` (interactive surfaces, nav items, buttons).
- Loading animation: `animate-pulse` (`Skeleton`), `animate-spin` (`Spinner`).
- Reduced motion requirement: All animations must pair with `motion-reduce:animate-none` to honor `prefers-reduced-motion: reduce`. Modal dialog animations in `theme.css` already disable under reduced motion (`@media (prefers-reduced-motion: reduce) { dialog[open], dialog::backdrop { animation: none; } }`).

### 3.11 Responsive Behavior & Table Overflow

- Breakpoints: Standard Tailwind mobile-first defaults (`sm: 640px`, `md: 768px`, `lg: 1024px`, `xl: 1280px`).
- Desktop-first ERP shell: Screens are designed for desktop operator density first, but must visually reflow without breaking on narrower viewports.
- Wide data tables: Horizontally scroll via `DataTable`'s dedicated `overflow-x-auto` wrapper; never allow uncontained table rows to blow out page canvas widths.

### 3.12 Tailwind Class Literals Rule

- Every Tailwind class name must be a complete string literal in source. Never interpolate variables into class names (e.g., `` `bg-${color}-500` `` is prohibited as Tailwind's compiler drops dynamic classes).
- Use `Record<Variant, string>` literal maps indexed by variant enum (exemplified in `Button`, `Alert`, and `StatusBadge`).

---

## 4. Shared UI Component Contracts (`packages/ui-kit/src/components/`)

Every generic primitive resides under `packages/ui-kit/src/components/<name>/index.tsx`, is exported from `packages/ui-kit/src/index.ts`, and is imported as `import { X } from "@texawave-erp/ui-kit"`. Generic primitives contain **no API calls and no domain models**. Every primitive exists at `packages/ui-kit/src/components/` and is exercised by the reference feature (`apps/ui/src/features/_reference/tags/`) — proving they function within an authenticated end-to-end flow, not just typecheck.

### 4.1 Component Contract Summary (30 Primitives Verified)

| Component                               | Public Properties (Non-Exhaustive)                                                                                                                                                                                                                                                        | States Covered                                                                                                                                                                                                                      |
| :-------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button`                                | `variant` (`primary`, `secondary`, `ghost`, `destructive`), `size` (`sm`, `md`, `lg`), `loading`                                                                                                                                                                                          | Disabled, loading (`Spinner` + `aria-busy`), focus-visible                                                                                                                                                                          |
| `Input`                                 | `invalid`, standard HTML input props                                                                                                                                                                                                                                                      | Disabled, invalid (`aria-invalid` + error border), focused                                                                                                                                                                          |
| `Textarea`                              | `invalid`, standard HTML textarea props                                                                                                                                                                                                                                                   | Disabled, invalid (`aria-invalid` + error border), focused                                                                                                                                                                          |
| `Select`                                | `invalid`, standard HTML select props                                                                                                                                                                                                                                                     | Disabled, invalid (`aria-invalid` + error border), focused                                                                                                                                                                          |
| `Checkbox`                              | standard input checkbox props                                                                                                                                                                                                                                                             | Disabled, checked, focus ring                                                                                                                                                                                                       |
| `FormField`                             | `label`, `error`, `hint`, `required`, `labelAction`, `errorVariant` (`text` default, `bubble`), render-prop `children`                                                                                                                                                                    | Wires `aria-describedby`, `aria-invalid`, and `<label htmlFor>` automatically; `bubble` shows the error in a callout with a pointer under the control (in the layout flow, `role="alert"`, ✕ glyph, error-700 on error-50 = 6.05:1) |
| `Card`                                  | `tone` (`default`, `success`, `warning`, `error`, `info`), standard `HTMLAttributes<HTMLDivElement>`                                                                                                                                                                                      | Light/dark surface, rounded-2xl, shadow, full-perimeter gradient borders                                                                                                                                                            |
| `StatCard`                              | `headingId`, `label`, `value`, `note`, `tone` (`neutral`, `brand`, `info`, `warning`, `error`, `success`), `icon`, `trend`, `href`                                                                                                                                                        | Metric card with accessible `aria-labelledby`, count-up animation, hover elevation, focus-visible stretched link                                                                                                                    |
| `AnimatedNumber`                        | `value`, `duration` (ms), `formatter`                                                                                                                                                                                                                                                     | Accessible count-up transition, cubic ease-out, immediate render on `prefers-reduced-motion`                                                                                                                                        |
| `MetricTrend`                           | `value`, `direction` (`up`, `down`, `neutral`), `label`, `isPositive`, `className`                                                                                                                                                                                                        | Semantic trend badge with distinct directional glyphs and non-color `aria-label` description                                                                                                                                        |
| `TableSkeleton`                         | `rowsCount`, `columnsCount`, `className`                                                                                                                                                                                                                                                  | High-fidelity table loading skeleton with `role="status"` and `aria-label`, respects reduced motion                                                                                                                                 |
| `Alert`                                 | `variant` (`info`, `success`, `warning`, `error`), `title`, `children`                                                                                                                                                                                                                    | Non-color glyphs (ℹ, ✓, ▲, ✕), `role="alert"` (error) / `role="status"`                                                                                                                                                             |
| `ToastProvider` / `useToast`            | `toast({ title, description, variant })`                                                                                                                                                                                                                                                  | Auto-dismiss (5s), manual dismiss, `aria-live="polite"` region                                                                                                                                                                      |
| `Skeleton`                              | standard `HTMLAttributes<HTMLDivElement>`                                                                                                                                                                                                                                                 | Loading placeholder with `motion-reduce:animate-none`                                                                                                                                                                               |
| `Spinner`                               | standard `SVGAttributes<SVGSVGElement>`                                                                                                                                                                                                                                                   | SVG loading spinner with `motion-reduce:animate-none`                                                                                                                                                                               |
| `EmptyState`                            | `title`, `description`, `action`                                                                                                                                                                                                                                                          | Zero-state placeholder (never used for request failures)                                                                                                                                                                            |
| `ErrorState`                            | `title`, `description`, `onRetry`                                                                                                                                                                                                                                                         | Request failure state with explicit retry trigger                                                                                                                                                                                   |
| `StatusBadge`                           | `label`, `colorToken` (`brand`, `gray`, `success`, `warning`, `error`)                                                                                                                                                                                                                    | Single source of truth for rendering domain status tokens                                                                                                                                                                           |
| `DataTable`                             | `columns`, `rows`, `getRowKey`, `caption`, `loading`, `loadingRowsCount`, `loadingSkeleton`, `emptyState`, `errorState`, `sortColumn`, `sortDirection`, `onSort`, `selectable`, `selectedRowKeys`, `onSelectRow`, `onSelectAll`, `selectRowAriaLabel`, `selectAllAriaLabel`, `onRowClick` | Generic tabular data grid with accessible column sorting (`aria-sort`), row selection (accessible checkboxes + indeterminate state), interactive row clicks, horizontal overflow wrapper, and integrated loading/empty/error states |
| `Pagination`                            | `page`, `totalPages`, `onPageChange`, `totalItems`, `pageSize`, `onPageSizeChange`, `pageSizeOptions`                                                                                                                                                                                     | Accessible pagination navigation with result count display (`Showing X–Y of Z results`) and items-per-page dropdown                                                                                                                 |
| `TableToolbar`                          | `search`, `filters`, `chips`, `actions`, `bulkActions`, `resultCount`, `hasActiveFilters`, `onClearFilters`, `clearFiltersLabel`                                                                                                                                                          | Standardized table management toolbar with SearchInput integration, filter control slots, active filter chips row, and clear-all-filters action                                                                                     |
| `ActionMenu`                            | `items` (`label`, `onClick`, `variant`, `icon`, `disabled`, `separator`), `ariaLabel`, `triggerIcon` (`vertical`, `horizontal`)                                                                                                                                                           | Zero-dependency accessible dropdown, `aria-haspopup="menu"`, Escape dismissal, click-outside                                                                                                                                        |
| `ConfirmDialog` / `DeleteConfirmDialog` | `open`, `onClose`, `onConfirm`, `title`, `description`, `itemName`, `variant`, `confirmText`, `cancelText`, `loading`, `disabled`, `size`                                                                                                                                                 | Accessible native `<dialog>` modal, focus trap, backdrop blur, Escape dismissal, destructive deletion wrapper                                                                                                                       |
| `FilterChip` / `FilterChips`            | `label`, `value`, `onRemove`, `disabled`, `icon` (chip); `chips`, `onClearAll`, `clearAllLabel`, `activeFiltersLabel` (group)                                                                                                                                                             | Removable filter token pills with accessible dismiss buttons (`aria-label`) and group "Clear all" action                                                                                                                            |
| `SearchInput`                           | `value`, `onChange`, `onChangeValue`, `onClear`, `clearable`, `invalid`, `sizeVariant` (`sm`, `md`, `lg`), `clearButtonAriaLabel`                                                                                                                                                         | Accessible search control with leading magnifying glass, clear button (`type="button"`), `role="searchbox"`                                                                                                                         |
| `DatePicker`                            | `value`, `defaultValue`, `onChange`, `onChangeDate`, `min`, `max`, `minDate`, `maxDate`, `clearable`, `onClear`, `invalid`, `sizeVariant`                                                                                                                                                 | Single date input, zero timezone distortion (`YYYY-MM-DD`), `.showPicker()` trigger, clear button                                                                                                                                   |
| `PasswordField`                         | `value`, `showRequirements`, `rules` (`PasswordRule[]`), `invalid`, `toggleAriaLabel`                                                                                                                                                                                                     | Masked input by default, accessible reveal button (`type="button"`), live criteria validation checklist                                                                                                                             |
| `Dialog`                                | `open`, `onClose`, `title`, `size` (`sm`, `md`, `lg`, `xl`, `2xl`)                                                                                                                                                                                                                        | Native `<dialog>`, `showModal()`, backdrop blur, Esc key, focus trap                                                                                                                                                                |
| `DateRangePicker`                       | `value`, `onChange`, `onApply`, `onClear`, `variant`, `presets`, `fromAriaLabel`, `toAriaLabel`                                                                                                                                                                                           | Unified date-range calendar popover, quick presets, keyboard navigation                                                                                                                                                             |
| `Tabs`                                  | `label`, `idPrefix`, `tabs`, `value`, `onChange`, `children`                                                                                                                                                                                                                              | WAI-ARIA tablist/tabpanel, Arrow/Home/End keyboard navigation                                                                                                                                                                       |
| `Breadcrumbs`                           | `items` (`string                                                                                                                                                                                                                                                                          | BreadcrumbItem`), `separator`, `ariaLabel`, `tone` (`neutral`, `banner`)                                                                                                                                                            | Accessible hierarchy path `<nav aria-label="Breadcrumb">`, `<ol>`, `aria-current="page"` on current, non-text separator |
| `PageHeader`                            | `title`, `description`, `icon`, `badge`, `breadcrumbs`, `breadcrumbsSlot`, `action`, `primaryAction`, `secondaryActions`, `variant` (`neutral`, `banner`)                                                                                                                                 | Standardized page header supporting clean neutral surfaces and full-width gradient banners (`HrPageHeader`)                                                                                                                         |

### 4.2 Critical Component Contract Rules

#### Rule 1: Button & Tab Contrast Inversion and Primary Button Gradient

- **Current Live State:** `packages/ui-kit/src/components/button/index.tsx` primary variant implements the medium-strength mixed gradient inspired by the TexaOne logo (`bg-linear-120 from-brand-600 via-brand-500 to-brand-cyan-accessible hover:from-brand-700 hover:via-brand-800 hover:to-[#075985] active:from-brand-900 active:via-brand-800 active:to-[#0c4a6e] text-white`).
- **Contrast Guarantee:** Electric Blue `#2454E8` (5.99:1), Primary Blue `#1769F5` (4.80:1), and Accessible Ocean Cyan `#0369A1` (5.93:1) all pass WCAG 2.2 AA normal text (≥ 4.5:1) with `text-white`. Selected `Tabs` also use `bg-linear-to-r from-brand-600 via-brand-500 to-brand-cyan-accessible` with `text-white`.
- **Distinction from Brand Gradient:** The primary button gradient uses Accessible Ocean Cyan (`#0369A1`) as its terminal stop instead of raw Cyan (`#12CFE3`, contrast 1.90:1), ensuring every point across the mixed gradient surface satisfies WCAG AA contrast standards. Hover (`#1d4ed8` -> `#1e40af` -> `#075985`) and active states maintain > 6.7:1 contrast.

#### Rule 2: SpecularButton Scope Restriction

- Any optional glossy or specular button effect must **never** replace the base `Button` component globally. If implemented, it must remain an opt-in variant or isolated promotional CTA component.

#### Rule 3: Accessible Dropdown Strategy (Zero New Dependencies — Verified in Phase 2)

- External third-party dropdown packages (such as `21st.dev/@0xUrvish/components/smooth-dropdown` requiring `motion`, `@hugeicons`, and `react-use-measure`) were evaluated and explicitly rejected to maintain zero dependency bloat.
- **Implemented Contract:** `ActionMenu` is implemented natively in `@texawave-erp/ui-kit` (`packages/ui-kit/src/components/action-menu/index.tsx`) using pure React hooks (`useState`, `useRef`, `useEffect`) and Tailwind utility animations (`animate-in fade-in zoom-in-95 duration-100`).
- **Accessibility & Focus Management:** Renders an accessible trigger `<button type="button" aria-haspopup="menu" aria-expanded={open} aria-label={ariaLabel}>`, menu container `<div role="menu">`, items `<button type="button" role="menuitem">`, and dividers `<div role="separator">`. Handles Escape key dismissal returning focus to the trigger button, and document-level click-outside detection.
- **Backward Compatibility:** `apps/ui/src/components/ActionMenu.tsx` re-exports `ActionMenu`, `ActionMenuItem`, and `ActionMenuProps` directly from `@texawave-erp/ui-kit`.

### 4.3 Phase 1 Display Components Contract

#### 1. `Card` & Semantic Gradient Perimeter Tones

- **Location:** `packages/ui-kit/src/components/card/index.tsx`
- **Props:** `tone?: CardTone` (`"default" | "success" | "warning" | "error" | "info"`), standard `HTMLAttributes<HTMLDivElement>`.
- **Anatomy:** High corner radius (`rounded-2xl`), pure white canvas (`bg-white dark:bg-gray-dark`), soft diffused shadow (`shadow-[0_2px_12px_rgba(23,105,245,0.03)]`), and full-perimeter 1px border.
- **Perimeter Borders:** Implemented via dual background clip (`background-origin: border-box; background-clip: padding-box, border-box; border: 1px solid transparent !important;`).
  - `default`: `.gradient-card-border` (sky/cyan to brand-blue)
  - `success`: `.gradient-card-border-success` (emerald/teal)
  - `warning`: `.gradient-card-border-warning` (amber/orange)
  - `error`: `.gradient-card-border-error` (rose/red)
  - `info`: `.gradient-card-border-info` (sky/blue)

#### 2. `StatCard`

- **Location:** `packages/ui-kit/src/components/stat-card/index.tsx`
- **Public API:**
  - `headingId: string` (Mandatory accessible ID for `aria-labelledby`)
  - `label: string` (Card metric title, rendered uppercase tracking-wider)
  - `value: string | number` (Primary numeric or formatted metric string)
  - `note: string` (Secondary contextual note / comparison baseline)
  - `tone?: StatCardTone` (`"neutral" | "brand" | "info" | "warning" | "error" | "success"`; default `"neutral"`)
  - `icon?: ComponentType<{ className?: string }>` (Rendered in tonally-matched squircle container)
  - `trend?: MetricTrendProps` (Optional directional trend badge)
  - `href?: string` (Optional destination with stretched overlay link `<a aria-label="...">`)
  - `className?: string`
- **Accessibility Guarantees:** Semantic `<section aria-labelledby={headingId}>`, `<h3 id={headingId}>`, and full accessible link text `${label}: ${value}. ${note}`.
- **Backward Compatibility:** `apps/ui/src/features/hr/components/StatCard.tsx` re-exports `StatCard`, `StatCardProps`, and `StatCardTone` from `@texawave-erp/ui-kit`.

#### 3. `AnimatedNumber`

- **Location:** `packages/ui-kit/src/components/stat-card/animated-number.tsx`
- **Public API:**
  - `value: number` (Target numeric KPI figure)
  - `duration?: number` (Count-up duration in ms; default: `500`)
  - `formatter?: (val: number) => string` (Optional custom number formatter)
- **Accessibility & Motion:**
  - Inspects `window.matchMedia("(prefers-reduced-motion: reduce)").matches`.
  - When reduced motion is requested or `value === 0`, cancels animation frames and renders the target value immediately.
  - Implements smooth cubic ease-out curve (`1 - (1 - t)^3`) via `requestAnimationFrame`.

#### 4. `MetricTrend`

- **Location:** `packages/ui-kit/src/components/stat-card/metric-trend.tsx`
- **Public API:**
  - `value: number | string` (Percentage or numeric delta, e.g. `"+12%"`)
  - `direction: "up" | "down" | "neutral"`
  - `label?: string` (Optional descriptive period text, e.g. `"vs last month"`)
  - `isPositive?: boolean` (Overrides default where `"up"` is green and `"down"` is red)
  - `className?: string`
- **Accessibility:** Never relies solely on color. Embeds distinct SVG indicator glyphs (`TrendingUpIcon`, `TrendingDownIcon`, `MinusIcon`) and announces explicit context via `aria-label="Trend: {direction} {value}{label}"`.

#### 5. `TableSkeleton`

- **Location:** `packages/ui-kit/src/components/table-skeleton/index.tsx`
- **Public API:**
  - `rowsCount?: number` (Default: `6`)
  - `columnsCount?: number` (Default: `7`)
  - `className?: string`
- **Anatomy & Accessibility:**
  - Renders container with `role="status"`, `aria-label="Loading table data"`, and `<span className="sr-only">Loading table records...</span>`.
  - Header band matches `--gradient-table-header`.
  - First column simulates primary identity (circular avatar placeholder + two-line text skeleton). Remaining columns render staggered width rectangular skeletons.
  - Built on the core `Skeleton` primitive which honors `motion-reduce:animate-none`.
- **Backward Compatibility:** `apps/ui/src/features/hr/components/TableSkeleton.tsx` re-exports `TableSkeleton` and `TableSkeletonProps` from `@texawave-erp/ui-kit`.

---

### 4.4 Phase 2 Interaction Components Contract

#### 1. `ActionMenu`

- **Location:** `packages/ui-kit/src/components/action-menu/index.tsx`
- **Public API:**
  - `items: ActionMenuItem[]` where each item defines:
    - `label: string`
    - `onClick: () => void`
    - `variant?: "default" | "destructive"`
    - `icon?: ReactNode`
    - `disabled?: boolean`
    - `separator?: boolean`
  - `ariaLabel: string` (Accessible name for trigger button and menu)
  - `triggerIcon?: "vertical" | "horizontal"` (Default: `"vertical"`)
  - `buttonClassName?: string`
  - `className?: string`
  - `menuClassName?: string`
- **Interaction & Accessibility:**
  - Trigger button: `<button type="button" aria-haspopup="menu" aria-expanded={open} aria-label={ariaLabel}>`.
  - Dropdown container: `<div role="menu" aria-label={ariaLabel}>`.
  - Action items: `<button type="button" role="menuitem">` with destructive styling (`text-error-600`) and disabled state support (`cursor-not-allowed opacity-50`).
  - Separators: `<div role="separator">`.
  - Keyboard handling: Dismisses on `Escape` key and returns keyboard focus to the trigger button.
  - Dismisses on click-outside.
- **Backward Compatibility:** `apps/ui/src/components/ActionMenu.tsx` re-exports `ActionMenu`, `ActionMenuItem`, and `ActionMenuProps` from `@texawave-erp/ui-kit`.

#### 2. `ConfirmDialog` & `DeleteConfirmDialog`

- **Location:** `packages/ui-kit/src/components/confirm-dialog/index.tsx`
- **Public API (`ConfirmDialog`):**
  - `open: boolean`
  - `onClose: () => void`
  - `onConfirm: () => void | Promise<void>`
  - `title: string`
  - `description?: ReactNode | string`
  - `itemName?: string` (Interpolated into standard confirmation prompt)
  - `confirmText?: string` (Default: `"Delete"` for destructive, `"Confirm"` for primary)
  - `cancelText?: string` (Default: `"Cancel"`)
  - `variant?: "primary" | "destructive"` (Default: `"destructive"`)
  - `loading?: boolean` (Disables cancel button and displays spinner on confirm button)
  - `disabled?: boolean`
  - `size?: DialogSize` (Default: `"md"`)
  - `className?: string`
  - `children?: ReactNode`
- **Public API (`DeleteConfirmDialog`):**
  - Preconfigured convenience wrapper with `variant="destructive"`, `confirmText="Delete"`, and `itemName`.
- **Accessibility & Modality:**
  - Built directly on top of the native `<dialog>` primitive (`Dialog`), inheriting backdrop blur, focus trapping, Escape key dismissal, and native modal layer management.
- **Backward Compatibility:** `apps/ui/src/components/DeleteConfirmDialog.tsx` re-exports `ConfirmDialog`, `DeleteConfirmDialog`, `ConfirmDialogProps`, and `DeleteConfirmDialogProps` from `@texawave-erp/ui-kit`.

#### 3. `FilterChip` & `FilterChips`

- **Location:** `packages/ui-kit/src/components/filter-chip/index.tsx`
- **Public API (`FilterChip`):**
  - `label: string`
  - `value: string`
  - `onRemove: () => void`
  - `disabled?: boolean`
  - `icon?: ReactNode`
  - `className?: string`
- **Public API (`FilterChips`):**
  - `chips: FilterChipItem[]` (`id`, `label`, `value`, `onRemove`, `disabled`, `icon`)
  - `onClearAll?: () => void`
  - `clearAllLabel?: string` (Default: `"Clear all"`)
  - `activeFiltersLabel?: string` (Default: `"Active filters:"`)
  - `className?: string`
- **Accessibility & Display:**
  - Returns `null` when `chips.length === 0` to prevent empty layout gaps.
  - Dismiss button: `<button type="button" aria-label="Remove filter for {label}: {value}">`.
  - Focusable with visible focus ring (`focus-visible:outline-brand-500`).
- **Backward Compatibility:** `apps/ui/src/features/hr/components/FilterChip.tsx` re-exports `FilterChip`, `FilterChips`, `FilterChipProps`, `FilterChipItem`, and `FilterChipsProps` from `@texawave-erp/ui-kit`.

---

### 4.5 Phase 3 Form Controls Contract

#### 1. `SearchInput`

- **Location:** `packages/ui-kit/src/components/search-input/index.tsx`
- **Public API:**
  - Standard HTML input attributes (except `type`), forwarded via `ref: ForwardedRef<HTMLInputElement>`.
  - `value?: string | number | readonly string[]`
  - `onChange?: (e: ChangeEvent<HTMLInputElement>) => void`
  - `onChangeValue?: (value: string) => void` (Convenience value callback)
  - `clearable?: boolean` (Default: `true`)
  - `onClear?: () => void`
  - `invalid?: boolean`
  - `sizeVariant?: "sm" | "md" | "lg"` (Default: `"md"`)
  - `clearButtonAriaLabel?: string` (Default: `"Clear search"`)
  - `placeholder?: string` (Default: `"Search..."`)
- **Accessibility & Interaction:**
  - Semantic `type="search"` and `role="searchbox"`.
  - Leading magnifying glass icon marked `aria-hidden="true" pointer-events-none`.
  - Clear button: Rendered conditionally when input has content; `type="button"` prevents accidental form submissions; restores keyboard focus to the input element upon clearing.
- **Verified Migrated Consumers:** `EmployeesView.tsx`, `DepartmentsView.tsx`.

#### 2. `DatePicker`

- **Location:** `packages/ui-kit/src/components/date-picker/index.tsx`
- **Public API:**
  - Standard HTML input attributes (except `type`, `value`, `defaultValue`, `onChange`, `min`, `max`), forwarded via `ref`.
  - `value?: string` (Plain date string strictly formatted as `YYYY-MM-DD`)
  - `defaultValue?: string`
  - `onChange?: (e: ChangeEvent<HTMLInputElement>) => void`
  - `onChangeDate?: (date: string) => void`
  - `min?: string` / `minDate?: string` (`YYYY-MM-DD`)
  - `max?: string` / `maxDate?: string` (`YYYY-MM-DD`)
  - `clearable?: boolean` (Default: `true`)
  - `onClear?: () => void`
  - `invalid?: boolean`
  - `sizeVariant?: "sm" | "md" | "lg"` (Default: `"md"`)
  - `clearButtonAriaLabel?: string` (Default: `"Clear date"`)
- **Timezone Safety & Calendar Access:**
  - Renders native `<input type="date">`. **Zero timezone distortion**: values remain pure `YYYY-MM-DD` strings without `new Date()` UTC/local timezone day shifts.
  - Calendar icon triggers browser `.showPicker()` method where supported, falling back to focus.
  - Clear button: `type="button"`, resets value, fires `onChangeDate("")` and `onChange`, and restores focus.
- **Verified Migrated Consumers:** `HolidayForm.tsx`, `RequestLeaveDialog.tsx`.

#### 3. `PasswordField`

- **Location:** `packages/ui-kit/src/components/password-field/index.tsx`
- **Public API:**
  - Standard HTML input attributes (except `type`), forwarded via `ref`.
  - `value?: string | number | readonly string[]`
  - `showRequirements?: boolean` (Default: `false`)
  - `rules?: PasswordRule[]` (Default: `PASSWORD_RULES`)
  - `invalid?: boolean`
  - `toggleAriaLabel?: string` (Default: `"Show password"` / `"Hide password"`)
  - `inputClassName?: string`
- **Password Rules Engine (`PASSWORD_RULES`):**
  - `length`: At least 8 characters (`v.length >= 8`)
  - `uppercase`: One uppercase letter (`/[A-Z]/.test(v)`)
  - `lowercase`: One lowercase letter (`/[a-z]/.test(v)`)
  - `number`: One number (`/\d/.test(v)`)
  - `special`: One special character (`/[^A-Za-z0-9]/.test(v)`)
- **Accessibility & Security:**
  - Masked by default (`type="password"`), toggles to `type="text"`.
  - Reveal trigger: `<button type="button" aria-label={showPassword ? "Hide password" : "Show password"}>`.
  - Live criteria checklist displays real-time state with distinct icons (`CheckIcon` vs `CircleIcon`) and green/muted color transitions.
- **Backward Compatibility:** `apps/ui/src/features/hr/components/PasswordField.tsx` re-exports `PasswordField`, `PasswordFieldProps`, `PasswordRule`, and `PASSWORD_RULES` from `@texawave-erp/ui-kit`.
- **Verified Migrated Consumers:** `NewHireView.tsx`, `UserForm.tsx`.

---

### 4.6 Phase 4 Navigation & Heading Contracts

#### 1. `Breadcrumbs`

- **Location:** `packages/ui-kit/src/components/breadcrumbs/index.tsx`
- **Public API:**
  - `items: readonly (string | BreadcrumbItem)[]` where `BreadcrumbItem` defines:
    - `label: ReactNode`
    - `href?: string`
    - `current?: boolean` (Defaults to `true` for terminal item in list)
    - `icon?: ReactNode`
  - `separator?: ReactNode` (Default: `"›"`)
  - `ariaLabel?: string` (Default: `"Breadcrumb"`)
  - `tone?: BreadcrumbsTone` (`"neutral" | "banner"`; default: `"neutral"`)
  - `className?: string`
- **Semantic HTML & Accessibility:**
  - Outer container: `<nav aria-label={ariaLabel}>`.
  - Ordered list: `<ol>` with list items `<li>`.
  - Separators: Rendered between items with `aria-hidden="true"` to prevent screen reader noise.
  - Active page: Terminal item rendered with `aria-current="page"` and `font-semibold`.
  - Tonal awareness: `banner` tone renders high-contrast white text (`text-white`, `text-white/80`, `text-white/60`) for readability on gradient surfaces; `neutral` tone renders slate gray and dark mode pairs.

#### 2. `PageHeader`

- **Location:** `packages/ui-kit/src/components/page-header/index.tsx`
- **Public API:**
  - `title: ReactNode` (Mandatory page heading)
  - `description?: ReactNode` (Optional subtext description)
  - `icon?: ComponentType<{ className?: string }> | ReactNode` (Leading icon component or node)
  - `badge?: ReactNode` (Optional status/telemetry badge rendered next to title)
  - `breadcrumbs?: readonly (string | BreadcrumbItem)[]` (Integrated hierarchy path)
  - `breadcrumbsSlot?: ReactNode` (Custom breadcrumb slot override)
  - `action?: ReactNode` (Action slot)
  - `primaryAction?: ReactNode` / `secondaryActions?: ReactNode` (Convenience structured action slots)
  - `variant?: PageHeaderVariant` (`"neutral" | "banner"`; default: `"neutral"`)
  - `className?: string`
- **Variants:**
  - `"neutral"` (Default): Designed for settings, administration, and clean data screens. Rendered with clean padding, dark text (`text-title-sm sm:text-title-md font-bold text-gray-900 dark:text-white/90`), subtle brand squircle icon container (`bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300`), and neutral breadcrumbs.
  - `"banner"`: Designed for primary operational modules (HR, Workforce). Renders full-width 3-stop TexaOne mixed gradient (`bg-linear-135 from-brand-600 via-brand-500 to-brand-cyan`), bold white title, `text-white/85` subtitle, white squircle icon container (`bg-white text-brand-600`), and banner-toned breadcrumbs.
- **Backward Compatibility Wrappers:**
  - `apps/ui/src/features/hr/components/HrPageHeader.tsx`: Thin wrapper delegating directly to `<PageHeader variant="banner" {...props} />`. Provides seamless compatibility across all 21 HR module screens.
  - `apps/ui/src/components/layout/PageHeader.tsx`: Re-exports `GlobalPageHeader` as `PageHeader` and `HrPageHeader = PageHeader`.
- **Verified Migrated Consumers:**
  - Direct UI Kit imports: `RolesHeader.tsx`, `UsersView.tsx`, `MenuView.tsx`.
  - HR banner instances via `HrPageHeader`: `EmployeesView`, `DepartmentsView`, `AttendanceView`, `LeavesView`, `HolidaysView`, `TasksView`, `TicketsView`, `TeamsView`, `RecruitmentView`, `OrgChartView`, `ProfilesListView`, `RegularizationView`, `ExpenseApprovalsView`, `ExitRequestsView`, `LocationPrivilegeView`, `FullMonthPresentView`, `EmployeeDocumentsListView`, `HrDashboardView`, `PayrollView`, `ComplianceView`.

---

### 4.7 Phase 5 DataTable, TableToolbar & Filtering Contracts

#### 1. `DataTable`

- **Location:** `packages/ui-kit/src/components/data-table/index.tsx`
- **Public API:**
  - `columns: ReadonlyArray<DataTableColumn<T>>`
    - `header: ReactNode | string`
    - `cell: (row: T, index: number) => ReactNode`
    - `className?: string`
    - `headerClassName?: string`
    - `align?: "left" | "center" | "right"`
    - `sortable?: boolean`
    - `sortKey?: string`
    - `width?: string | number`
  - `rows: readonly T[]`
  - `getRowKey: (row: T) => string`
  - `caption?: string` (Rendered with accessible `.sr-only` class)
  - `className?: string`
  - `tableClassName?: string`
  - **Loading, Empty & Error State Slots:**
    - `loading?: boolean` (Renders `TableSkeleton` or `loadingSkeleton` slot)
    - `loadingRowsCount?: number` (Default: `6`)
    - `loadingSkeleton?: ReactNode` (Custom skeleton override)
    - `emptyState?: ReactNode` (Contextual zero-state slot when `rows.length === 0`)
    - `errorState?: ReactNode` (Explicit error presentation slot)
  - **Sorting Contract:**
    - `sortColumn?: string` (Active sort key matching column `sortKey` or `header`)
    - `sortDirection?: "asc" | "desc"`
    - `onSort?: (columnKey: string, nextDirection: "asc" | "desc") => void`
    - Sortable headers render accessible `<button type="button">`, directional indicator SVGs (`SortAscIcon`, `SortDescIcon`, `SortNeutralIcon`), and semantic `aria-sort="ascending" | "descending" | "none"` attributes on `<th>`.
  - **Row Selection Contract:**
    - `selectable?: boolean` (Enables master and per-row checkboxes)
    - `selectedRowKeys?: ReadonlySet<string> | readonly string[]`
    - `onSelectRow?: (rowKey: string, selected: boolean, row: T) => void`
    - `onSelectAll?: (selected: boolean) => void`
    - `selectRowAriaLabel?: (row: T) => string`
    - `selectAllAriaLabel?: string` (Default: `"Select all rows"`)
    - Master checkbox automatically reflects indeterminate state (`ref.indeterminate = someSelected`).
    - Selected rows render soft highlight styling (`bg-blue-50/50 dark:bg-blue-950/20`).
    - Idle checkbox borders use WCAG SC 1.4.11 compliant `border-gray-400 dark:border-gray-600` (≥ 3:1 contrast against white background).
  - **Row Interaction Contract:**
    - `onRowClick?: (row: T) => void`
    - Safe event delegation: Clicks originating from interactive elements (`button`, `a`, `input`, `select`, `textarea`, `[role='button']`, `[role='menuitem']`, `[data-prevent-row-click]`) automatically skip row click handler to prevent callback collision.
- **Responsive Overflow Strategy:**
  - Wrapped in dedicated responsive container (`overflow-x-auto rounded-2xl border border-sky-100 bg-white shadow-xs dark:border-gray-800 dark:bg-gray-dark`), ensuring wide data tables never clip or break layout bounds.

#### 2. `TableToolbar`

- **Location:** `packages/ui-kit/src/components/table-toolbar/index.tsx`
- **Public API:**
  - `search?: ReactNode | TableToolbarSearchConfig`
    - When passed config (`{ value, onChange, placeholder, onClear, ariaLabel, disabled }`), automatically renders integrated `SearchInput` with `sizeVariant="sm"`.
  - `filters?: ReactNode` (Slot for select dropdowns, date pickers, or custom filter controls)
  - `chips?: ReactNode` (Slot for active filter chips rendered in dedicated bottom shelf)
  - `actions?: ReactNode` (Slot for primary/secondary buttons, e.g. "New Record")
  - `bulkActions?: ReactNode` (Slot for bulk actions when rows are selected)
  - `resultCount?: ReactNode | number` (Count telemetry, e.g. `12 results`)
  - `hasActiveFilters?: boolean` (Default: `false`)
  - `onClearFilters?: () => void` (Reset/clear callback)
  - `clearFiltersLabel?: string` (Default: `"Clear filters"`)
  - `className?: string`
  - `children?: ReactNode`
- **Accessibility & Structure:**
  - Outer region declared with `role="region" aria-label="Table management toolbar"`.
  - Form controls inside toolbar feature high-contrast idle borders (`border-gray-500` / 4.76:1 contrast ratio) conforming to WCAG SC 1.4.11.
- **Backward Compatibility Wrappers:**
  - `apps/ui/src/components/layout/ManagementToolbar.tsx`: Thin wrapper delegating to `TableToolbar` and re-exporting `HrToolbar = ManagementToolbar`. Preserves exact existing prop interfaces (`search`, `onSearchChange`, `searchPlaceholder`, `searchLabel`, `filters`, `hasActiveFilters`, `onClearFilters`).

#### 3. `Pagination`

- **Location:** `packages/ui-kit/src/components/pagination/index.tsx`
- **Public API:**
  - `page: number`
  - `totalPages: number`
  - `onPageChange: (page: number) => void`
  - `totalItems?: number` (Optional total record count)
  - `pageSize?: number` (Optional active page size)
  - `onPageSizeChange?: (pageSize: number) => void` (Optional page size callback)
  - `pageSizeOptions?: readonly number[]` (Default: `[10, 20, 50, 100]`)
  - `className?: string`
- **Display Semantics & Accessibility:**
  - Automatic hide: Returns `null` when `totalPages <= 1 && totalItems === undefined`, preserving full backward compatibility.
  - Count telemetry: When `totalItems` is provided, displays `Showing X–Y of Z results` with bold count tokens.
  - Items-per-page selector: When `onPageSizeChange` and `pageSize` are provided, renders `<select id="pagination-page-size">` with hidden label and accessible border (`border-gray-500` / 4.76:1 contrast).
  - Navigation controls: Accessible `nav aria-label="Pagination"`, Previous/Next `<Button variant="secondary" size="sm">` with boundary disabled states.

#### 4. Verified Migrated Consumers & Retained Implementations

- **Migrated Consumers:**
  - `DepartmentsView.tsx`: Fully migrated to `TableToolbar` (search config with clear, status filter, reset action) and `DataTable`.
  - `UsersView.tsx`: Integrated with `ManagementToolbar` -> `TableToolbar` and generic `DataTable`.
  - `MenuView.tsx`: Integrated with `ManagementToolbar` -> `TableToolbar` and generic `DataTable`.
  - `TagsView.tsx`: Verified baseline consumer exercising `DataTable` and `Pagination`.
- **Deliberately Retained Implementations:**
  - Deep HR domain views (`AttendanceView`, `EmployeesView`, `LeavesView`, `PayrollView`) currently use custom composite headers, calendar grids, or multi-tab split layouts. To strictly uphold Safety Rules (Rule 7 & 10) against risking complex domain logic, these modules are preserved with their stable implementations and will transition progressively in their respective feature milestones.

---

## 5. Application Layout & Navigation Architecture

### 5.1 Historical Architecture (Two-Tier Dual Sidebar)

- **Historical Layout (`apps/ui/src/app/(dashboard)/layout.tsx`):**
  - Leftmost Sidebar: `ErpPrimarySidebar` (240px) rendering primary modules.
  - Adjacent Sidebar: `DynamicSidebar` (240px) rendering module submenus.
  - Combined Width: Consumed **480px** of screen width before page content began.

### 5.2 Approved & Implemented Navigation (3-Level Horizontal Navbar & Universal Glass Dropdowns)

The approved TexaOne specification transitions the navigation to a modern three-level horizontal architecture:

1. **Level 1 — Top Horizontal Navbar (`HorizontalNavbar`):**
   - Full-width light sky-blue to aqua gradient strip (`bg-linear-to-r from-blue-50/90 via-cyan-50/80 to-emerald-50/60`).
   - Brand logo & tagline ("Run Your Business as One.").
   - Top-level authorized ERP module buttons (Dashboard, Human Resources, Commerce, Finance, Inventory, Projects, Reports, Settings).
   - Search input, Live IST clock, Notification popover, and User Profile menu.
   - Hover or click on a module activates its first-level category menu.

2. **Level 2 — First-Level Category Menu:**
   - Opens as a floating frosted glass panel directly below the selected module (`glass-dropdown rounded-2xl min-w-56 p-2 shadow-xl`).
   - Categorizes domain features into logical groupings:
     - For HR: `Overview` (direct link to `/hr/dashboard`), `People`, `Time & Leave`, `Operations`, `Recruitment`, `Payroll`, and `Compliance`.
     - For Settings: `Access Control` (Users, Roles) and `Configuration` (Navigation Menu, Reference Tags).
   - Categories with children display a right-pointing chevron (`ChevronRight`).
   - Unpermitted categories are filtered out via `useMyMenu()` and `collectMenuCodes()`.

3. **Level 3 — Nested Submenus (Adjacent Flyout):**
   - Selecting or hovering a category (such as `People`) opens its secondary submenu adjacent to the parent menu (`glass-dropdown rounded-2xl min-w-56 p-2 shadow-2xl`).
   - For `People`: `Employees`, `Profiles`, `Employee Documents`, `Org Chart`, `Departments`, `Teams`.
   - Viewport boundary awareness: automatically flips to the left if right edge would overflow the screen.
   - Clicking a leaf link navigates to the target route and dismisses open menus.
   - Dismissal: Escape key and clicking outside immediately dismiss all open menus.

4. **Universal Glassmorphism Dropdown Specification (`.glass-dropdown`):**
   - Reusable surface style shared across navbar menus, table action menus (`ActionMenu`), date range popovers (`DateRangePicker`), search suggestions, notifications, and profile menus:
     - Translucent background: `rgba(255, 255, 255, 0.85)` / `rgba(16, 27, 54, 0.85)` (dark mode).
     - Backdrop blur: `backdrop-filter: blur(20px)`.
     - Thin light-blue/white border: `1px solid rgba(224, 242, 254, 0.9)` / `rgba(255, 255, 255, 0.12)`.
     - Soft shadow: `0 20px 50px -10px rgba(14, 116, 203, 0.15)`.
     - Rounded corners: `rounded-2xl` matching the reference image.
     - Safe fallback: Opaque white / navy background when `backdrop-filter` is unsupported.

5. **Responsive & Mobile Accessibility:**
   - Narrow screens (< md) provide an accessible hamburger toggle opening a full-height glass accordion drawer.
   - 100% of authorized modules and nested sub-items remain touch-accessible on mobile and tablet without clipping or horizontal overflow.

---

## 6. Screen Interaction States & Domain Feature Preservation

### 6.1 Standard Interaction States

Every domain screen fetching or mutating data must handle these discrete states:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        SCREEN STATE TRANSITIONS                        │
├───────────────────┬────────────────────────────────────────────────────┤
│ State             │ Component / Handling Pattern                       │
├───────────────────┼────────────────────────────────────────────────────┤
│ Initial Loading   │ `Skeleton` rows matching layout, never blank page  │
│ Empty Data        │ `EmptyState` ("No records found") + create CTA     │
│ Filter No-Match   │ `EmptyState` ("No records matched your filters")   │
│ Request Error     │ `ErrorState` with `onRetry` calling query refetch  │
│ Permission Denied │ Distinct `Alert` (403) with "Request Access" copy  │
│ Save in Progress  │ `Button` with `loading={true}` + `aria-busy`       │
│ Validation Error  │ Inline `FormField` error with `role="alert"`       │
│ Unsaved Changes   │ Router / `beforeunload` guard on dirty forms       │
└───────────────────┴────────────────────────────────────────────────────┘
```

### 6.2 Feature Preservation Guarantees

#### 1. Authentication & Login

- **Preserved:** All authentication flows, form state retention on failed submit, password reset, and session management.
- **Approved Visual Changes:** Update visible branding from _"TexaWave ERP"_ to _"TexaOne"_ and subtitle to _“Run Your Business as One.”_ Update vector SVG fallback to blue/cyan. **Do not redesign the login card or input layout.**

#### 2. HR Dashboard Telemetry

- **Preserved:** All 10 live queries in `HrDashboardView.tsx` (`useDailyAttendance`, `useHeadcount`, `useLeaveBreakdown`, `useAbsenceLookback`, etc.) and RBAC permissions (`EMPLOYEE_READ`, `LEAVE_REQUEST_READ`, etc.).
- **Prohibited:** Never inject mock metrics, placeholder graphs, or fake telemetry data.

#### 3. Date Range Filter (`DateRangePicker`)

- **Preserved:** Presets (Today, Yesterday, This Week, This Month, Last Month, Last 30 Days), month/year jumpers, range calculation, Clear/Cancel/Apply actions, and visually-hidden accessibility inputs.
- **Visual Update:** Automatically recolored to Primary Blue via `theme.css` tokens.

#### 4. Alerts and Notifications

- **Preserved:** Global `ToastProvider` and `useToast()` mechanism. Distinct glyphs (ℹ, ✓, ▲, ✕) in `Alert` to ensure communication is never dependent on color alone.

### 6.3 Forms, Tables, Dialogs, and Auth Cards Conventions

- **Auth & Standalone Cards (`login`, `forgot-password`, `reset-password`):** Centered `Card` with an `<h1>` title (`text-theme-xl font-semibold`) directly followed by a one-line description (`text-theme-sm text-gray-500 dark:text-gray-400`). All three auth screens keep the same title across initial and terminal success/error states to prevent visual layout shifts.
- **Form Conventions:** One `FormField` per input control, local `useState` per field, zod-validated on submit, errors mapped from `ZodError.issues` by `path[0]`.
- **Field-by-field validation (new forms):** use `useFormValidation(schema, values)` (`apps/ui/src/hooks/useFormValidation.ts`) with `<FormField errorVariant="bubble" error={errorFor("field")}>` and `onBlur={() => touch("field")}`.
  - A field's error appears as soon as the field is left, updates live while it is being fixed, and every error shows on Save (`validateAll`).
  - Cross-field rules (`superRefine`) show on the field they name. API field errors (`setServerErrors`) clear when that field changes.
  - Field formats shared across modules (names, mobile and country codes, pincode, PAN, IFSC, bank account) come from `packages/core/src/schemas/fields.ts`.
  - If a field is left by a mouse press (e.g. on Save), its bubble waits until the press ends, so the shifting layout never swallows the click.
  - Reference: the Sales customer form.
- **Form Value Retention on Failure:** Form state remains in component state on failed submit and is only cleared upon success. Verified by Playwright test: `rejects a bad login and lets the user retry without losing the organization field`.
- **Table & Pagination Conventions:** Generic dumb `DataTable` + `Pagination`, driven strictly by `PaginationMeta` returned in the API envelope. Never re-derive `totalPages` client-side when the server already computed it.
- **Dialog Conventions:** Controlled via a single open/close boolean state in the parent component; backed by native `<dialog>` element (`showModal()`, focus trapping, Esc-to-close). Never build a manual custom `fixed` div modal.
- **Toast Notifications:** Fired fire-and-forget via `useToast().toast(...)` for action outcomes (created, updated, deleted, failed), never for field validation errors (which belong inline via `FormField`).

---

## 7. Accessibility (WCAG 2.2 AA) & Performance Engineering

> [!CAUTION]
> **Never claim WCAG 2.2 AA compliance without verified test evidence.** Inspection of source code verifies semantic structure, but automated scan results and manual testing are required before claiming conformance.

### 7.1 Mathematically Verified Contrast Matrix (WCAG Relative Luminance)

Contrast ratios calculated strictly using standard formula $\frac{L_1 + 0.05}{L_2 + 0.05}$:

| Pairing / Evaluation                                                            | Live (Green `#06ba32`) | Target (Blue `#1769F5`) | WCAG 2.2 AA Normal Text (≥ 4.5:1) | WCAG 2.2 AA Large Text (≥ 3.0:1) | WCAG 2.2 AA Non-Text UI (≥ 3.0:1) | Action Required in Migration                                                                               |
| :------------------------------------------------------------------------------ | :--------------------- | :---------------------- | :-------------------------------- | :------------------------------- | :-------------------------------- | :--------------------------------------------------------------------------------------------------------- |
| **White (`#FFFFFF`) on Brand-500**                                              | 2.60:1                 | **4.80:1**              | **PASS** (Target Blue)            | **PASS**                         | **PASS**                          | Set primary `Button` and selected `Tabs` to `text-white`                                                   |
| **White (`#FFFFFF`) on Brand-600 (`#2454E8`)**                                  | 3.38:1 (`#05a22c`)     | **5.99:1**              | **PASS**                          | **PASS**                         | **PASS**                          | Primary button gradient start stop (Electric Blue)                                                         |
| **White (`#FFFFFF`) on Ocean Cyan (`#0369A1`)**                                 | N/A                    | **5.93:1**              | **PASS**                          | **PASS**                         | **PASS**                          | Primary button gradient terminal stop (Accessible Ocean Cyan)                                              |
| **White (`#FFFFFF`) on Brand-700 (`#1D4ED8`)**                                  | 4.90:1 (`#048b25`)     | **8.00:1**              | **PASS**                          | **PASS**                         | **PASS**                          | Primary button hover gradient start stop                                                                   |
| **Dark (`#101828`) on Brand-500**                                               | 6.83:1                 | **3.70:1**              | **FAIL** (Target Blue < 4.5:1)    | **PASS** (≥ 3.0:1)               | **PASS**                          | Prohibit dark text on primary blue buttons; use white text                                                 |
| **Brand-700 (`#1d4ed8`) on Brand-50 (`#eff4fe`)**                               | 3.55:1 (`#048b25`)     | **6.08:1**              | **PASS**                          | **PASS**                         | **PASS**                          | Valid for light status badges and pills                                                                    |
| **Brand-800 (`#1e40af`) on Pale Blue (`#DBEAFE`)**                              | 5.58:1 (`#036e1d`)     | **7.15:1**              | **PASS**                          | **PASS**                         | **PASS**                          | Valid for high-contrast badge text and active indicators                                                   |
| **Brand-800 (`#1e40af`) on White (`#FFFFFF`)**                                  | 6.46:1 (`#036e1d`)     | **8.72:1**              | **PASS**                          | **PASS**                         | **PASS**                          | Valid for text links on light surfaces                                                                     |
| **Primary Blue (`#1769F5`) on White (`#FFFFFF`)**                               | 2.60:1                 | **4.80:1**              | **PASS** (≥ 4.5:1)                | **PASS**                         | **PASS**                          | Valid for non-text focus rings and large text headings                                                     |
| **Electric Blue (`#2454E8`) on White (`#FFFFFF`)**                              | 3.38:1 (`#05a22c`)     | **5.99:1**              | **PASS**                          | **PASS**                         | **PASS**                          | Valid for checkbox checked fill and interactive hover                                                      |
| **Slate Gray (`#64748B`) on White (`#FFFFFF`)**                                 | 4.76:1                 | **4.76:1**              | **PASS** (≥ 4.5:1)                | **PASS**                         | **PASS**                          | Valid for secondary text on pure white card surfaces                                                       |
| **Slate Gray (`#64748B`) on Cloud White (`#F8FAFC`)**                           | 4.55:1                 | **4.55:1**              | **PASS** (≥ 4.5:1)                | **PASS**                         | **PASS**                          | Tight margin (4.55:1); never use on darker fills or borders                                                |
| **Cyan (`#12CFE3`) on White (`#FFFFFF`)**                                       | N/A                    | **1.90:1**              | **FAIL** (< 4.5:1)                | **FAIL** (< 3.0:1)               | **FAIL** (< 3.0:1)                | **Prohibited** as text or UI boundary on white; accent only                                                |
| **Cyan (`#12CFE3`) on Deep Navy (`#101B36`)**                                   | N/A                    | **8.98:1**              | **PASS**                          | **PASS**                         | **PASS**                          | High-contrast accent on dark surfaces                                                                      |
| **Border Gray (`#E2E8F0`) on White (`#FFFFFF`)**                                | 1.18:1                 | **1.23:1**              | N/A (Subtle divider)              | N/A                              | **FAIL** (< 3.0:1)                | Valid as subtle layout divider only; non-text threshold (< 3.0:1)                                          |
| **Form Control Border (`gray-300` `#d0d5dd` / `#cbd5e1`) on White (`#FFFFFF`)** | 1.47:1 (`#d0d5dd`)     | **1.48:1** (`#cbd5e1`)  | N/A                               | N/A                              | **FAIL** (< 3.0:1)                | Unfocused border fails SC 1.4.11; active focus ring passes (4.80:1). Unresolved gap for Phase 1 (see §7.2) |

### 7.2 Accessibility Expectations

- **Accessible Names:** Every interactive control has visible text, an explicit `aria-label`, or an associated `<label htmlFor>`.
- **Keyboard Navigation:** Native `<button>`, `<input>`, `<select>`, `<dialog>`, and ARIA tablists support Tab, Enter, Space, Esc, and Arrow keys.
- **Focus Visibility:** Focus rings provide ≥ 3.0:1 contrast against adjacent surfaces and are never fully suppressed with `outline: none` unless replaced by a visible focus ring.
- **Form Control Visual Boundaries (SC 1.4.11 Audit):** Default idle borders using the existing `gray-300` token (`#d0d5dd` live, `#cbd5e1` reconciled) yield **1.48:1** contrast against `#FFFFFF` surfaces, failing the WCAG 2.2 AA SC 1.4.11 threshold (≥ 3.0:1). Active and focused states comply via the Primary Blue focus ring (`#1769F5` at **4.80:1**). Achieving strict 3.0:1 compliance for unfocused input boundaries on white surfaces requires either darkening idle borders to an accessible neutral (such as `gray-500` / `#64748B` at 4.76:1) or using a contrasting container background. This is documented as an **Unresolved Phase 1 Accessibility Requirement** to be resolved during form primitive review.
- **Reduced Motion:** Primitives must include `motion-reduce:animate-none` on continuous animations (`Skeleton`, `Spinner`).
- **Reflow & Zoom:** Interfaces must remain functional and avoid horizontal scroll at 320 CSS pixels (except within `DataTable`'s dedicated `overflow-x-auto` container) and support 200% zoom.

---

## 8. TexaOne Migration Acceptance Criteria

These criteria govern the approval of the implementation PR:

1. **Central Token Definition:** Update brand tokens centrally in `packages/ui-kit/src/theme.css`; do not hardcode replacement colors across components.
2. **Contrast & Inversion Audit:** Primary buttons, selected tabs, active navigation, focus rings, and logo fallbacks must satisfy WCAG 2.2 AA contrast requirements (distinguishing normal-text ≥ 4.5:1 and non-text ≥ 3.0:1).
3. **Foundation Preservation:** Preserve semantic status colors, Nunito Sans typography, login authentication behavior, and existing interaction contracts.
4. **Sidebar Consolidation:** Implement one collapsible main sidebar with nested accordion submenus, single-module expansion, and preserved `useMyMenu()` RBAC gating.
5. **Calendar Preservation:** Preserve date-range presets, month jumpers, selection logic, and filter behaviors.
6. **Zero Dependency Bloat:** Do not add external npm dependencies solely for dropdowns, icons, animations, or visual effects.
7. **Test Suite Integrity:** All existing unit and E2E Playwright tests must pass without weakening assertions.
8. **Accessibility Standards:** Target WCAG 2.2 AA. Verify contrast, keyboard access, focus visibility, reduced motion, 200% zoom, and reflow at 320 CSS pixels.
9. **Verification Evidence:** Record actual automated test results and contrast calculations before claiming compliance.
10. **Branch Alignment:** Verify all component names, exports, and routes against `feature/hr-ui` before merging.

---

## 9. Actionable Phased Migration Plan

```
┌────────────────────────────────────────────────────────────────────────┐
│                   ORDERED IMPLEMENTATION PHASES                        │
├────────────────────────────────────────────────────────────────────────┤
│ PHASE 1: UI-KIT FOUNDATION (Tokens & Core Metric Primitives)           │
│ • Update `packages/ui-kit/src/theme.css` with TexaOne blue scale,      │
│   cyan accent, navy dark neutral, brand gradient, and blue shadows.    │
│ • Implement StatCard, AnimatedNumber, MetricTrend, TableSkeleton.      │
│ • Add `motion-reduce:animate-none` to `Skeleton` and `Spinner`.        │
├────────────────────────────────────────────────────────────────────────┤
│ PHASE 2: INTERACTIVE MENUS & ACCESSIBLE DIALOGS                        │
│ • Implement ActionMenu, ConfirmDialog, DeleteConfirmDialog.            │
│ • Implement FilterChip and FilterChips filter group primitives.        │
│ • Migrate Departments, Users, Menu to accessible ActionMenu.           │
├────────────────────────────────────────────────────────────────────────┤
│ PHASE 3: ADVANCED FORM INPUTS                                          │
│ • Implement SearchInput with debounce, clear button, and icon slots.   │
│ • Implement DatePicker with calendar popover and formatted values.     │
│ • Implement PasswordField with accessible toggle-visibility button.    │
├────────────────────────────────────────────────────────────────────────┤
│ PHASE 4: GLOBAL PAGE NAVIGATION & HEADINGS                             │
│ • Implement PageHeader and Breadcrumbs in `@texawave-erp/ui-kit`.      │
│ • Standardize page titles, subtitles, and actions across HR routes.    │
├────────────────────────────────────────────────────────────────────────┤
│ PHASE 5: DATA TABLE, TOOLBAR & PAGINATION SYSTEM                       │
│ • Implement accessible DataTable (semantic table, sorting, selection). │
│ • Implement TableToolbar with search, filters, reset, and actions.     │
│ • Implement Pagination with boundaries and telemetry counts.           │
├────────────────────────────────────────────────────────────────────────┤
│ PHASE 6: GLOBAL LAYOUT, NAVIGATION & ERP SHELL CONSISTENCY             │
│ • Consolidate GlobalHeader, DynamicSidebar, and ErpPrimarySidebar.     │
│ • Implement multi-viewport visual QA (Desktop, Laptop, Tablet, Mobile).│
│ • Verify client-side route preservation for in-memory auth store.      │
├────────────────────────────────────────────────────────────────────────┤
│ PHASE 7: CROSS-MODULE CONSOLIDATION & REGRESSION VERIFICATION          │
│ • Migrate TicketsView to TableToolbar with active filter reset.        │
│ • Migrate TeamsView metrics to StatCard with semantic tones.           │
│ • Verify DepartmentsView ActionMenu and DeleteConfirmDialog workflows. │
│ • Verify TagsView full DataTable sorting, row selection & pagination.  │
│ • Run full 24-test E2E suite and dual-package typecheck & lint.        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 10. Required Tests & Verification Evidence

| Verification Target                      | Command                                             | Success Standard    | Actual Outcome                                    |
| :--------------------------------------- | :-------------------------------------------------- | :------------------ | :------------------------------------------------ |
| **UI Kit Typecheck**                     | `pnpm --filter @texawave-erp/ui-kit typecheck`      | 0 errors            | **0 errors (PASS)**                               |
| **UI Kit Lint**                          | `pnpm --filter @texawave-erp/ui-kit lint`           | 0 errors            | **0 errors (PASS)**                               |
| **Frontend Typecheck**                   | `pnpm --filter ui typecheck`                        | 0 errors            | **0 errors (PASS)**                               |
| **Frontend Lint**                        | `pnpm --filter ui lint`                             | 0 errors            | **0 errors, 55 pre-existing warnings (PASS)**     |
| **Unified Sidebar Visual QA (Phase 6)**  | `playwright test sidebar-visual-qa.spec.ts`         | 4 viewports pass    | **4/4 passed (Desktop, Laptop, Tablet, Mobile)**  |
| **Dynamic Sidebar RBAC & Routing**       | `playwright test dynamic-sidebar.spec.ts`           | 4 tests pass        | **4/4 passed**                                    |
| **DataTable & Toolbar System (Phase 5)** | `playwright test ui-kit-data-table-toolbar.spec.ts` | 5 tests pass        | **5/5 passed (including aria-sort & selection)**  |
| **HR Tickets Workflow (Phase 7)**        | `playwright test hr-tickets.spec.ts`                | 2 tests pass        | **2/2 passed (TableToolbar search & status)**     |
| **HR Teams Workflow (Phase 7)**          | `playwright test hr-teams.spec.ts`                  | 2 tests pass        | **2/2 passed (StatCard metrics & dialog)**        |
| **Reference Tags CRUD (Phase 5/7)**      | `playwright test reference-tags.spec.ts`            | 2 tests pass        | **2/2 passed (DataTable sorting & selection)**    |
| **Admin Departments (Phase 2/7)**        | `playwright test admin-departments.spec.ts`         | 2 tests pass        | **2/2 passed (ActionMenu & DeleteConfirmDialog)** |
| **HR Holidays Management**               | `playwright test hr-holidays.spec.ts`               | 3 tests pass        | **3/3 passed (Status filters & form dialog)**     |
| **Combined E2E Regression Batch**        | 24 tests across all affected modules                | 24 passed, 0 failed | **24/24 passed (100% PASS in 1.6m)**              |

---

## 11. Cross-Reference Map

- **System Architecture & Data Model:** [`ARCHITECTURE.md`](ARCHITECTURE.md)
- **Coding Conventions & PR Standards:** [`CODING_STANDARDS.md`](CODING_STANDARDS.md)
- **Contributor Instructions:** [`../CLAUDE.md`](../CLAUDE.md)
- **HR Core API & Permission Matrix:** [`HR_API.md`](HR_API.md)
- **HR Workforce Dashboard Telemetry:** [`HR_DASHBOARD.md`](HR_DASHBOARD.md)
- **Payroll & Statutory Compliance:** [`PAYROLL_AND_COMPLIANCE.md`](PAYROLL_AND_COMPLIANCE.md)
- **Attendance Architecture:** [`ATTENDANCE_ARCHITECTURE.md`](ATTENDANCE_ARCHITECTURE.md)
- **Menu & Navigation API:** [`MENU_NAVIGATION_API.md`](MENU_NAVIGATION_API.md)
