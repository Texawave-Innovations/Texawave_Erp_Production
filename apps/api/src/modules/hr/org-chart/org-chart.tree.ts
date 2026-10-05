/** Minimal shape of one employee as the org chart reads it. Only these fields
 * ever leave the module — no contact details, no compensation. */
export interface OrgChartMember {
  id: number;
  employeeCode: string;
  fullName: string;
  reportsToId: number | null;
  designation: { id: number; name: string };
  department: { id: number; name: string } | null;
  team: { id: number; name: string };
}

/** A person as listed by the direct-reports endpoint. `directReportCount`
 * counts only the reports the caller may see. */
export interface OrgChartPerson extends OrgChartMember {
  directReportCount: number;
}

export interface OrgChartNode extends OrgChartPerson {
  /** Nested reports, down to the requested depth. Empty at the cut-off, so
   * a node with `directReportCount > 0` and no children is "expand me". */
  children: OrgChartNode[];
}

export interface OrgTreeIndex {
  byId: Map<number, OrgChartMember>;
  /** Only edges that are safe to follow (see `indexOrgMembers`). */
  childrenOf: Map<number, OrgChartMember[]>;
  roots: OrgChartMember[];
}

const byName = (a: OrgChartMember, b: OrgChartMember) =>
  a.fullName.localeCompare(b.fullName) || a.id - b.id;

/**
 * Indexes a flat list of members into a forest, the same way the legacy
 * client did (`buildTree`): a reporting line is followed only when the
 * manager is in the list, is not the employee themself, and the chain above
 * the employee reaches the top without looping. Everyone else becomes a root,
 * so a manager outside the caller's scope never hides their reports and a
 * corrupt loop never drops people from the chart.
 */
export function indexOrgMembers(members: OrgChartMember[]): OrgTreeIndex {
  const byId = new Map(members.map((m) => [m.id, m]));

  const parentOf = (m: OrgChartMember): number | null =>
    m.reportsToId !== null && m.reportsToId !== m.id && byId.has(m.reportsToId)
      ? m.reportsToId
      : null;

  // Each chain is walked once: a node's verdict is memoised, so the whole
  // index is linear in the number of members, not quadratic.
  // `true` = the chain reaches a top-level member without looping.
  const sound = new Map<number, boolean>();
  for (const start of members) {
    if (sound.has(start.id)) continue;
    const path: number[] = [];
    const onPath = new Set<number>();
    let cur: number | null = start.id;
    let verdict = false;
    for (;;) {
      if (cur === null) {
        verdict = true;
        break;
      }
      const known = sound.get(cur);
      if (known !== undefined) {
        verdict = known;
        break;
      }
      if (onPath.has(cur)) {
        verdict = false;
        break;
      }
      onPath.add(cur);
      path.push(cur);
      cur = parentOf(byId.get(cur)!);
    }
    for (const id of path) sound.set(id, verdict);
  }

  const childrenOf = new Map<number, OrgChartMember[]>();
  const roots: OrgChartMember[] = [];
  for (const m of members) {
    const parent = parentOf(m);
    if (parent !== null && sound.get(m.id) === true) {
      const siblings = childrenOf.get(parent) ?? [];
      siblings.push(m);
      childrenOf.set(parent, siblings);
    } else {
      roots.push(m);
    }
  }

  for (const siblings of childrenOf.values()) siblings.sort(byName);
  roots.sort(byName);
  return { byId, childrenOf, roots };
}

function toPerson(
  m: OrgChartMember,
  directReportCount: number,
): OrgChartPerson {
  return {
    id: m.id,
    employeeCode: m.employeeCode,
    fullName: m.fullName,
    reportsToId: m.reportsToId,
    designation: m.designation,
    department: m.department,
    team: m.team,
    directReportCount,
  };
}

function materialize(
  m: OrgChartMember,
  childrenOf: Map<number, OrgChartMember[]>,
  levels: number,
): OrgChartNode {
  const kids = childrenOf.get(m.id) ?? [];
  return {
    ...toPerson(m, kids.length),
    // `levels` counts this node's own level, so 1 = this node only. The
    // recursion is bounded by the depth cap, so it cannot run away even if
    // the index were ever wrong.
    children:
      levels > 1 ? kids.map((k) => materialize(k, childrenOf, levels - 1)) : [],
  };
}

/**
 * The chart as a forest. With `rootEmployeeId`, only that person's subtree
 * (returned as a single root); otherwise every top-level member. `depth` is
 * the number of levels returned, root level included.
 */
export function buildOrgChart(
  members: OrgChartMember[],
  options: { rootEmployeeId?: number; depth: number },
): OrgChartNode[] {
  const { byId, childrenOf, roots } = indexOrgMembers(members);
  if (options.rootEmployeeId !== undefined) {
    const root = byId.get(options.rootEmployeeId);
    return root ? [materialize(root, childrenOf, options.depth)] : [];
  }
  return roots.map((r) => materialize(r, childrenOf, options.depth));
}

/** Direct reports of one manager, sorted as the chart sorts siblings. */
export function directReportsOf(
  members: OrgChartMember[],
  managerId: number,
  reportCounts: Map<number, number>,
): OrgChartPerson[] {
  return members
    .filter((m) => m.reportsToId === managerId && m.id !== managerId)
    .sort(byName)
    .map((m) => toPerson(m, reportCounts.get(m.id) ?? 0));
}
