// src/modules/projects/mom/services/momPermissions.ts

import { MomDocument } from "../types/mom";
import { Project } from "../../types";
import { canUserAccessProject } from "./momService";

export type MomAction =
  | "view"
  | "create_draft"
  | "edit_draft"
  | "finalize"
  | "create_revision"
  | "archive"
  | "restore"
  | "manage_templates";

/**
 * Enforces role-based and project-bound access control for Minutes of Meeting operations.
 * Permissions are checked beyond UI visibility at service and execution points.
 */
export function hasMomPermission(
  currentUser: any,
  action: MomAction,
  document?: Partial<MomDocument> | null,
  project?: Project | null,
): boolean {
  if (!currentUser) return false;

  const role = (currentUser.role || "").toLowerCase();
  const userId =
    currentUser.id || currentUser.uid || currentUser.username || "";

  // 1. Admin has global unrestricted permissions
  if (role === "admin") {
    return true;
  }

  // 2. Manage templates requires Admin or Manager privilege
  if (action === "manage_templates") {
    return role === "manager";
  }

  // 3. Project-scoped operations check project authorization
  if (project && !canUserAccessProject(currentUser, project)) {
    return false;
  }

  // 4. Action-specific rules
  switch (action) {
    case "view":
      return true; // If project access passed, view is permitted

    case "create_draft":
      // Any authorized project member, manager, or admin can initialize a draft
      return true;

    case "edit_draft":
      // Finalized documents cannot be edited directly (must use create_revision)
      if (document && document.status !== "draft") {
        return false;
      }
      // Allowed for managers or creator / project member
      if (role === "manager") return true;
      if (document && document.createdBy && document.createdBy !== userId) {
        // Only draft creator or manager can edit unfinalized draft
        return false;
      }
      return true;

    case "finalize":
      // Finalizing official corporate minutes requires Manager, Project Lead, or Admin
      return (
        role === "manager" ||
        (project && isUserProjectLead(currentUser, project))
      );

    case "create_revision":
      // Only finalized documents can have revisions created
      if (document && document.status !== "finalized") {
        return false;
      }
      return (
        role === "manager" ||
        (project && isUserProjectLead(currentUser, project))
      );

    case "archive":
    case "restore":
      // Archiving and restoring official documents requires Manager or Admin
      return role === "manager";

    default:
      return false;
  }
}

/**
 * Checks if the user is designated as the Project Lead or client handling person.
 */
function isUserProjectLead(user: any, project: Project): boolean {
  const userId = (user.id || user.uid || user.username || "").toLowerCase();
  const userName = (user.name || user.username || "").toLowerCase();

  if (project.clientHandlingPerson) {
    const chp = String(project.clientHandlingPerson).toLowerCase();
    if (chp === userId || chp === userName) return true;
  }

  if (project.members && typeof project.members === "object") {
    for (const m of Object.values(project.members) as any[]) {
      const empId = (m?.empId || "").toLowerCase();
      const mName = (m?.name || "").toLowerCase();
      const mRole = (m?.role || "").toLowerCase();
      if (
        (empId === userId || mName === userName) &&
        (mRole.includes("lead") || mRole.includes("manager"))
      ) {
        return true;
      }
    }
  }

  return false;
}
