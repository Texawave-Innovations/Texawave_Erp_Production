import clsx, { type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * Custom font-size tokens declared as `--text-*` in `theme.css`.
 *
 * tailwind-merge only knows Tailwind's built-in sizes (`text-xs`, `text-sm`…).
 * An unknown `text-*` class is assumed to be a text COLOUR, so
 * `cn("text-white", "text-theme-xs")` used to drop `text-white` and the label
 * inherited whatever colour its parent had — dark text on blue buttons.
 *
 * Every `--text-<name>` token in `theme.css` must be listed here;
 * `packages/ui-kit/test/cn.test.ts` fails when one is missing.
 */
export const CUSTOM_FONT_SIZES = [
  "title-2xl",
  "title-xl",
  "title-lg",
  "title-md",
  "title-sm",
  "theme-xl",
  "theme-sm",
  "theme-xs",
] as const;

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: [...CUSTOM_FONT_SIZES] }],
    },
    /**
     * `Button` variants paint a gradient (`bg-linear-135 from-* via-* to-*`),
     * which is a background IMAGE. A call site that passes `bg-sky-50` or
     * `bg-emerald-600` means "use this colour instead", but a colour does not
     * replace an image, so the gradient kept showing underneath and the
     * tinted label colours became unreadable. A later background colour now
     * drops the earlier gradient (and its stops), for the same modifier.
     */
    conflictingClassGroups: {
      "bg-color": ["bg-image", "gradient-from", "gradient-via", "gradient-to"],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
