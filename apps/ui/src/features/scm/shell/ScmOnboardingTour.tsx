"use client";

import { Button } from "@texawave-erp/ui-kit";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useAuthStore } from "@/stores/auth-store";
import { SCM_TOUR_STEPS } from "./scmTourSteps";

export interface ScmOnboardingTourHandle {
  /** Opens the tour from the beginning — used by the help-icon trigger. */
  openTour: () => void;
}

const OVERVIEW_PATH = "/scm/overview";

function tourStorageKey(userId: number) {
  return `scm_tour_seen_${userId}`;
}

function hasSeenTour(userId: number): boolean {
  try {
    return localStorage.getItem(tourStorageKey(userId)) === "1";
  } catch {
    return false;
  }
}

function markTourSeen(userId: number) {
  try {
    localStorage.setItem(tourStorageKey(userId), "1");
  } catch {
    // localStorage unavailable (e.g. private browsing) — tour will simply offer itself again.
  }
}

/** Self-contained SCM product tour. Mounted once inside `ScmShell`, so its
 * state survives navigation between SCM pages. Auto-opens once for a fresh
 * user's first visit to the Overview page; otherwise stays closed until
 * launched via the ref handle from the header's help-icon trigger. */
export const ScmOnboardingTour = forwardRef<ScmOnboardingTourHandle>(
  function ScmOnboardingTour(_props, ref) {
    const user = useAuthStore((s) => s.user);
    const router = useRouter();
    const pathname = usePathname();
    const [isOpen, setIsOpen] = useState(false);
    const [stepIndex, setStepIndex] = useState(0);
    const autoCheckedRef = useRef(false);

    const step = SCM_TOUR_STEPS[stepIndex]!;
    const totalSteps = SCM_TOUR_STEPS.length;

    useImperativeHandle(ref, () => ({
      openTour: () => {
        setStepIndex(0);
        setIsOpen(true);
      },
    }));

    // Auto-start once for a user's first visit to the Overview page. Runs
    // once per mount; a manual replay via the help icon always works
    // regardless of this flag.
    useEffect(() => {
      if (autoCheckedRef.current) return;
      if (!user) return;
      if (pathname !== OVERVIEW_PATH) return;
      autoCheckedRef.current = true;
      if (!hasSeenTour(user.userId)) {
        setStepIndex(0);
        setIsOpen(true);
      }
    }, [user, pathname]);

    // Lock background scroll while the tour is open, and restore it on close/unmount.
    useEffect(() => {
      if (!isOpen) return;
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = previousOverflow;
      };
    }, [isOpen]);

    useEffect(() => {
      if (!isOpen) return;
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") handleClose();
      };
      window.addEventListener("keydown", onKeyDown);
      return () => window.removeEventListener("keydown", onKeyDown);
      // eslint-disable-next-line react-hooks/exhaustive-deps -- handleClose is stable across renders, re-deriving it isn't needed
    }, [isOpen]);

    function finish() {
      if (user) markTourSeen(user.userId);
      setIsOpen(false);
      router.push(OVERVIEW_PATH);
    }

    function handleClose() {
      if (user) markTourSeen(user.userId);
      setIsOpen(false);
    }

    function handleNext() {
      if (stepIndex === totalSteps - 1) {
        finish();
        return;
      }
      setStepIndex((i) => Math.min(i + 1, totalSteps - 1));
    }

    const handleBack = () => setStepIndex((i) => Math.max(i - 1, 0));

    // Closes the tour and navigates to the step's route, so the destination
    // page is fully visible instead of sitting behind the modal overlay.
    function handleNavigateLink() {
      if (!step.route) return;
      if (user) markTourSeen(user.userId);
      setIsOpen(false);
      router.push(step.route);
    }

    if (!isOpen || typeof document === "undefined") return null;

    const isFirst = stepIndex === 0;
    const isLast = stepIndex === totalSteps - 1;
    const Icon = step.icon;

    return createPortal(
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="scm-tour-title"
        className="fixed left-0 top-0 z-[100] flex h-screen w-screen items-center justify-center p-4"
      >
        <div
          className="fixed left-0 top-0 h-screen w-screen bg-black/60 backdrop-blur-[2px]"
          onClick={handleClose}
        />

        <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-brand-200/60 bg-white shadow-2xl shadow-black/20 dark:border-gray-800 dark:bg-gray-dark">
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close tour"
            className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="relative overflow-hidden bg-gradient-to-br from-white via-brand-100/70 to-blue-100/50 px-6 pb-5 pt-6 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
            <span
              aria-hidden
              className="pointer-events-none absolute -left-12 -top-16 h-40 w-40 rounded-full bg-brand-300/40 blur-3xl"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute -bottom-16 right-6 h-40 w-40 rounded-full bg-blue-300/35 blur-3xl"
            />
            <div className="relative flex items-center gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-lg shadow-brand-500/25">
                <Icon className="h-6 w-6" />
              </span>
              <div className="min-w-0">
                <p className="text-theme-xs font-semibold uppercase tracking-wide text-brand-700">
                  Step {stepIndex + 1} of {totalSteps}
                </p>
                <h2
                  id="scm-tour-title"
                  className="truncate text-xl font-bold text-gray-900 dark:text-white/90"
                >
                  {step.title}
                </h2>
              </div>
            </div>
          </div>

          <div className="px-6 py-5">
            <p className="text-theme-sm leading-relaxed text-gray-500 dark:text-gray-400">
              {step.description}
            </p>

            {step.route && !isLast ? (
              <div className="mt-4 flex justify-center">
                <button
                  type="button"
                  onClick={handleNavigateLink}
                  className="inline-flex items-center gap-1 text-theme-sm font-semibold text-brand-600 transition-colors hover:text-brand-700"
                >
                  Go to {step.navLabel ?? step.title}
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : null}

            <div className="mt-5 flex items-center justify-center gap-1.5">
              {SCM_TOUR_STEPS.map((s, i) => (
                <span
                  key={s.id}
                  className={`h-1.5 rounded-full transition-all ${
                    i === stepIndex
                      ? "w-6 bg-brand-500"
                      : "w-1.5 bg-gray-200 dark:bg-gray-700"
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-gray-100 px-6 py-4 dark:border-gray-800">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClose}
            >
              Skip Tour
            </Button>
            <div className="flex items-center gap-2">
              {!isFirst ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleBack}
                >
                  <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Back
                </Button>
              ) : null}
              <Button type="button" size="sm" onClick={handleNext}>
                {isLast ? "Start Using SCM" : "Next"}
                {!isLast ? <ArrowRight className="ml-1 h-3.5 w-3.5" /> : null}
              </Button>
            </div>
          </div>
        </div>
      </div>,
      document.body,
    );
  },
);
