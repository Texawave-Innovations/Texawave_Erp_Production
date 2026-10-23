/**
 * UI visibility only. The API guards every route and is authoritative
 * (`@RequirePermission()` on each controller method) — see
 * apps/api/src/modules/projects-master/*.controller.ts.
 */
export const PROJECT_READ = "projects_master.project.read";
export const PROJECT_WRITE = "projects_master.project.write";

export const PROJECT_CODE_MASTER_READ =
  "projects_master.project_code_master.read";
export const PROJECT_CODE_MASTER_WRITE =
  "projects_master.project_code_master.write";

export const TASK_RUNNING_NUMBER_MASTER_READ =
  "projects_master.task_running_number_master.read";
export const TASK_RUNNING_NUMBER_MASTER_WRITE =
  "projects_master.task_running_number_master.write";
