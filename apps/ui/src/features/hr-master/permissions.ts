/**
 * UI visibility only. The API guards every route and is authoritative
 * (`@RequirePermission()` on each controller method). All five resources
 * here are reference/code tables (Departments, Designations, Office
 * Locations, Leave Types, Shifts) — `@OrgScoped()` + `@RequirePermission()`
 * only, same as Sales Settings, not `@TeamScoped()` HR data
 * (Docs/CODING_STANDARDS.md §10a).
 */
export const DEPARTMENT_READ = "departments.department.read";
export const DEPARTMENT_WRITE = "departments.department.write";

export const DESIGNATION_READ = "master.designation.read";
export const DESIGNATION_WRITE = "master.designation.write";

export const WORK_LOCATION_READ = "master.work_location.read";
export const WORK_LOCATION_WRITE = "master.work_location.write";

export const LEAVE_TYPE_READ = "hr.leave_type.read";
export const LEAVE_TYPE_WRITE = "hr.leave_type.write";

export const SHIFT_READ = "master.shift.read";
export const SHIFT_WRITE = "master.shift.write";
