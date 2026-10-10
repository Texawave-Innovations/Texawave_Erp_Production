"use client";

import { useEffect, useState } from "react";

export interface AnimatedNumberProps {
  value: number;
  duration?: number;
  formatter?: (val: number) => string;
}

/**
 * Lightweight, accessible count-up animation for numeric KPI figures.
 * Respects prefers-reduced-motion (renders target value immediately).
 * Conforms to Docs/DESIGN_SYSTEM.md §1.6 and performance requirements.
 */
export function AnimatedNumber({
  value,
  duration = 500,
  formatter,
}: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState<number>(0);

  useEffect(() => {
    const isReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (isReduced || value === 0) {
      const frameId = requestAnimationFrame(() => {
        setDisplayValue(value);
      });
      return () => cancelAnimationFrame(frameId);
    }

    const startValue = 0;
    const endValue = value;
    const startTime = performance.now();

    let animationFrameId: number;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease out cubic: 1 - (1 - t)^3
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(
        startValue + (endValue - startValue) * easeProgress,
      );

      setDisplayValue(current);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      }
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [value, duration]);

  const formatted = formatter ? formatter(displayValue) : String(displayValue);

  return <>{formatted}</>;
}
