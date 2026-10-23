import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Button as BaseButton,
  buttonVariants,
  type ButtonProps,
} from "@/components/ui/button";

/**
 * SCM's drop-in replacement for the shared `Button` — identical except it always keeps `shrink-0`.
 * The shared component has no default there, so a `Button` sitting in a `flex justify-between`
 * header row (the layout used across almost every SCM list/detail page) could be squeezed by
 * flexbox below its label's natural width once the row got tight — and because the base button
 * also sets `overflow-hidden` (for its hover "shine" sweep) and `whitespace-nowrap`, the shrunk
 * button clipped its own label instead of wrapping or staying full width (e.g. "Request Movement"
 * rendering as "Request Moveme"). `shrink-0` simply stops a button from ever donating space to its
 * siblings; it has no effect where a button already had room. Scoped to SCM via this file rather
 * than changing `@/components/ui/button` itself, which is shared by every other module in the app.
 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, ...props }, ref) => (
    <BaseButton ref={ref} className={cn("shrink-0", className)} {...props} />
  ),
);
Button.displayName = "Button";

export { Button, buttonVariants };
