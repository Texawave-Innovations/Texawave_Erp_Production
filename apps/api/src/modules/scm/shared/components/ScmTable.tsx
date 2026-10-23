import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableCaption,
  TableHead as BaseTableHead,
  TableCell as BaseTableCell,
} from "@/components/ui/table";

/**
 * SCM's drop-in replacement for the shared `TableHead`/`TableCell` — identical except `TableHead`
 * defaults to the same center alignment `TableCell` already uses, so a plain header sits directly
 * above its column's content instead of sitting left while the content underneath renders center
 * (e.g. the "SO #" header at the far left of a column whose values render in the middle of it).
 * Any explicit alignment className a caller already passes on either component (e.g. `text-right`
 * on an Actions column, header and cell both) still wins as before — `cn`/`tailwind-merge`
 * resolves the conflicting text-align utility deterministically by last-one-wins, so only headers
 * that previously relied on the shared component's bare left default are affected. `TableRow`/etc.
 * are re-exported unchanged. Scoped to SCM via this file rather than changing
 * `@/components/ui/table` itself, which is shared by every other module in the app.
 */
const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <BaseTableHead
    ref={ref}
    className={cn("text-center", className)}
    {...props}
  />
));
TableHead.displayName = "TableHead";

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <BaseTableCell
    ref={ref}
    className={cn("text-center", className)}
    {...props}
  />
));
TableCell.displayName = "TableCell";

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableCaption,
  TableHead,
  TableCell,
};
