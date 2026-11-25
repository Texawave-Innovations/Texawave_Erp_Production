/**
 * Legacy shadcn `cn`. It is the shared ui-kit `cn` (clsx + tailwind-merge with
 * the project's custom font sizes registered) — do not re-implement it here, a
 * plain `twMerge` drops `text-white` next to `text-theme-xs`.
 * Use this — not `@/lib/utils` — inside CRM legacy UI.
 */
export { cn } from "@texawave-erp/ui-kit";
