"use client";

import * as React from "react";
import { cn } from "./utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, onWheel, onFocus, ...props }, ref) => {
    const handleWheel = (e: React.WheelEvent<HTMLInputElement>) => {
      if (type === "number") e.currentTarget.blur();
      onWheel?.(e);
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      if (type === "number") e.currentTarget.select();
      onFocus?.(e);
    };

    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2",
          "text-sm ring-offset-background",
          "placeholder:text-muted-foreground/60",
          "transition-all duration-150 ease-smooth",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus focus-visible:ring-offset-1 focus-visible:border-brand-500",
          "hover:border-brand-400",
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted/40",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
          className,
        )}
        ref={ref}
        onWheel={handleWheel}
        onFocus={handleFocus}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
