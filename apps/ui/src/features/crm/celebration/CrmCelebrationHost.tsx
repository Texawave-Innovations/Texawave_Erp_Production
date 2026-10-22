"use client";

// CRM Core Domain — Success Celebration overlay. Mounted once in `CRMLayout`; listens on the
// module-level `celebrationBus` and renders whatever the latest `celebrateCrm(...)` call asked
// for. Two render styles: a big centered `modal` card with a confetti burst, firework bursts, and
// the full `CrmPartyDecor` treatment (balloons, flying butterflies, bunting) for major workflow
// moments (deal Won, Lead Promotion, task/follow-up/meeting completion, record creation) — except
// Lost/On Hold, which get the modal card but stay deliberately calm, never festive; and a small
// corner `toast` card for everyday CRUD confirmations. Both auto-dismiss on their own — the button
// never blocks the workflow, it's just an early-exit. Deliberately independent of the existing
// toast systems (sonner / shadcn `useToast`) — this complements them, never replaces error/success
// text feedback.
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import confetti from "canvas-confetti";
import { X } from "lucide-react";
import { cn } from "@/components/legacy-ui/utils";
import {
  CelebrationTone,
  CelebrationVariant,
  isPartyModalTone,
} from "./celebrationConfig";
import {
  CrmCelebrationEvent,
  subscribeCrmCelebrations,
} from "./celebrationBus";
import { prefersReducedMotion } from "./motionPrefs";
import { CrmPartyDecor } from "./CrmPartyDecor";

const REQUEUE_GAP_MS = 150;

// Explicit stacking tiers for the celebration overlay, painted in this order (lowest first):
// backdrop (BACKDROP_Z) -> confetti/balloons/butterflies/bunting (EFFECTS_Z) -> popup card
// (CARD_Z). `canvas-confetti` defaults its own canvas to `zIndex: 100` when not told otherwise,
// which used to land it BELOW the backdrop overlay — making the confetti render underneath the
// blur/dim layer and look faded. Every confetti() call below is given `zIndex: EFFECTS_Z`
// explicitly so its canvas always sits above the backdrop, never behind it.
const BACKDROP_Z = 10100;
const EFFECTS_Z = 10110;
const CARD_Z = 10120;

const TONE_CONFETTI_COLORS: Record<CelebrationTone, string[]> = {
  welcome: ["#2454e8", "#1769f5", "#FFD700", "#FFFFFF"],
  success: ["#2454e8", "#1769f5", "#12cfe3", "#FFFFFF"],
  promoted: ["#F59E0B", "#FBBF24", "#FDE68A", "#FFFFFF"],
  won: ["#2454e8", "#1769f5", "#FFD700", "#FFC94D", "#FFFFFF"],
  lost: [],
  hold: [],
  info: ["#3B82F6", "#60A5FA", "#FFFFFF"],
  progress: ["#F59E0B", "#FBBF24", "#FFFFFF"],
  teal: ["#0D9488", "#2DD4BF", "#5EEAD4", "#FFFFFF"],
  sky: ["#0284C7", "#38BDF8", "#7DD3FC", "#FFFFFF"],
  pink: ["#DB2777", "#F472B6", "#F9A8D4", "#FFFFFF"],
  violet: ["#7C3AED", "#A78BFA", "#C4B5FD", "#FFFFFF"],
  indigo: ["#4F46E5", "#818CF8", "#A5B4FC", "#FFFFFF"],
};

// A real firework: a thin rising "rocket" trail, then — once it reaches its apex — a radial
// burst that decays into trailing sparks, the way an actual firecracker looks. `canvas-confetti`
// has no built-in firework preset; this is the documented recipe (high `spread`, decaying
// particles) composed with a manual rocket-trail lead-in.
// `canvas-confetti` draws to a canvas of its own, independent of React and never unmounted with
// this component — every `window.setTimeout` below (up to ~800ms out) that schedules a burst must
// be cancellable, or triggering a celebration then immediately navigating away leaves confetti
// still bursting over whatever unrelated page the user has since moved to. Every fire* function
// below returns the raw timer ids it scheduled so the caller can clear them all on unmount.
function launchFirework(x: number, apexY: number, colors: string[]): number[] {
  try {
    confetti({
      particleCount: 1,
      angle: 90,
      spread: 3,
      startVelocity: 62,
      gravity: 0.1,
      decay: 0.98,
      ticks: 50,
      scalar: 0.5,
      colors: ["#FFFFFF"],
      origin: { x, y: 0.98 },
      zIndex: EFFECTS_Z,
    });
    const id = window.setTimeout(() => {
      confetti({
        particleCount: 130,
        spread: 360,
        startVelocity: 42,
        gravity: 0.9,
        decay: 0.9,
        ticks: 100,
        scalar: 1,
        colors,
        origin: { x, y: apexY },
        zIndex: EFFECTS_Z,
      });
      confetti({
        particleCount: 36,
        spread: 360,
        startVelocity: 18,
        gravity: 0.9,
        decay: 0.86,
        ticks: 60,
        scalar: 0.55,
        colors: ["#FFFFFF"],
        origin: { x, y: apexY },
        zIndex: EFFECTS_Z,
      });
    }, 300);
    return [id];
  } catch (err) {
    console.error("CRM celebration firework error:", err);
    return [];
  }
}

function fireFireworks(colors: string[]): number[] {
  const launches = [
    { x: 0.25, y: 0.28, delay: 0 },
    { x: 0.72, y: 0.22, delay: 260 },
    { x: 0.48, y: 0.32, delay: 520 },
  ];
  const timers: number[] = [];
  launches.forEach(({ x, y, delay }) => {
    timers.push(
      window.setTimeout(() => {
        timers.push(...launchFirework(x, y, colors));
      }, delay),
    );
  });
  return timers;
}

function fireConfetti(
  tone: CelebrationTone,
  variant: CelebrationVariant,
): number[] {
  if (prefersReducedMotion()) return [];
  const colors = TONE_CONFETTI_COLORS[tone];
  if (!colors.length) return [];
  const timers: number[] = [];
  try {
    if (variant === "toast") {
      confetti({
        particleCount: 24,
        spread: 55,
        startVelocity: 28,
        origin: { x: 0.92, y: 0.08 },
        colors,
        scalar: 0.75,
        zIndex: EFFECTS_Z,
      });
      return timers;
    }

    // Center puff, immediately on open.
    confetti({
      particleCount: 90,
      spread: 100,
      startVelocity: 40,
      origin: { x: 0.5, y: 0.35 },
      colors,
      shapes: ["star", "circle"],
      scalar: 1.05,
      zIndex: EFFECTS_Z,
    });

    // The "spray" — two party-popper cannons firing up and inward from the bottom corners,
    // the way a real confetti popper sprays, not just a puff falling from the center.
    timers.push(
      window.setTimeout(() => {
        confetti({
          particleCount: 50,
          angle: 60,
          spread: 55,
          startVelocity: 58,
          origin: { x: 0, y: 1 },
          colors,
          zIndex: EFFECTS_Z,
        });
        confetti({
          particleCount: 50,
          angle: 120,
          spread: 55,
          startVelocity: 58,
          origin: { x: 1, y: 1 },
          colors,
          zIndex: EFFECTS_Z,
        });
      }, 120),
    );

    timers.push(
      window.setTimeout(() => {
        confetti({
          particleCount: 45,
          spread: 110,
          startVelocity: 30,
          origin: { x: 0.15, y: 0.4 },
          colors,
          zIndex: EFFECTS_Z,
        });
        confetti({
          particleCount: 45,
          spread: 110,
          startVelocity: 30,
          origin: { x: 0.85, y: 0.4 },
          colors,
          zIndex: EFFECTS_Z,
        });
      }, 260),
    );

    if (isPartyModalTone(tone)) {
      // The real fireworks moment — every modal-tier celebration gets it (every "completed"
      // action, every record created, Won, Promotion, Welcome), except Lost/On Hold which stay
      // deliberately calm. The flying butterflies themselves come from `CrmPartyDecor`, not confetti.
      timers.push(
        window.setTimeout(() => {
          timers.push(...fireFireworks(colors));
        }, 380),
      );
    }

    if (tone === "welcome") {
      // Extra encouraging touch for the CRM entry moment — a slower, wider follow-up shower.
      timers.push(
        window.setTimeout(() => {
          confetti({
            particleCount: 65,
            spread: 140,
            startVelocity: 20,
            gravity: 0.6,
            origin: { x: 0.5, y: 0.1 },
            colors,
            shapes: ["star", "circle"],
            zIndex: EFFECTS_Z,
          });
        }, 700),
      );
    }
  } catch (err) {
    console.error("CRM celebration confetti error:", err);
  }
  return timers;
}

interface ToneVisual {
  badgeBg: string;
  badgeGlow: string;
  iconColor: string;
  titleColor: string;
  buttonClass: string;
}

const TONE_VISUAL: Record<CelebrationTone, ToneVisual> = {
  welcome: {
    badgeBg: "bg-gradient-to-br from-brand-400 to-brand-600",
    badgeGlow: "bg-brand-400/40",
    iconColor: "text-white",
    titleColor: "text-brand-600",
    buttonClass:
      "bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 text-white",
  },
  success: {
    badgeBg: "bg-brand-50 border border-brand-200",
    badgeGlow: "bg-brand-400/30",
    iconColor: "text-brand-600",
    titleColor: "text-brand-600",
    buttonClass: "bg-brand-600 hover:bg-brand-700 text-white",
  },
  promoted: {
    badgeBg: "bg-amber-50 border border-amber-200",
    badgeGlow: "bg-amber-400/35",
    iconColor: "text-amber-500",
    titleColor: "text-amber-500",
    buttonClass: "bg-amber-500 hover:bg-amber-600 text-white",
  },
  won: {
    badgeBg: "bg-gradient-to-br from-brand-400 to-brand-600",
    badgeGlow: "bg-amber-400/40",
    iconColor: "text-amber-300",
    titleColor: "text-brand-600",
    buttonClass: "bg-brand-600 hover:bg-brand-700 text-white",
  },
  lost: {
    badgeBg: "bg-red-50 border border-red-200",
    badgeGlow: "bg-red-400/25",
    iconColor: "text-red-500",
    titleColor: "text-red-600",
    buttonClass: "bg-red-600 hover:bg-red-700 text-white",
  },
  hold: {
    badgeBg: "bg-purple-50 border border-purple-200",
    badgeGlow: "bg-purple-400/25",
    iconColor: "text-purple-500",
    titleColor: "text-purple-600",
    buttonClass: "bg-purple-600 hover:bg-purple-700 text-white",
  },
  info: {
    badgeBg: "bg-blue-50 border border-blue-200",
    badgeGlow: "bg-blue-400/25",
    iconColor: "text-blue-600",
    titleColor: "text-blue-700",
    buttonClass: "bg-blue-600 hover:bg-blue-700 text-white",
  },
  progress: {
    badgeBg: "bg-amber-50 border border-amber-200",
    badgeGlow: "bg-amber-400/25",
    iconColor: "text-amber-600",
    titleColor: "text-amber-700",
    buttonClass: "bg-amber-600 hover:bg-amber-700 text-white",
  },
  teal: {
    badgeBg: "bg-teal-50 border border-teal-200",
    badgeGlow: "bg-teal-400/30",
    iconColor: "text-teal-600",
    titleColor: "text-teal-600",
    buttonClass: "bg-teal-600 hover:bg-teal-700 text-white",
  },
  sky: {
    badgeBg: "bg-sky-50 border border-sky-200",
    badgeGlow: "bg-sky-400/30",
    iconColor: "text-sky-600",
    titleColor: "text-sky-600",
    buttonClass: "bg-sky-600 hover:bg-sky-700 text-white",
  },
  pink: {
    badgeBg: "bg-pink-50 border border-pink-200",
    badgeGlow: "bg-pink-400/30",
    iconColor: "text-pink-600",
    titleColor: "text-pink-600",
    buttonClass: "bg-pink-600 hover:bg-pink-700 text-white",
  },
  violet: {
    badgeBg: "bg-violet-50 border border-violet-200",
    badgeGlow: "bg-violet-400/30",
    iconColor: "text-violet-600",
    titleColor: "text-violet-600",
    buttonClass: "bg-violet-600 hover:bg-violet-700 text-white",
  },
  indigo: {
    badgeBg: "bg-indigo-50 border border-indigo-200",
    badgeGlow: "bg-indigo-400/30",
    iconColor: "text-indigo-600",
    titleColor: "text-indigo-600",
    buttonClass: "bg-indigo-600 hover:bg-indigo-700 text-white",
  },
};

// `lost`-toned toasts (e.g. "Not a Fit Right Now") stay calm and neutral, not alarming red —
// the red treatment is reserved for the bigger `deal.lost` modal.
const NEUTRAL_TOAST_VISUAL: ToneVisual = {
  badgeBg: "bg-slate-100 border border-slate-200",
  badgeGlow: "bg-slate-300/20",
  iconColor: "text-slate-500",
  titleColor: "text-slate-700",
  buttonClass: "",
};

function CelebrationModal({
  event,
  leaving,
  onDismiss,
}: {
  event: CrmCelebrationEvent;
  leaving: boolean;
  onDismiss: () => void;
}) {
  const visual = TONE_VISUAL[event.tone];
  const Icon = event.icon;
  // Three independent fixed layers, stacked by explicit z-index rather than DOM nesting, so
  // none of them can inherit another's `backdrop-filter`/opacity: the dim+blur backdrop sits at
  // `BACKDROP_Z`; confetti/balloons/butterflies/bunting sit above it at `EFFECTS_Z` (clearly
  // visible, never blurred or dimmed by the backdrop below them); the popup card sits highest at
  // `CARD_Z`, always on top of both.
  return (
    <>
      <div
        aria-hidden
        style={{ zIndex: BACKDROP_Z }}
        className={cn(
          "pointer-events-none fixed inset-0 bg-slate-900/30 backdrop-blur-[1px] transition-opacity duration-200",
          leaving ? "opacity-0" : "opacity-100",
        )}
      />
      {/* Balloons + butterflies + bunting — every modal celebration gets it, except Lost/On Hold */}
      {!leaving && isPartyModalTone(event.tone) && (
        <CrmPartyDecor
          tone={event.tone}
          uid={String(event.id)}
          zIndex={EFFECTS_Z}
        />
      )}
      <div
        style={{ zIndex: CARD_Z }}
        className="pointer-events-none fixed inset-0 flex items-center justify-center p-4"
      >
        <div
          role="status"
          aria-live="polite"
          className={cn(
            "pointer-events-auto relative w-full max-w-sm rounded-3xl border border-slate-100 bg-white p-7 text-center shadow-2xl transition-all duration-200 ease-out",
            leaving
              ? "scale-95 opacity-0"
              : "animate-in fade-in zoom-in-95 scale-100 opacity-100 duration-300",
          )}
        >
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="absolute right-3 top-3 rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="relative mx-auto mb-4 flex h-20 w-20 items-center justify-center">
            <span
              aria-hidden
              className={cn(
                "absolute inset-0 rounded-full blur-xl",
                visual.badgeGlow,
              )}
            />
            <span
              className={cn(
                "relative flex h-20 w-20 items-center justify-center rounded-full shadow-inner",
                visual.badgeBg,
              )}
            >
              <Icon className={cn("h-9 w-9", visual.iconColor)} />
            </span>
          </div>

          <p
            className={cn(
              "text-2xl font-extrabold tracking-tight",
              visual.titleColor,
            )}
          >
            {event.title}
          </p>
          <p className="mt-1.5 text-sm font-bold text-slate-800">
            {event.subtitle}
          </p>
          {event.amount && (
            <p
              className={cn("mt-2 text-2xl font-extrabold", visual.titleColor)}
            >
              {event.amount}
            </p>
          )}
          {event.description && (
            <p className="mt-1 text-sm font-medium text-slate-500">
              {event.description}
            </p>
          )}

          {event.button && (
            <button
              type="button"
              onClick={onDismiss}
              className={cn(
                "mt-5 w-full rounded-xl px-4 py-2.5 text-sm font-bold shadow-sm transition-colors",
                visual.buttonClass,
              )}
            >
              {event.button}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

function CelebrationToast({
  event,
  leaving,
  onDismiss,
}: {
  event: CrmCelebrationEvent;
  leaving: boolean;
  onDismiss: () => void;
}) {
  const visual =
    event.tone === "lost" ? NEUTRAL_TOAST_VISUAL : TONE_VISUAL[event.tone];
  const Icon = event.icon;
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed top-6 right-6 z-[10100] max-w-[calc(100vw-3rem)]"
    >
      <div
        className={cn(
          "pointer-events-auto flex min-w-[17rem] items-center gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-lg transition-all duration-200 ease-out",
          leaving
            ? "-translate-y-2 opacity-0"
            : "animate-in fade-in slide-in-from-top-4 translate-y-0 opacity-100 duration-300",
        )}
      >
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
            visual.badgeBg,
          )}
        >
          <Icon className={cn("h-5 w-5", visual.iconColor)} />
        </span>
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "truncate text-sm font-bold leading-snug",
              visual.titleColor,
            )}
          >
            {event.title}
          </p>
          {event.description && (
            <p className="mt-0.5 truncate text-sm text-slate-500">
              {event.description}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 rounded-full p-1 text-slate-300 transition-colors hover:text-slate-500"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export function CrmCelebrationHost() {
  const [active, setActive] = useState<CrmCelebrationEvent | null>(null);
  const [leaving, setLeaving] = useState(false);
  const activeRef = useRef<CrmCelebrationEvent | null>(null);
  const pendingRef = useRef<CrmCelebrationEvent | null>(null);
  const showEventRef = useRef<(event: CrmCelebrationEvent) => void>(() => {});
  const confettiTimersRef = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      confettiTimersRef.current.forEach((id) => window.clearTimeout(id));
      confettiTimersRef.current = [];
    };
  }, []);

  const dismiss = useCallback(() => {
    // Captured up front so this timer only clears the celebration it was actually scheduled for —
    // a manual dismiss (X click) and the auto-dismiss timer in `showEvent` can both fire close
    // together, queuing two of these completion timers back to back. Without this check, the
    // second one fires unconditionally after a new celebration has already become active (promoted
    // from `pendingRef`) and wipes it out mid-animation.
    const dismissedId = activeRef.current?.id;
    setLeaving(true);
    window.setTimeout(() => {
      if (activeRef.current?.id !== dismissedId) return;
      activeRef.current = null;
      setActive(null);
      setLeaving(false);
      const next = pendingRef.current;
      pendingRef.current = null;
      if (next)
        window.setTimeout(() => showEventRef.current(next), REQUEUE_GAP_MS);
    }, 180);
  }, []);

  const showEvent = useCallback(
    (event: CrmCelebrationEvent) => {
      activeRef.current = event;
      setLeaving(false);
      setActive(event);
      // A single celebration already schedules up to ~19 confetti() bursts spread over ~1.3s
      // (spray, shower, fireworks, welcome shower), and each burst's particles keep animating for a
      // couple more seconds after that. Rapid-fire actions (e.g. bulk-completing several tasks) can
      // start a new celebration before the previous one's particles have actually finished falling —
      // cancel any still-scheduled bursts and clear the canvas outright before adding new ones,
      // instead of letting them silently stack with nothing to cancel or coalesce them.
      confettiTimersRef.current.forEach((id) => window.clearTimeout(id));
      confetti.reset();
      confettiTimersRef.current = fireConfetti(event.tone, event.variant);
      window.setTimeout(() => {
        if (activeRef.current?.id === event.id) dismiss();
      }, event.durationMs);
    },
    [dismiss],
  );

  useEffect(() => {
    showEventRef.current = showEvent;
  }, [showEvent]);

  useEffect(
    () =>
      subscribeCrmCelebrations((event) => {
        // Prevent stacking: while one celebration is showing, only the most recent follow-up is
        // kept and shown next — older ones in a fast burst of updates are simply superseded.
        if (activeRef.current) {
          pendingRef.current = event;
        } else {
          showEvent(event);
        }
      }),
    [showEvent],
  );

  if (!active) return null;

  // Rendered via a portal straight onto `document.body`: `CrmCelebrationHost` is mounted deep
  // inside the CRM layout tree (`Layout` > `.page-enter` > ...), and `.page-enter`'s entrance
  // animation ends on `transform: translateY(0)` (see `index.css`), which — being a transform
  // other than `none` — permanently establishes a new containing block for any `position: fixed`
  // descendant. Without the portal, this backdrop/card/confetti-decor would be positioned and
  // clipped against that ancestor's box instead of the real viewport. A portal sidesteps any such
  // ancestor (present now or introduced later) entirely.
  return createPortal(
    active.variant === "modal" ? (
      <CelebrationModal event={active} leaving={leaving} onDismiss={dismiss} />
    ) : (
      <CelebrationToast event={active} leaving={leaving} onDismiss={dismiss} />
    ),
    document.body,
  );
}

export default CrmCelebrationHost;
