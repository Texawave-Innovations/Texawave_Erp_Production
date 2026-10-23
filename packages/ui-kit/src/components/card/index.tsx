import type { HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export type CardTone =
  "default" | "success" | "warning" | "error" | "info" | "none";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: CardTone | undefined;
}

const TONE_BORDER_CLASSES: Record<CardTone, string> = {
  default: "gradient-card-border",
  success: "gradient-card-border-success",
  warning: "gradient-card-border-warning",
  error: "gradient-card-border-error",
  info: "gradient-card-border-info",
  none: "",
};

export function Card({ tone = "default", className, ...props }: CardProps) {
  const hasCustomBg =
    className && (className.includes("bg-") || className.includes("from-"));
  return (
    <div
      className={cn(
        "rounded-2xl p-5 card-light-shadow",
        !hasCustomBg && "bg-white dark:bg-gray-dark",
        tone !== "none" && !hasCustomBg && TONE_BORDER_CLASSES[tone],
        className,
      )}
      {...props}
    />
  );
}
