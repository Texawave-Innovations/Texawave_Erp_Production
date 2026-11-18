import { MyWorkView } from "@/features/projects/components/MyWorkView";

// Admin-shell My Work (menu code projects-my-work). The employee portal mounts
// the same view at /portal/work. `app/` stays thin — routing only.
export default function MyWorkPage() {
  return <MyWorkView />;
}
