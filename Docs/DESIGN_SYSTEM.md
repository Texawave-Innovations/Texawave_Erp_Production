# TexaWave ERP — Design System

**Owner:** repository maintainers — assign a named owner/team before business-module work begins.
**Last verified:** 2026-09-29, against the actual repository state.
**Status:** Tokens (`packages/ui-kit/src/theme.css`) were already in place before this doc existed (Phase 0). Every primitive listed in §2 exists at `packages/ui-kit/src/components/` and is used by the reference feature (`apps/ui/src/features/_reference/tags/`) — that's the proof they work, not just that they typecheck. This doc was written to catch up to that code, not the other way around: if this doc and the code ever disagree, read the code and fix this doc.

**§0 records where the "Restrained Enterprise ERP" rebrand (green/Nunito Sans) came from and what was/wasn't adopted from it.** The brand color and body font below are now live; the Stitch export's Material-style token model (`surface`, `surface-container`, `on-surface`, etc.) was **not** adopted — the existing Tailwind numeric scale (`brand-{25..950}`) was kept and simply re-hexed to green, so every component that already reads `bg-brand-500`/`text-brand-700` picked up the new brand with zero component-level changes. This is what keeps the "one file to change" property: **`packages/ui-kit/src/theme.css`** is the only file with color/type hex or px values; a future rebrand only needs new hex values plugged into the same variable names, here and there.

**This is a token/shared-package change** (root `CLAUDE.md`) — it still needs reviewer sign-off before merge even though it's already implemented on this branch.

---

## 0. Rebrand record — "Restrained Enterprise ERP"

Source: the Stitch export `stitch_classic_green_erp_typography.zip` → `restrained_enterprise_erp/DESIGN.md`. The zip is no longer in the working tree (design assets don't belong at the repo root); it remains in git history, added in commit `377b3b1` (`git show 377b3b1:stitch_classic_green_erp_typography.zip > out.zip`). Brand & style intent: Corporate Modern + Content-Driven Editorial Minimalism, aimed at enterprise operators/financial controllers doing long high-density ledger sessions — disciplined, low-decoration, calm.

**Adopted (live in `packages/ui-kit/src/theme.css`):**

| Aspect                                  | Was                                                                 | Now                                                                                                          |
| --------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Primary brand color (`--color-brand-*`) | `#0f4c81` (blue), scale re-derived around it                        | `#06ba32` (vivid green), full `brand-25`…`brand-950` scale re-derived around it (§1.1 usage rules unchanged) |
| Body/UI font (`--font-sans`)            | Inter, wired via `next/font/google` in `apps/ui/src/app/layout.tsx` | Nunito Sans, same wiring mechanism (`--font-nunito-sans` CSS variable)                                       |
| Focus ring (`--shadow-focus-ring`)      | Blue-tinted rgba, light and dark                                    | Green-tinted rgba to match the new brand color, light and dark                                               |

**Deliberately not adopted** (would have meant abandoning the existing token architecture, not just re-coloring it): the Material-style semantic role naming (`surface-container`, `on-primary-container`, …) — the Tailwind numeric scale in §1.1 already gives every component a `-50`/`-700` light-dark pairing, and switching token _shapes_ (not just values) would touch every component's class names, not just `theme.css`. The zip's other component-level specifics (dedicated `0.5rem`/`1rem` radius split, shadow-only-on-popovers elevation rule, `tnum`/`cv01`/`ss01` OpenType requirement for ledger numerics, named `gutter-dense` spacing) are **not implemented** — they don't require a rebrand to add later and can be picked up independently against §1.4/§1.3/§1.8 whenever a ledger-heavy module needs them.

Companion docs: [`ARCHITECTURE.md`](ARCHITECTURE.md) (system design), [`CODING_STANDARDS.md`](CODING_STANDARDS.md) (code patterns). This doc owns tokens, component contracts, interaction states, and accessibility expectations — don't duplicate those rules elsewhere.

---

## 1. Tokens

All tokens live in `packages/ui-kit/src/theme.css` (Tailwind v4 CSS-first `@theme` block). **No component anywhere hardcodes a hex value, a raw `px` font size, or an ad-hoc `transition` duration** — add the token first, then use it.

### 1.1 Color

| Scale                         | Use                                                                                                   | Example classes                  |
| ----------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------- |
| `brand-{25..950}`             | Primary brand color — buttons, links, focus rings, active nav                                         | `bg-brand-500`, `text-brand-700` |
| `gray-{25..950}`, `gray-dark` | Neutral UI — text, borders, backgrounds. `gray-dark` is the dark-mode surface color, not a scale step | `bg-gray-50`, `text-gray-700`    |
| `success-{25..950}`           | Approved, QA-accepted, dispatched, payment cleared                                                    | `bg-success-50 text-success-700` |
| `warning-{25..950}`           | Pending approval, QA hold, low stock, near-due                                                        | `bg-warning-50 text-warning-700` |
| `error-{25..950}`             | Rejected, QA-failed, overdue, validation failure                                                      | `bg-error-50 text-error-700`     |
| `chart-{1..5}`                | Categorical dashboard/chart series only — never for status or UI chrome                               | `fill-[var(--color-chart-1)]`    |

**Semantic usage rule:** `success`/`warning`/`error` map 1:1 to a `statuses.color_token` value or a form/request outcome — never used decoratively. `brand` is the only color used for primary interactive affordances (buttons, active states, focus rings). Every colored surface pairs a `-50`/`-25` (or `-950` in dark mode) background with a `-700`/`-300` text shade for contrast — see `StatusBadge` and `Alert` for the reference pairing.

**Dark mode substitution table** (light class → dark class, same component):

| Light                   | Dark                                                                                   |
| ----------------------- | -------------------------------------------------------------------------------------- |
| `bg-white`              | `dark:bg-gray-dark`                                                                    |
| `bg-gray-50`            | `dark:bg-gray-900` / `dark:bg-gray-800` (surface vs. subtle fill — see existing usage) |
| `text-gray-900`         | `dark:text-white/90`                                                                   |
| `text-gray-500`         | `dark:text-gray-400`                                                                   |
| `border-gray-200`/`300` | `dark:border-gray-800`/`700`                                                           |
| `bg-{semantic}-50`      | `dark:bg-{semantic}-950`                                                               |
| `text-{semantic}-700`   | `dark:text-{semantic}-300`                                                             |

Every color utility ships with its `dark:` pair **in the same commit** — see `packages/ui-kit/src/components/*/index.tsx` for the pattern applied consistently.

### 1.2 Typography

`--font-sans` (Inter), `--font-mono` (JetBrains Mono), `--font-serif` (Merriweather) — wired via `next/font/google` in `apps/ui/src/app/layout.tsx`, exposed as CSS variables theme.css reads. Type scale: `text-title-{2xl,xl,lg,md,sm}` (page/section headings, 30–72px) and `text-theme-{xl,sm,xs}` (UI text, 12–20px) — each carries its own `--line-height`, so `text-theme-sm` always means the same line-height too, not just font-size. UI copy (labels, body, table cells) uses `text-theme-*`; page/section titles use `text-title-*`.

### 1.3 Spacing & density

No custom spacing scale — Tailwind's default spacing scale (`p-4`, `gap-2`, ...) is the spacing system. Density convention actually in use across `ui-kit`: form controls and buttons default to a comfortable density (`h-10`/`px-3.5`–`px-4`/`py-2.5`), with a `sm` variant (`h-8`/`px-3`) for compact contexts (table row actions, toolbars). Don't introduce a third size without a real density need.

### 1.4 Borders, radii, shadows

Radii: `rounded-lg` (buttons, inputs, badges use `rounded-full`), `rounded-xl` (cards, tables, dialogs). Borders: `border-gray-200`/`dark:border-gray-800` for containers; `border-gray-300`/`dark:border-gray-700` for form controls. Shadows: `shadow-theme-{xs,sm,md,lg,xl}` tokens (theme.css) — `xs` on buttons/inputs/cards, `lg`/`xl` on floating surfaces (dialogs, toasts). `--shadow-focus-ring` exists as a token but the actual focus treatment in use is Tailwind's `focus-visible:outline` + `focus:ring-3` utilities (see `Button`/`Input`) — reconcile these into one mechanism before adding a third focus pattern.

### 1.5 Layering (z-index)

No numeric z-index scale exists yet — the only layered surfaces so far are the native `<dialog>` (browser-managed top layer, `Dialog` component) and the fixed toast host (`z-50`, `ToastProvider`). If a third layered surface is needed (dropdown, popover), define an explicit scale here before hand-picking a z-index.

### 1.6 Motion & reduced motion

In use: `transition-colors` (buttons, interactive surfaces), `animate-pulse` (`Skeleton`), `animate-spin` (`Spinner`). None of these currently respect `prefers-reduced-motion` — Tailwind's animations don't auto-disable for it. **Gap, not yet fixed:** wrap these utilities with `motion-safe:`/`motion-reduce:` variants (e.g. `motion-reduce:animate-none` on `Skeleton`/`Spinner`) before this is a real accessibility guarantee rather than an aspiration.

### 1.7 Light/dark mode

`@custom-variant dark (&:is(.dark *))` (`theme.css`) — dark mode is a `.dark` class on an ancestor (typically `<html>`), not the `prefers-color-scheme` media query directly. **Gap, not yet built:** there is no theme toggle or persisted preference yet — the app currently only renders in light mode (no `.dark` class is ever applied). Every component in `ui-kit` is written with `dark:` classes ready for when that toggle exists; don't skip them on a new component just because dark mode isn't wired up yet.

### 1.8 Responsive behavior

Mobile-first Tailwind breakpoints, standard defaults (no custom breakpoints defined). The desktop-first ERP shell (Docs/ARCHITECTURE.md) means components are _designed_ for desktop widths first but must not visually break narrower — the concrete mechanism for tables specifically is `DataTable`'s own `overflow-x-auto` wrapper (§4 below), not a responsive column-hiding scheme (none exists yet).

### 1.9 Tailwind class literals

**Every Tailwind class is a complete literal string, never built by interpolating a variable into a class name.** Tailwind's compiler only sees classes that appear literally in source — `` `bg-${color}-500` `` is invisible to it and silently produces no styling in a production build. The pattern used throughout `ui-kit` instead: a `Record<Variant, string>` literal map, indexed by the variant value —

```tsx
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-brand-500 text-white hover:bg-brand-600 ...",
  secondary: "bg-white text-gray-700 border border-gray-300 ...",
};
// ...
className={cn(VARIANT_CLASSES[variant], className)}
```

See `packages/ui-kit/src/components/button/index.tsx`, `alert/index.tsx`, and `status-badge/index.tsx` for the pattern applied to 3+ variant sets.

---

## 2. Shared component contracts

Every component below lives at `packages/ui-kit/src/components/<name>/index.tsx`, is exported from `packages/ui-kit/src/index.ts`, and is imported as `import { X } from "@texawave-erp/ui-kit"` — never copy-pasted or reimplemented locally. Generic primitives (this list) have **no API calls and no domain knowledge** — a component that reads from `statuses`, calls a hook that hits the API, or knows about a specific module is a _widget_ and belongs in `apps/ui/src/features/<module>/components/`, not here (Docs/CODING_STANDARDS.md §4).

| Component                            | Public props (non-exhaustive)                                                                   | States covered                                                                                                                                                                                                  |
| ------------------------------------ | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button`                             | `variant` (primary/secondary/ghost/destructive), `size` (sm/md/lg), `loading`                   | disabled, loading (spinner + `aria-busy`), focus-visible                                                                                                                                                        |
| `Input` / `Textarea` / `Select`      | `invalid`                                                                                       | disabled, invalid (`aria-invalid` + error border), focus                                                                                                                                                        |
| `Checkbox`                           | standard `input` props                                                                          | disabled, focus                                                                                                                                                                                                 |
| `FormField`                          | `label`, `error`, `hint`, `required`, `labelAction`, render-prop `children`                     | wires `aria-describedby`/`aria-invalid`/`<label htmlFor>` automatically; `labelAction` renders trailing content on the label row (e.g. "Forgot your password?" next to the Password label — see the login page) |
| `Card`                               | —                                                                                               | —                                                                                                                                                                                                               |
| `Alert`                              | `variant` (info/success/warning/error), `title`                                                 | distinct icon per variant (never color alone)                                                                                                                                                                   |
| `Toast` (`ToastProvider`/`useToast`) | `toast({ title, description, variant })`                                                        | auto-dismiss (5s), manually dismissible, `aria-live="polite"` region                                                                                                                                            |
| `Skeleton`                           | —                                                                                               | loading placeholder                                                                                                                                                                                             |
| `EmptyState`                         | `title`, `description`, `action`                                                                | "nothing here" — never used to hide a request failure (§3)                                                                                                                                                      |
| `ErrorState`                         | `title`, `description`, `onRetry`                                                               | request failed, with retry                                                                                                                                                                                      |
| `StatusBadge`                        | `label`, `colorToken`                                                                           | the _only_ status renderer — every module reads `color_token` and renders through this (Docs/CODING_STANDARDS.md §12)                                                                                           |
| `DataTable`                          | `columns`, `rows`, `getRowKey`                                                                  | generic, dumb; horizontal scroll on overflow                                                                                                                                                                    |
| `Pagination`                         | `page`, `totalPages`, `onPageChange`                                                            | hides itself when `totalPages <= 1`                                                                                                                                                                             |
| `Dialog`                             | `open`, `onClose`, `title`, `size` (`sm`/`md`/`lg`/`xl`/`2xl`)                                  | native `<dialog>`/`showModal()` — real focus trap + Esc-to-close for free, viewport max-height with internal scroll, and responsive padding                                                                     |
| `DateRangePicker`                    | `value`, `onChange`, `onApply`, `onClear`, `variant`, `presets`, `fromAriaLabel`, `toAriaLabel` | accessible date-range popover calendar with quick presets, month/year jumper, range highlights, Escape/click-outside dismiss, and dual textbox ("inputs") or pill button ("button") variants                    |

Every component: typed props (no `any`), keyboard/focus behavior via native semantics where possible (`<button>`, `<dialog>`, `<label htmlFor>`) rather than hand-rolled ARIA, `dark:` classes alongside every light one (§1.7 notwithstanding — write them now, wire the toggle later), and a public import path through the package barrel (`packages/ui-kit/src/index.ts`) — never `import { Button } from "@texawave-erp/ui-kit/src/components/button"`.

---

## 3. Screen interaction states

Every screen that fetches or mutates data must account for all of these — the reference feature (`apps/ui/src/features/_reference/tags/components/TagsView.tsx`) demonstrates each one; copy its shape, not just its imports:

- **Initial loading:** `Skeleton` rows, not a blank screen or a spinner-only page.
- **Empty data:** `EmptyState` — "no tags yet", with a way to create one if the user has permission.
- **No search/filter results:** same `EmptyState` component, different copy ("no tags match…") — not implemented in the reference feature yet (it has no search UI), but this is the pattern: never reuse the exact same empty-state copy for "nothing exists" and "nothing matched your filter," they're different situations for the user.
- **Request error, with retry:** `ErrorState` with `onRetry` calling the query's `refetch()`. **Never** render `EmptyState` for a failed request — that tells the user "there's nothing here" when the truth is "we don't know, the request failed." `TagsView` checks `query.isError` before `tags.length === 0` specifically to keep these separate.
- **Permission denied:** checked via `ApiError.isPermissionError` (403) and rendered as a distinct `Alert`, not folded into the generic error state — the user needs a different message ("ask for access") than "try again."
- **Save in progress:** `Button`'s `loading` prop (disables the button, shows a spinner, sets `aria-busy`) — `TagForm` sets this for the whole submit round trip.
- **Field-validation errors:** `FormField`'s `error` prop, populated from the same zod schema (`packages/core`'s `createTagSchema`) the mutation payload has to satisfy server-side — see `TagForm.tsx`.
- **Unsaved changes:** **not implemented yet.** The reference feature's forms are single-field-simple enough that accidental navigation loss is low-stakes; a form with more than 2-3 fields should warn on navigate-away (e.g. `beforeunload` / a router guard) before this gap is acceptable to copy forward.
- **Keyboard navigation:** native elements throughout (`<button>`, `<input>`, `<select>`, `<dialog>`) means tab order and Enter/Space activation work without extra code — verified manually via the Playwright test's `getByRole`/`getByLabel` selectors, which only resolve when the accessible name/role is actually correct.
- **Mobile / table overflow:** `DataTable`'s `overflow-x-auto` wrapper (§1.8).

**Never use color alone to communicate status:** `StatusBadge` always renders the label text, never a bare swatch; `Alert` pairs each semantic color with a distinct glyph (ℹ/✓/▲/✕), not just a background tint.

**Preserve entered form values when submission fails:** `TagForm` and the login page keep all field state in local component state and only ever clear it on success — a failed submit leaves every field exactly as the user left it (verified by the Playwright test `rejects a bad login and lets the user retry without losing the organization field`).

---

## 4. Forms, tables, dialogs, toasts, navigation — conventions

- **Auth/standalone cards (login, forgot-password, reset-password):** `Card` with an `<h1>` title (`text-theme-xl font-semibold`) directly followed by a one-line description (`text-theme-sm text-gray-500 dark:text-gray-400`) explaining what the form does — see `apps/ui/src/app/(auth)/login/page.tsx` and `apps/ui/src/features/auth/components/*.tsx` for the pattern applied to all three auth screens, including their success/error terminal states (which keep the same title so the card doesn't visually jump).
- **Forms:** one `FormField` per input, local `useState` per field (no form library yet — `react-hook-form`/similar is a reasonable future addition once forms get larger than 3-4 fields, not needed for the reference feature's two-field form), zod-validated on submit, errors mapped from `ZodError.issues` by `path[0]`.
- **Tables:** `DataTable` + `Pagination`, driven by a `PaginationMeta` from the API envelope — never re-derive `totalPages` client-side when the server already computed it.
- **Dialogs:** one open/close boolean in the parent, native `<dialog>` underneath — don't build a second modal mechanism (a manually-positioned `fixed` div) alongside this one.
- **Toasts:** fire-and-forget via `useToast().toast(...)` for the _result_ of an action (created/deleted/failed) — not for validation errors, which belong inline via `FormField`.
- **Date Range Filters (`DateRangePicker`):** Reusable across all filter toolbars (`Attendance`, `My Attendance`, `Work Logs`, `My Work Logs`, `Employees`, `Interviews`). Supports:
  - **Single Unified Trigger:** Renders a single compact ERP trigger field displaying `📅  01 Oct 2026 – 09 Oct 2026      ✕  ⌄` (or custom placeholder). No duplicate browser native date boxes.
  - **A11y & E2E Testing:** Visually hidden textboxes (`sr-only`) for `"From date"` and `"To date"` ensure Playwright tests and screen readers find and interact with the range seamlessly.
  - **Interaction:** Calendar popover with quick presets (Today, Yesterday, This Week, This Month, Last Month, Last 30 Days), Month/Year jump controls, interactive 7x6 calendar grid with range highlighting (`brand-500` ends, `brand-50` fill), day count display, `Clear`, `Cancel`, and `Apply`.
  - **Dismissal:** Full keyboard navigation, `Escape` key dismissal, and outside-click close.
- **Navigation:** the `(dashboard)` route group's shell (`apps/ui/src/app/(dashboard)/layout.tsx`) is intentionally minimal (header + sign-out) — a real sidebar/nav structure is business-module scope, not foundation scope; don't build it speculatively here.

---

## 5. Accessibility expectations & how they're checked

- Every interactive control has an accessible name — either visible text (`Button` children), an explicit `aria-label` (icon-only actions, e.g. `DataTable`'s delete action), or a `<label htmlFor>` (`FormField`).
- Every error/status message that should be announced uses `role="alert"` (errors) or `role="status"` (neutral updates) — see `Alert`, `ErrorState`, `FormField`'s error paragraph, `ToastProvider`'s live region.
- Focus management for dialogs comes from the native `<dialog>` element, not hand-rolled.
- **How this is actually checked today:** the Playwright e2e test (`apps/ui/e2e/reference-tags.spec.ts`) exercises the login-and-create-tag flow exclusively through `getByRole`/`getByLabel` locators — those only resolve when the accessible name/role tree is correct, so a broken `aria-label` or missing `<label>` fails the test, not just a manual audit. **Not yet added:** an automated axe-core/`@axe-core/playwright` scan — a reasonable next step, not implemented in this foundation pass.
- **Brand-green contrast (checked 2026-10-01, WCAG relative-luminance formula):** `brand-500` (`#06ba32`) is only 2.6:1 against white, so it is never used behind white text or as light-mode link/body text. Primary `Button` and the active sidebar item pair `brand-500` with `gray-900` text (6.8:1); text links use `brand-800` on white (6.5:1); `brand-50`-tinted badges use `brand-800` text (5.6:1); the `Checkbox` fill uses `brand-600` (3.4:1 against white, above the 3:1 non-text minimum). Don't put white text on `brand-500`/`-600`, or `brand-700` text on a `brand-50` surface (3.8:1), without re-running the numbers.
- **Not yet verified:** color contrast ratios against WCAG AA for the remaining token pairings in §1.1 — the pairings follow a consistent `-50`/`-700` (light) and `-950`/`-300` (dark) pattern that's a reasonable starting point, but no automated contrast check has been run.
