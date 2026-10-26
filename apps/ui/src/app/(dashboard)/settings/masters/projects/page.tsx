import { ProjectsMasterView } from "@/features/projects-master/components/ProjectsMasterView";
import { MastersTabBar } from "@/features/masters/MastersTabBar";

export default function ProjectsMasterPage() {
  return (
    <div className="flex flex-col gap-6">
      <MastersTabBar active="projects" />
      <ProjectsMasterView />
    </div>
  );
}
