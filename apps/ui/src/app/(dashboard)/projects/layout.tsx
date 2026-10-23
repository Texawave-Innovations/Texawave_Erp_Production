import type { ReactNode } from "react";
import { ProjectsShell } from "@/features/projects/components/ProjectsShell";

export default function ProjectsLayout({ children }: { children: ReactNode }) {
  return <ProjectsShell>{children}</ProjectsShell>;
}
