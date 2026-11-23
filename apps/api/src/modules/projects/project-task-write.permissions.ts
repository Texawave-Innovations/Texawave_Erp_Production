/**
 * Who may create, edit and delete project tasks and milestones: an org-wide
 * writer (`projects.task.write`, or the `.all` assignment scope), or a Team Lead
 * holding `projects.task_assignment.write.team`. Any one gets a caller to the
 * route (`@RequireAnyPermission`); what a team-scoped caller may then touch is
 * decided by `ProjectsWriteAccessService`.
 */
export const PROJECT_TASK_WRITE_PERMISSIONS = [
  "projects.task.write",
  "projects.task_assignment.write.team",
  "projects.task_assignment.write.all",
] as const;
