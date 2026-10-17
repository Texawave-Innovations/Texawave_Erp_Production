import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import { CrmNotificationHost } from "@/features/crm/notifications/components/CrmNotificationHost";
import { CrmShell } from "@/features/crm/shell/CrmShell";
import "./crm-legacy.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-crm-inter",
  display: "swap",
});

// Section layout for every /crm/* page. Reproduces the legacy CRMLayout.tsx
// (gradient CRM header, Search / Bulk Import / Calendar / bell actions and the
// per-tab tinted scrolling tab bar) and scopes the legacy green/Inter look to
// this subtree only (crm-legacy.css). Notification sync + blocking panel are
// mounted once by CrmNotificationHost.
export default function CrmLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`crm-module ${inter.variable}`}>
      <CrmNotificationHost>
        <CrmShell>{children}</CrmShell>
      </CrmNotificationHost>
    </div>
  );
}
