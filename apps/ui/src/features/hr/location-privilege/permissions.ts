/**
 * UI visibility only. The API guards every route and is authoritative.
 *
 * Unlike `hr.employee.*`, these permission codes carry no `.own/.team/.all`
 * suffix — the backend comment on `LocationPrivilegeService` is explicit that
 * location privilege and office networks are organization-wide ("legacy has
 * no team dimension"), so there is no scope to check here.
 */
export const LOCATION_PRIVILEGE_READ = "hr.location_privilege.read";
export const LOCATION_PRIVILEGE_WRITE = "hr.location_privilege.write";
export const OFFICE_NETWORK_READ = "hr.office_network.read";
export const OFFICE_NETWORK_WRITE = "hr.office_network.write";
