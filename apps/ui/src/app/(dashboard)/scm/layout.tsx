import type { ReactNode } from "react";
import { ScmShell } from "@/features/scm/shell/ScmShell";

// Section layout for every /scm/* page: gradient SCM header, Search / Barcode
// actions and the tinted scrolling section tabs (same chrome as /crm/*).
export default function ScmLayout({ children }: { children: ReactNode }) {
  return <ScmShell>{children}</ScmShell>;
}
