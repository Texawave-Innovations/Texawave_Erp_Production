"use client";

import { ArrowLeft } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

/** Forms in SCM open on the page itself, not in a pop-up. `ScmPanelHost`
 * (mounted once by the SCM shell) owns a slot above the page content; a
 * `ScmPanel` that opens renders into that slot and the page content is hidden
 * (not unmounted) until the panel closes, so a list keeps its filters, page
 * and scroll position when the user comes back. */
interface HostValue {
  slot: HTMLElement | null;
  enter: () => void;
  leave: () => void;
}

const HostContext = createContext<HostValue | null>(null);

export function ScmPanelHost({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(0);
  const enter = useCallback(() => setOpen((n) => n + 1), []);
  const leave = useCallback(() => setOpen((n) => Math.max(0, n - 1)), []);
  const value = useMemo(() => ({ slot, enter, leave }), [slot, enter, leave]);

  return (
    <HostContext.Provider value={value}>
      <div ref={setSlot} />
      <div className={open > 0 ? "hidden" : undefined}>{children}</div>
    </HostContext.Provider>
  );
}

export type ScmPanelSize = "sm" | "md" | "lg" | "xl" | "2xl";

const WIDTH: Record<ScmPanelSize, string> = {
  sm: "max-w-xl",
  md: "max-w-xl",
  lg: "",
  xl: "",
  "2xl": "",
};

export interface ScmPanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: ScmPanelSize | undefined;
  className?: string | undefined;
}

/** Drop-in replacement for the ui-kit `Dialog` (same props) that opens the
 * form in the page instead of over it. */
export function ScmPanel({
  open,
  onClose,
  title,
  children,
  size = "lg",
}: ScmPanelProps) {
  const host = useContext(HostContext);
  const enter = host?.enter;
  const leave = host?.leave;
  const slot = host?.slot ?? null;

  useEffect(() => {
    if (!open || !enter || !leave) return;
    enter();
    return leave;
  }, [open, enter, leave]);

  // Bring the form to the top of the page when it opens.
  useEffect(() => {
    if (open) slot?.scrollIntoView({ block: "start" });
  }, [open, slot]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const panel = (
    <section
      role="dialog"
      aria-label={title}
      className={`w-full rounded-2xl border border-gray-200 bg-white shadow-xs dark:border-gray-800 dark:bg-gray-dark ${WIDTH[size]}`}
    >
      <header className="border-b border-gray-200 px-3 py-3 dark:border-gray-800">
        {/* The arrow and the title are one back button, not just the arrow. */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Back"
          title="Back"
          className="group flex items-center gap-3 rounded-xl px-2 py-1 text-left outline-none hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-brand-300 dark:hover:bg-gray-800"
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gray-100 text-gray-600 group-hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:group-hover:bg-gray-700">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </span>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white/90">
            {title}
          </h2>
        </button>
      </header>
      <div className="p-5">{children}</div>
    </section>
  );

  if (!host) return panel;
  return slot ? createPortal(panel, slot) : null;
}
