"use client";

import type { ReactNode } from "react";
import { usePermission } from "@/hooks/usePermission";
import { useNotificationSync } from "../hooks";
import { CrmActionPanel } from "./CrmActionPanel";

/** Mounted once for every `/crm/*` page (see `app/(dashboard)/crm/layout.tsx`).
 * Users with `crm.notification.read` get the on-load + 60s server-side
 * regeneration (the bell itself now lives in the CRM header, `CrmShell`);
 * the blocking action panel additionally needs `crm.notification.write` so
 * nobody is locked behind a panel they cannot dismiss. */
export function CrmNotificationHost({ children }: { children: ReactNode }) {
  const canRead = usePermission("crm.notification.read");
  const canWrite = usePermission("crm.notification.write");
  useNotificationSync(canRead);

  return (
    <>
      {children}
      {canRead && canWrite && <CrmActionPanel />}
    </>
  );
}
