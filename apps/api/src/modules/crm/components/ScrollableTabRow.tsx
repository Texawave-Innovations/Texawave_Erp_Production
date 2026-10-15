// Shared horizontal-scroll behavior for any row of tabs/pills that can overflow — left/right
// arrow buttons, edge fade indicators, and auto-scroll-into-view for the active item. Mirrors
// the global CRM top nav (`CRMLayout.tsx`) exactly, so every scrollable tab row in the CRM
// module (the top nav, an Account/Deal/Lead detail page's sub-tabs, …) behaves identically.
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const SCROLL_STEP = 260;

export function ScrollableTabRow({
  children,
  activeValue,
  className,
}: {
  children: ReactNode;
  /** The currently-active tab's value — scrolls it into view whenever this changes. */
  activeValue?: string;
  className?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener("scroll", updateScrollState, { passive: true });
    const resizeObserver = new ResizeObserver(updateScrollState);
    resizeObserver.observe(el);
    window.addEventListener("resize", updateScrollState);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateScrollState);
    };
  }, [updateScrollState]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const active = el.querySelector<HTMLElement>(
      '[data-state="active"], [aria-current="page"]',
    );
    active?.scrollIntoView({
      behavior: "smooth",
      inline: "nearest",
      block: "nearest",
    });
  }, [activeValue]);

  const scrollByStep = (direction: 1 | -1) => {
    scrollRef.current?.scrollBy({
      left: direction * SCROLL_STEP,
      behavior: "smooth",
    });
  };

  return (
    <div className={cn("relative flex items-center gap-1.5", className)}>
      <button
        type="button"
        onClick={() => scrollByStep(-1)}
        disabled={!canScrollLeft}
        aria-label="Scroll tabs left"
        title="Scroll tabs left"
        className={cn(
          "shrink-0 z-10 flex items-center justify-center h-8 w-8 rounded-xl border border-brand-500 bg-gradient-to-br from-brand-400 to-brand-500 text-white shadow-sm transition-all duration-200",
          canScrollLeft
            ? "hover:from-brand-500 hover:to-brand-600 hover:shadow active:scale-95 cursor-pointer"
            : "opacity-40 cursor-not-allowed",
        )}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <div className="relative flex-1 min-w-0">
        <div
          ref={scrollRef}
          className="crm-tabs-scroll flex gap-2 overflow-x-auto p-1 -m-1 scroll-smooth"
        >
          {children}
        </div>
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-background to-transparent transition-opacity duration-200",
            canScrollLeft ? "opacity-100" : "opacity-0",
          )}
        />
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent transition-opacity duration-200",
            canScrollRight ? "opacity-100" : "opacity-0",
          )}
        />
      </div>

      <button
        type="button"
        onClick={() => scrollByStep(1)}
        disabled={!canScrollRight}
        aria-label="Scroll tabs right"
        title="Scroll tabs right"
        className={cn(
          "shrink-0 z-10 flex items-center justify-center h-8 w-8 rounded-xl border border-brand-600 bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-sm transition-all duration-200",
          canScrollRight
            ? "hover:from-brand-600 hover:to-brand-700 hover:shadow active:scale-95 cursor-pointer"
            : "opacity-40 cursor-not-allowed",
        )}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
