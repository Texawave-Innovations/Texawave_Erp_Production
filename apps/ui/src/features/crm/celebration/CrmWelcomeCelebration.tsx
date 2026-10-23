"use client";

// CRM Core Domain — fires the "Welcome, Chief!" entry celebration on the first CRM visit after
// every fresh login (any role that can reach the CRM — admin included, since `ProtectedRoute
// module="crm"` already gates who gets this far). Rides the `justLoggedIn` one-shot flag that
// `src/pages/Login.tsx` already sets in `sessionStorage` right after a successful sign-in — that
// flag is per-browser-tab (`sessionStorage`), so it's naturally fresh on every login, on every
// machine/browser, regardless of which user logged in last. It says nothing about which module the
// user opens first, so this only fires once they actually land on a `/crm/*` route; navigating
// between CRM tabs afterward (same login) does not fire it again — only the next fresh login does.
//
// The flag is only consumed (removed) once the timer actually fires, not when the effect first
// runs — under React 18 StrictMode (`src/main.tsx`), every effect mounts, cleans up, and re-mounts
// once in development; if the flag were cleared eagerly, that throwaway first mount would consume
// it and cancel its own timer on cleanup, leaving the real second mount with nothing to fire.
import { useEffect, useRef } from "react";
import { celebrateCrm } from "./celebrationBus";

const JUST_LOGGED_IN_KEY = "justLoggedIn";

export function CrmWelcomeCelebration() {
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    let justLoggedIn = false;
    try {
      justLoggedIn = sessionStorage.getItem(JUST_LOGGED_IN_KEY) === "1";
    } catch {
      // sessionStorage unavailable (private mode, etc.) — nothing to gate on, skip silently
    }
    if (!justLoggedIn) return;

    const timer = window.setTimeout(() => {
      if (cancelledRef.current) return;
      try {
        sessionStorage.removeItem(JUST_LOGGED_IN_KEY);
      } catch {
        // ignore — worst case it can fire again next mount
      }
      celebrateCrm("system.welcome");
    }, 400);

    return () => {
      cancelledRef.current = true;
      window.clearTimeout(timer);
    };
  }, []);

  return null;
}

export default CrmWelcomeCelebration;
