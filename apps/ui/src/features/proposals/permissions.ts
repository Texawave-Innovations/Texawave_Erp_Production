/**
 * UI visibility only. The API guards every route and is authoritative
 * (`@RequirePermission()` on each controller method) — see
 * apps/api/src/modules/projects/proposals/*.controller.ts.
 */
export const PROPOSALS_READ = "projects.proposals.read";
export const PROPOSALS_WRITE = "projects.proposals.write";
export const PROPOSALS_MANAGE_TEMPLATES = "projects.proposals.manage_templates";
export const PROPOSALS_MANAGE_SETTINGS = "projects.proposals.manage_settings";
export const PROPOSALS_SEND = "projects.proposals.send";
export const PROPOSALS_DELETE = "projects.proposals.delete";
