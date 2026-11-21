import { MyWorkView } from "@/features/projects/components/MyWorkView";

// "My Work" portal tab (menu code portal-work, gated by employee_self_service.work.write):
// the same view the admin shell shows at /projects/my-work, here for the
// signed-in employee's own tasks, timers and points. Every call it makes is
// own-data or gated by employee_self_service.work.write (or the older
// projects.timer.write) / projects.task.write — no
// org-wide project read is needed. `app/` stays thin — routing only.
export default function PortalWorkPage() {
  return <MyWorkView />;
}
