import * as financeSettings from "@/features/finance-settings/permissions";
import * as hrMaster from "@/features/hr-master/permissions";
import * as projectsMaster from "@/features/projects-master/permissions";
import { SALES_PERMISSIONS } from "@/features/sales/permissions";
import * as scmMaster from "@/features/scm/master-list-items/permissions";

export type MasterTabId = "sales" | "hr" | "finance" | "projects" | "scm";

/**
 * The read permissions behind each Master List screen — the same codes the
 * API's list endpoints for that screen require. A user who holds none of a
 * screen's codes would only see "no access" cards there, so the tab is hidden
 * (HorizontalNavbar's Master List menu and MastersTabBar). Any one code is
 * enough: each screen gates its own cards individually.
 */
export const MASTER_READ_PERMISSIONS: Record<MasterTabId, readonly string[]> = {
  sales: [SALES_PERMISSIONS.masterRead],
  hr: [
    hrMaster.DEPARTMENT_READ,
    hrMaster.DESIGNATION_READ,
    hrMaster.WORK_LOCATION_READ,
    hrMaster.LEAVE_TYPE_READ,
    hrMaster.SHIFT_READ,
  ],
  finance: [financeSettings.MASTER_LIST_ITEM_READ],
  projects: [
    projectsMaster.PROJECT_READ,
    projectsMaster.PROJECT_CODE_MASTER_READ,
    projectsMaster.TASK_RUNNING_NUMBER_MASTER_READ,
  ],
  scm: [scmMaster.MASTER_LIST_ITEM_READ],
};

export function canSeeMasterTab(
  tab: MasterTabId,
  permissions: readonly string[],
): boolean {
  return MASTER_READ_PERMISSIONS[tab].some((p) => permissions.includes(p));
}
