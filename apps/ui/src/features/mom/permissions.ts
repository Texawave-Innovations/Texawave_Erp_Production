/**
 * UI visibility only. The API guards every route and is authoritative
 * (`@RequirePermission()` on each controller method) — see
 * apps/api/src/modules/projects/mom/*.controller.ts.
 */
export const MOM_READ = "projects.mom.read";
export const MOM_WRITE = "projects.mom.write";
export const MOM_MANAGE_TEMPLATES = "projects.mom.manage_templates";
export const MOM_DELETE = "projects.mom.delete";
