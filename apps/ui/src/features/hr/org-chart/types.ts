/** Mirrors `apps/api/src/modules/hr/org-chart/org-chart.tree.ts` — the API's
 * response shapes. Only name, code, designation, department and team ever
 * leave that module, so this type carries nothing more. */
export interface OrgChartMember {
  id: number;
  employeeCode: string;
  fullName: string;
  reportsToId: number | null;
  designation: { id: number; name: string };
  department: { id: number; name: string } | null;
  team: { id: number; name: string };
}

export interface OrgChartPerson extends OrgChartMember {
  directReportCount: number;
}

export interface OrgChartNode extends OrgChartPerson {
  children: OrgChartNode[];
}
