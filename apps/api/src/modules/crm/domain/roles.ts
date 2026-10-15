// CRM Core Domain — conceptual CRM role mapping (section 19 of the CRM architecture brief).
// The ERP's actual authentication/authorization lives in `AuthContext.tsx` (`User.role`,
// `ROLE_PERMISSIONS`) and is NOT modified here — this file only maps the existing, already
//-authenticated `user.role` onto the five CRM-conceptual roles the brief asks for, purely to
// gate a handful of CRM-only actions (e.g. editing someone else's opportunity). It never grants
// module access on its own; `hasAccess('crm')` in AuthContext still decides who reaches the CRM
// module at all.
import { User } from "@/types";

// Only three conceptual roles are actually reachable from the ERP's real login roles today
// (see `conceptualCrmRole` below) — "CEO"/"Sales Manager" were removed since no ERP `UserRole`
// ever maps into them, which made those branches dead code.
export type CrmConceptualRole = "Sales Head" | "Sales Executive" | "CRM Admin";

/**
 * The ERP has no dedicated CEO/Sales Head/Sales Manager login roles today, so those map from the
 * closest existing role. `admin` is treated as CRM Admin (full CRM control, same spirit as its
 * full ERP access); `manager` as Sales Head (cross-team oversight); everyone else who can reach
 * the CRM module (`sales`, `crm`) is a Sales Executive — the safe, least-privileged default.
 */
export function conceptualCrmRole(
  user: User | null | undefined,
): CrmConceptualRole {
  switch (user?.role) {
    case "admin":
      return "CRM Admin";
    case "manager":
      return "Sales Head";
    default:
      return "Sales Executive";
  }
}

/** CRM Admin / Sales Head can manage any opportunity; a Sales Executive only their own. */
export function canManageOpportunity(
  user: User | null | undefined,
  ownerName: string | undefined,
): boolean {
  const role = conceptualCrmRole(user);
  if (role === "CRM Admin" || role === "Sales Head") return true;
  const currentUser = user?.name || user?.username || "";
  return (
    !ownerName ||
    ownerName.trim().toLowerCase() === currentUser.trim().toLowerCase()
  );
}

/** Only CRM Admin / Sales Head can create, edit, reorder, or retire pipeline stages — a
 *  module-wide configuration, unlike per-opportunity ownership above. */
export function canManagePipelineConfig(
  user: User | null | undefined,
): boolean {
  const role = conceptualCrmRole(user);
  return role === "CRM Admin" || role === "Sales Head";
}

/** Products/pricing are a shared catalog, not owned per-record — matches the CRM brief's
 *  "Admin should manage: Products, Pricing" (section 26); same role gate as pipeline config. */
export function canManageProducts(user: User | null | undefined): boolean {
  return canManagePipelineConfig(user);
}

/**
 * Strict Admin-only check — deliberately narrower than `conceptualCrmRole`'s "CRM Admin" (which
 * also covers `manager`/Sales Head). Every Delete action across the CRM module (Accounts, Leads,
 * Account Mining, Pipeline, Contacts, Products, Quotes, and every related sub-record) is gated by
 * this, not by ownership or by the Sales Head role — only `user.role === 'admin'` may see or
 * perform a delete. Used both to hide/show Delete buttons in the UI and, via
 * `recycleBinService.assertCrmAdmin`, to reject the delete operation itself if a non-admin
 * somehow triggers it, so the restriction never depends on the button being hidden alone.
 */
export function isCrmAdmin(user: User | null | undefined): boolean {
  return user?.role === "admin";
}
