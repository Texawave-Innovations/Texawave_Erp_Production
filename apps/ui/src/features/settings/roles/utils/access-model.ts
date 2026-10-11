import type { Permission } from "@texawave-erp/api-types";

/**
 * Pure model behind the role editor: turns the flat permission catalog
 * (GET /settings/permissions) into sections → resources → actions, and edits a
 * role's grant set one ACTION at a time (an action is a base code such as
 * `hr.attendance.read`, with `.own/.team/.all` variants when team-scoped).
 *
 * Nothing here talks to the API. Labels and groupings are presentation only;
 * the catalog (packages/database/prisma/permissions/catalog.ts) stays the
 * source of truth for which codes exist.
 */

export const SCOPES = ["own", "team", "all"] as const;
export type Scope = (typeof SCOPES)[number];
/** What one action is set to in a role: not granted, a scope, or (for a flat
 * permission) simply granted. */
export type Level = "none" | Scope | "granted";

export interface AccessAction {
  /** Base code without a scope suffix, e.g. `hr.attendance.read`. */
  code: string;
  verb: string;
  label: string;
  description: string;
  kind: "scoped" | "flat";
  /** Scoped: the permission id of each variant present in the catalog. */
  ids: Partial<Record<Scope, number>>;
  /** Flat: the single permission id. */
  id: number | null;
  /** `.own` exists but the API never lets it do anything (catalog comments). */
  ownReserved: boolean;
  /** High-impact: shown with a warning and listed first in the review. */
  sensitive: boolean;
}

export interface AccessResource {
  key: string;
  label: string;
  actions: AccessAction[];
}

export interface AccessSection {
  key: string;
  label: string;
  description: string;
  resources: AccessResource[];
  /** Every permission id in the section, for "clear section". */
  permissionIds: number[];
}

// ---- presentation metadata ---------------------------------------------------

const SECTIONS: { key: string; label: string; description: string }[] = [
  {
    key: "admin",
    label: "Administration",
    description: "Users, roles, navigation, departments and the audit trail.",
  },
  {
    key: "masters",
    label: "Master data",
    description: "Designations, employment types, work locations and shifts.",
  },
  {
    key: "people",
    label: "HR · People",
    description:
      "Employees, profiles, documents, onboarding review and sensitive data.",
  },
  {
    key: "time",
    label: "HR · Time & attendance",
    description:
      "Attendance, corrections, month close, shifts, calendar and leave.",
  },
  {
    key: "workflows",
    label: "HR · Requests & work",
    description: "Work logs, tasks, tickets, expense claims and exit requests.",
  },
  {
    key: "recruitment",
    label: "HR · Recruitment",
    description: "Interviews, offer letters, revision and promotion letters.",
  },
  {
    key: "payroll",
    label: "HR · Payroll",
    description:
      "Payroll runs, salaries, statutory, loans, bonuses, payslips and payments.",
  },
  {
    key: "self",
    label: "Employee self-service",
    description: "What an employee can do for themselves in the portal.",
  },
  { key: "other", label: "Other", description: "Permissions not yet grouped." },
];

/** `<module>.<entity>` → [section, label]. Unlisted HR entities fall in "other". */
const RESOURCES: Record<string, [string, string]> = {
  "settings.role": ["admin", "Roles & permissions"],
  "users.user": ["admin", "Users"],
  "menu.item": ["admin", "Navigation menu"],
  "departments.department": ["admin", "Departments"],
  "audit.log": ["admin", "Audit trail"],
  "reference.tags": ["admin", "Reference tags"],
  "hr.workspace": ["admin", "HR workspace"],
  "master.designation": ["masters", "Designations"],
  "master.employment_type": ["masters", "Employment types"],
  "master.work_location": ["masters", "Work locations"],
  "master.shift": ["masters", "Shifts"],
  "hr.employee": ["people", "Employees"],
  "hr.employee_status": ["people", "Employment status"],
  "hr.employee_account": ["people", "Login accounts"],
  "hr.employee_onboarding": ["people", "Onboarding review"],
  "hr.employee_profile": ["people", "Employee profiles"],
  "hr.employee_document": ["people", "Employee documents"],
  "hr.employee_sensitive": ["people", "Sensitive identifiers & bank"],
  "hr.employee_bank": ["people", "Bank account numbers"],
  "hr.attendance": ["time", "Attendance"],
  "hr.attendance_report": ["time", "Attendance reports"],
  "hr.attendance_correction": ["time", "Attendance corrections"],
  "hr.attendance_lock": ["time", "Attendance month close"],
  "hr.shift_assignment": ["time", "Shift assignments"],
  "hr.holiday": ["time", "Holidays"],
  "hr.weekly_off": ["time", "Weekly offs"],
  "hr.location_privilege": ["time", "Location privilege"],
  "hr.office_network": ["time", "Office networks"],
  "hr.leave_type": ["time", "Leave types"],
  "hr.leave_request": ["time", "Leave requests"],
  "hr.leave": ["time", "Leave requests"],
  "hr.work_log": ["workflows", "Work logs"],
  "hr.task": ["workflows", "Tasks"],
  "hr.ticket": ["workflows", "Tickets"],
  "hr.expense_claim": ["workflows", "Expense claims"],
  "hr.exit_request": ["workflows", "Exit requests"],
  "hr.interview": ["recruitment", "Interviews"],
  "hr.offer_letter": ["recruitment", "Offer letters"],
  "hr.revision_letter": ["recruitment", "Revision letters"],
  "hr.promotion_letter": ["recruitment", "Promotion letters"],
  "hr.payroll": ["payroll", "Payroll runs"],
  "hr.payroll_settings": ["payroll", "Payroll settings"],
  "hr.salary": ["payroll", "Salary structures"],
  "hr.pf": ["payroll", "PF"],
  "hr.esi": ["payroll", "ESI"],
  "hr.loan": ["payroll", "Loans"],
  "hr.bonus": ["payroll", "Bonuses"],
  "hr.payslip": ["payroll", "Payslips"],
  "hr.payment": ["payroll", "Payments"],
};

const SELF_LABELS: Record<string, string> = {
  profile: "My profile",
  leave_request: "My leave",
  attendance: "My attendance",
  attendance_correction: "My attendance corrections",
  work_log: "My work logs",
  ticket: "My tickets",
  expense_claim: "My expense claims",
  exit_request: "My exit request",
  task: "My tasks",
  payslip: "My payslips",
  loan: "My loans",
};

const VERBS: Record<string, string> = {
  read: "View",
  write: "Edit",
  create: "Create",
  update: "Update",
  update_status: "Update status",
  approve: "Approve",
  decide: "Decide",
  cancel: "Cancel",
  finalize: "Finalize",
  export: "Export",
  import: "Import",
  punch: "Check in / out",
  access: "Open",
  correct: "Correct",
  reveal: "Reveal",
};

/** `.own` variants that the API refuses (documented in catalog.ts). */
const OWN_RESERVED = new Set([
  "hr.shift_assignment.write",
  "hr.leave_request.create",
  "hr.leave.cancel",
  "hr.attendance.write",
  "hr.attendance_correction.approve",
  "hr.attendance.import",
  "hr.attendance_lock.finalize",
  "hr.attendance_lock.approve",
  "hr.employee.write",
  "hr.employee_onboarding.approve",
  "hr.employee_profile.write",
  "hr.revision_letter.write",
  "hr.promotion_letter.write",
  "hr.expense_claim.decide",
  "hr.exit_request.decide",
]);

/** Grants that change who can do what, touch money or expose personal data. */
const SENSITIVE = new Set([
  "settings.role.write",
  "users.user.write",
  "menu.item.write",
  "audit.log.read",
  "hr.employee_status.correct",
  "hr.employee_account.write",
  "hr.employee_sensitive.read",
  "hr.employee_sensitive.write",
  "hr.employee_bank.reveal",
  "hr.payroll.write",
  "hr.payroll.approve",
  "hr.payroll.finalize",
  "hr.payroll_settings.write",
  "hr.salary.write",
  "hr.payment.write",
  "hr.loan.approve",
  "hr.bonus.approve",
  "hr.attendance_lock.approve",
]);

/** Maker-checker pairs: one role holding both lets one person do both steps
 * unless the API stops them (some flows do, per person; the role is still a
 * risky setup worth flagging). */
export const DUTY_CONFLICTS: {
  maker: string;
  checker: string;
  label: string;
}[] = [
  {
    maker: "hr.attendance_lock.finalize",
    checker: "hr.attendance_lock.approve",
    label: "Submits and approves attendance months",
  },
  {
    maker: "hr.payroll.write",
    checker: "hr.payroll.approve",
    label: "Runs and approves payroll",
  },
  {
    maker: "hr.loan.write",
    checker: "hr.loan.approve",
    label: "Creates and approves loans",
  },
  {
    maker: "hr.bonus.write",
    checker: "hr.bonus.approve",
    label: "Creates and approves bonuses",
  },
  {
    maker: "hr.salary.write",
    checker: "hr.payroll.approve",
    label: "Sets salaries and approves payroll",
  },
];

export const SCOPE_LABELS: Record<Scope, string> = {
  own: "Own",
  team: "Team",
  all: "All",
};

export const SCOPE_HINTS: Record<Scope, string> = {
  own: "Only their own records",
  team: "Records of the teams assigned to the user",
  all: "Every team in the organization",
};

// ---- building ----------------------------------------------------------------

function title(identifier: string): string {
  return identifier
    .split(/[_-]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function stripScope(description: string): string {
  return description.replace(
    /\s*\((own records|own team|all teams)\)\s*$/i,
    "",
  );
}

export function splitCode(code: string): { base: string; scope: Scope | null } {
  const parts = code.split(".");
  const last = parts[parts.length - 1] as Scope;
  return SCOPES.includes(last)
    ? { base: parts.slice(0, -1).join("."), scope: last }
    : { base: code, scope: null };
}

function placement(base: string): {
  section: string;
  resourceKey: string;
  label: string;
  verb: string;
} {
  const parts = base.split(".");
  const verb = parts[parts.length - 1] ?? "access";
  if (parts[0] === "employee_self_service") {
    const entity = parts.slice(1, -1).join(".") || parts[1] || "self";
    return {
      section: "self",
      resourceKey: `self.${entity}`,
      label: SELF_LABELS[entity] ?? title(entity),
      verb,
    };
  }
  const resourceKey = parts.slice(0, -1).join(".");
  const known = RESOURCES[resourceKey];
  if (known) {
    // Leave reads (`leave_request`) and decisions (`leave`) share one row.
    const key = resourceKey === "hr.leave" ? "hr.leave_request" : resourceKey;
    return { section: known[0], resourceKey: key, label: known[1], verb };
  }
  return {
    section: "other",
    resourceKey,
    label: title(parts.slice(1, -1).join(" ") || resourceKey),
    verb,
  };
}

export function buildAccessModel(
  catalog: readonly Permission[],
): AccessSection[] {
  const actions = new Map<
    string,
    AccessAction & {
      section: string;
      resourceKey: string;
      resourceLabel: string;
    }
  >();
  for (const p of catalog) {
    const { base, scope } = splitCode(p.code);
    let a = actions.get(base);
    if (!a) {
      const where = placement(base);
      a = {
        code: base,
        verb: where.verb,
        label: VERBS[where.verb] ?? title(where.verb),
        description: stripScope(p.description || base),
        kind: scope ? "scoped" : "flat",
        ids: {},
        id: null,
        ownReserved: OWN_RESERVED.has(base),
        sensitive: SENSITIVE.has(base),
        section: where.section,
        resourceKey: where.resourceKey,
        resourceLabel: where.label,
      };
      actions.set(base, a);
    }
    if (scope) {
      a.kind = "scoped";
      a.ids[scope] = p.id;
    } else {
      a.id = p.id;
    }
  }

  const sections = new Map<string, AccessSection>(
    SECTIONS.map((s) => [s.key, { ...s, resources: [], permissionIds: [] }]),
  );
  const resources = new Map<string, AccessResource & { section: string }>();
  for (const a of actions.values()) {
    let r = resources.get(a.resourceKey);
    if (!r) {
      r = {
        key: a.resourceKey,
        label: a.resourceLabel,
        actions: [],
        section: a.section,
      };
      resources.set(a.resourceKey, r);
      sections.get(a.section)!.resources.push(r);
    }
    const { section: _s, resourceKey: _k, resourceLabel: _l, ...action } = a;
    r.actions.push(action);
    sections.get(a.section)!.permissionIds.push(...permissionIdsOf(action));
  }
  const verbOrder = Object.keys(VERBS);
  for (const s of sections.values()) {
    for (const r of s.resources) {
      r.actions.sort(
        (x, y) => verbOrder.indexOf(x.verb) - verbOrder.indexOf(y.verb),
      );
    }
  }
  return [...sections.values()].filter((s) => s.resources.length > 0);
}

// ---- editing -------------------------------------------------------------------

export function permissionIdsOf(action: AccessAction): number[] {
  return action.kind === "flat"
    ? action.id !== null
      ? [action.id]
      : []
    : SCOPES.flatMap((s) =>
        action.ids[s] !== undefined ? [action.ids[s]!] : [],
      );
}

/** The level an action has in a grant set. With several scope variants
 * granted (possible in old data), the widest wins — that is what the API's
 * scope resolution does. */
export function levelOf(
  action: AccessAction,
  granted: ReadonlySet<number>,
): Level {
  if (action.kind === "flat")
    return action.id !== null && granted.has(action.id) ? "granted" : "none";
  for (const s of ["all", "team", "own"] as const) {
    const id = action.ids[s];
    if (id !== undefined && granted.has(id)) return s;
  }
  return "none";
}

/** Returns a new grant set with `action` set to exactly `level` (at most one
 * scope variant granted, so the role never carries redundant rows). */
export function withLevel(
  action: AccessAction,
  granted: ReadonlySet<number>,
  level: Level,
): Set<number> {
  const next = new Set(granted);
  for (const id of permissionIdsOf(action)) next.delete(id);
  if (level === "granted" && action.id !== null) next.add(action.id);
  if (level !== "none" && level !== "granted") {
    const id = action.ids[level];
    if (id !== undefined) next.add(id);
  }
  return next;
}

export interface GrantChange {
  action: AccessAction;
  resourceLabel: string;
  sectionLabel: string;
  from: Level;
  to: Level;
}

/** Per-action differences between two grant sets, sensitive first. */
export function diffGrants(
  sections: readonly AccessSection[],
  before: ReadonlySet<number>,
  after: ReadonlySet<number>,
): GrantChange[] {
  const out: GrantChange[] = [];
  for (const s of sections) {
    for (const r of s.resources) {
      for (const a of r.actions) {
        const from = levelOf(a, before);
        const to = levelOf(a, after);
        if (from !== to)
          out.push({
            action: a,
            resourceLabel: r.label,
            sectionLabel: s.label,
            from,
            to,
          });
      }
    }
  }
  return out.sort(
    (x, y) => Number(y.action.sensitive) - Number(x.action.sensitive),
  );
}

export function levelLabel(level: Level): string {
  if (level === "none") return "No access";
  if (level === "granted") return "Granted";
  return `${SCOPE_LABELS[level]} scope`;
}

/** Maker-checker pairs fully present in a grant set (any scope counts). */
export function dutyConflicts(
  sections: readonly AccessSection[],
  granted: ReadonlySet<number>,
): string[] {
  const byCode = new Map<string, AccessAction>();
  for (const s of sections)
    for (const r of s.resources)
      for (const a of r.actions) byCode.set(a.code, a);
  const has = (code: string) => {
    const a = byCode.get(code);
    return a ? levelOf(a, granted) !== "none" : false;
  };
  return DUTY_CONFLICTS.filter((c) => has(c.maker) && has(c.checker)).map(
    (c) => c.label,
  );
}

/** Codes (scope stripped) the grant set gives, for menu and effective-access checks. */
export function grantedBaseCodes(
  catalog: readonly Permission[],
  granted: ReadonlySet<number>,
): Map<string, Level> {
  const out = new Map<string, Level>();
  for (const p of catalog) {
    if (!granted.has(p.id)) continue;
    const { base, scope } = splitCode(p.code);
    const prev = out.get(base);
    const rank = (l: Level | undefined) =>
      l === "all" || l === "granted"
        ? 3
        : l === "team"
          ? 2
          : l === "own"
            ? 1
            : 0;
    const level: Level = scope ?? "granted";
    if (rank(level) > rank(prev)) out.set(base, level);
  }
  return out;
}
