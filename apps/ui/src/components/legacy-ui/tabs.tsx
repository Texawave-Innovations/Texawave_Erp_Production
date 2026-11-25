"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "./utils";

// CRM's Radix tabs, styled as the ui-kit `Tabs` capsule
// (packages/ui-kit/src/components/tabs, Docs/DESIGN_SYSTEM.md) so every tab
// bar in the app looks and moves the same: a fully rounded capsule with a
// rounded `tab-prime-pill` that glides to the active trigger. Only the pill
// moves; triggers just change text colour. The capsule shape, the active
// text colour and the "no icons" rule are applied after the caller's
// `className`, so older per-screen overrides (rounded-xl, text-brand-700 on
// the active tab, …) cannot fight the pill.

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, children, ...props }, ref) => {
  const listRef = React.useRef<HTMLDivElement | null>(null);
  const [pill, setPill] = React.useState({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    opacity: 0,
  });
  const [glideReady, setGlideReady] = React.useState(false);

  const setRefs = React.useCallback(
    (node: HTMLDivElement | null) => {
      listRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );

  React.useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const measure = () => {
      const active = list.querySelector<HTMLElement>(
        '[role="tab"][data-state="active"]',
      );
      if (!active) {
        setPill((p) => ({ ...p, opacity: 0 }));
        return;
      }
      // Offsets are relative to the list padding box: right while the
      // capsule scrolls sideways, and unaffected by its border.
      setPill({
        left: active.offsetLeft,
        top: active.offsetTop,
        width: active.offsetWidth,
        height: active.offsetHeight,
        opacity: 1,
      });
      if (list.scrollWidth > list.clientWidth) {
        const target =
          active.offsetLeft - (list.clientWidth - active.offsetWidth) / 2;
        list.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
      }
    };
    measure();
    // No transition until the first position is in, so the pill appears in
    // place on load instead of sliding in from the corner.
    const frame = requestAnimationFrame(() => setGlideReady(true));
    const mutations = new MutationObserver(measure);
    mutations.observe(list, {
      subtree: true,
      attributes: true,
      attributeFilter: ["data-state"],
      childList: true,
    });
    const resize = new ResizeObserver(measure);
    resize.observe(list);
    return () => {
      cancelAnimationFrame(frame);
      mutations.disconnect();
      resize.disconnect();
    };
  }, []);

  return (
    <TabsPrimitive.List
      ref={setRefs}
      className={cn(
        "relative isolate inline-flex max-w-full items-center gap-1 overflow-x-auto border border-sky-100 bg-white/90 shadow-[0_12px_32px_-14px_rgba(15,23,42,0.28)] backdrop-blur-md [scrollbar-width:none] [&::-webkit-scrollbar]:hidden dark:border-sky-900/50 dark:bg-gray-900/80 dark:shadow-[0_12px_32px_-14px_rgba(0,0,0,0.7)]",
        className,
        // Dark mode: CRM screens force dark inactive text (text-slate-700 /
        // text-black), unreadable on the dark capsule.
        "h-auto rounded-full p-1.5 dark:[&_[data-state=inactive]]:text-gray-300",
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn(
          "tab-prime-pill pointer-events-none absolute left-0 top-0 z-0 rounded-full will-change-transform motion-reduce:transition-none",
          glideReady &&
            "transition-[transform,width,height,opacity] duration-300 ease-spring-glide",
        )}
        style={{
          transform: `translate3d(${pill.left}px, ${pill.top}px, 0)`,
          width: `${pill.width}px`,
          height: `${pill.height}px`,
          opacity: pill.opacity,
        }}
      />
      {children}
    </TabsPrimitive.List>
  );
});
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "relative z-1 inline-flex shrink-0 items-center justify-center whitespace-nowrap px-5 py-2 text-theme-sm font-medium text-slate-600 transition-colors duration-300 ease-spring-glide hover:text-[#0a3271] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-cyan-500/30 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none dark:text-gray-300 dark:hover:text-white",
      className,
      "rounded-full bg-transparent shadow-none data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:shadow-none dark:text-gray-300 dark:data-[state=active]:text-white [&>svg]:hidden",
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
