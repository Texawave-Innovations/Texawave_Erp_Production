import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./utils";

const badgeVariants = cva(
  [
    "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
    "transition-all duration-150 ease-smooth",
    "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-brand-500 text-white hover:bg-brand-600 shadow-sm",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/85 shadow-sm",
        outline:
          "text-brand-700 border-brand-300 bg-brand-50/50 hover:bg-brand-50",
        success: "bg-brand-50 text-brand-700 border-brand-200 font-medium",
        warning:
          "border-transparent bg-warning/15 text-warning border-warning/30",
        info: "border-transparent bg-info/15 text-info border-info/30",
        gradient: "border-transparent bg-gradient-primary text-white shadow-sm",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
