import type { HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export type CardTone = "default" | "success" | "warning" | "error" | "info";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: CardTone | undefined;
}

const TONE_BORDER_CLASSES: Record<CardTone, string> = {
  default: "gradient-card-border",
  success: "gradient-card-border-success",
  warning: "gradient-card-border-warning",
  error: "gradient-card-border-error",
  info: "gradient-card-border-info",
};

export function Card({ tone = "default", className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl bg-white p-5 shadow-[0_2px_12px_rgba(23,105,245,0.03)]",
        TONE_BORDER_CLASSES[tone],
        "dark:bg-gray-dark",
        className,
      )}
      {...props}
    />
  );
}
