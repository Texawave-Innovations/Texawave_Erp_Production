"use client";

import { Toaster as RadixToaster } from "@/components/legacy-ui/toaster";
import { Toaster as SonnerToaster } from "@/components/legacy-ui/sonner";

/**
 * Legacy CRM toast outlets (App.tsx mounted `<Toaster />` + `<Sonner />`). Mounted inside
 * `.crm-module` only, so CRM screens can call either `toast` from `sonner` or `toast` from
 * `@/components/legacy-ui/use-toast` without affecting the rest of the app (which keeps the
 * ui-kit ToastProvider).
 */
export function CrmToasters() {
  return (
    <>
      <RadixToaster />
      <SonnerToaster />
    </>
  );
}
