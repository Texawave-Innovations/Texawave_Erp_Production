import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Legacy shadcn `cn` (clsx + tailwind-merge). Use this — not `@/lib/utils` — inside CRM legacy UI. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
