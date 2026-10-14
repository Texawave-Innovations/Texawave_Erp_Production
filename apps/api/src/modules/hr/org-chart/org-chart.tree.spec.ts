import {
  buildOrgChart,
  directReportsOf,
  indexOrgMembers,
  type OrgChartMember,
} from "./org-chart.tree.js";

const m = (
  id: number,
  reportsToId: number | null,
  fullName = `Person ${id}`,
  department: OrgChartMember["department"] = { id: 1, name: "Engineering" },
): OrgChartMember => ({
  id,
  employeeCode: `EMP-${String(id).padStart(6, "0")}`,
  fullName,
  reportsToId,
  designation: { id: 1, name: "Engineer" },
  department,
  team: { id: 1, name: "Software" },
});

const ids = (nodes: { id: number }[]) => nodes.map((n) => n.id);

describe("org chart tree builder", () => {
  describe("hierarchy construction", () => {
    it("places a top-level employee (no manager) as a root", () => {
      const forest = buildOrgChart([m(1, null)], { depth: 10 });
      expect(ids(forest)).toEqual([1]);
      expect(forest[0]!.children).toEqual([]);
      expect(forest[0]!.directReportCount).toBe(0);
    });

    it("nests direct reports under their manager", () => {
      const forest = buildOrgChart([m(1, null), m(2, 1), m(3, 1)], {
        depth: 10,
      });
      expect(ids(forest)).toEqual([1]);
      expect(forest[0]!.directReportCount).toBe(2);
      expect(ids(forest[0]!.children)).toEqual([2, 3]);
    });

    it("nests reports of reports (multi-level)", () => {
      const forest = buildOrgChart([m(1, null), m(2, 1), m(3, 2), m(4, 3)], {
        depth: 10,
      });
      expect(forest[0]!.children[0]!.children[0]!.children[0]!.id).toBe(4);
    });

    it("returns an employee with no direct reports as a leaf", () => {
      const forest = buildOrgChart([m(1, null), m(2, 1)], { depth: 10 });
      const leaf = forest[0]!.children[0]!;
      expect(leaf.id).toBe(2);
      expect(leaf.children).toEqual([]);
      expect(leaf.directReportCount).toBe(0);
    });

    it("returns an empty forest for an empty organization", () => {
      expect(buildOrgChart([], { depth: 10 })).toEqual([]);
    });

    it("treats several top-level employees as several roots", () => {
      const forest = buildOrgChart([m(1, null), m(2, null)], { depth: 10 });
      expect(forest).toHaveLength(2);
    });

    it("keeps department and team on each node", () => {
      const forest = buildOrgChart([m(1, null)], { depth: 10 });
      expect(forest[0]!.department).toEqual({ id: 1, name: "Engineering" });
      expect(forest[0]!.team).toEqual({ id: 1, name: "Software" });
    });
  });

  describe("missing or out-of-scope managers", () => {
    it("promotes an employee whose manager is not in the list to a root", () => {
      // Manager 99 is outside the caller's scope (or inactive): the report
      // must still appear, and the manager must not be revealed.
      const forest = buildOrgChart([m(2, 99)], { depth: 10 });
      expect(ids(forest)).toEqual([2]);
    });

    it("treats a self-reference as no manager", () => {
      const forest = buildOrgChart([m(1, 1)], { depth: 10 });
      expect(ids(forest)).toEqual([1]);
    });
  });

  describe("cycle and invalid hierarchy defense", () => {
    it("does not loop forever on a two-node cycle and keeps both people", () => {
      const forest = buildOrgChart([m(1, 2), m(2, 1)], { depth: 10 });
      expect(ids(forest).sort()).toEqual([1, 2]);
      expect(forest.every((n) => n.children.length === 0)).toBe(true);
    });

    it("breaks a longer cycle and keeps a clean branch under it intact", () => {
      // 1 -> 2 -> 3 -> 1 is a loop; 4 is a clean root with a valid report 5.
      const forest = buildOrgChart(
        [m(1, 3), m(2, 1), m(3, 2), m(4, null), m(5, 4)],
        { depth: 10 },
      );
      expect(ids(forest).sort()).toEqual([1, 2, 3, 4]);
      const four = forest.find((n) => n.id === 4)!;
      expect(ids(four.children)).toEqual([5]);
    });

    it("does not attach a person who reports into a loop", () => {
      // 6 reports to 1, but 1 sits in a 1 <-> 2 loop, so 6's chain never
      // reaches a top-level employee. It is shown as a root, not dropped.
      const forest = buildOrgChart([m(1, 2), m(2, 1), m(6, 1)], {
        depth: 10,
      });
      expect(ids(forest).sort()).toEqual([1, 2, 6]);
    });

    it("handles a very deep, valid chain without recursion blow-up", () => {
      const chain: OrgChartMember[] = [m(1, null)];
      for (let i = 2; i <= 2000; i++) chain.push(m(i, i - 1));
      const index = indexOrgMembers(chain);
      expect(index.roots.map((r) => r.id)).toEqual([1]);
      // Depth cap bounds the materialized recursion regardless of size.
      const forest = buildOrgChart(chain, { depth: 10 });
      let depthSeen = 0;
      let cur: { children: unknown[] }[] = forest;
      while (cur.length) {
        depthSeen++;
        cur = (cur[0] as { children: { children: unknown[] }[] }).children;
      }
      expect(depthSeen).toBe(10);
    });
  });

  describe("depth and subtree", () => {
    const tree = [m(1, null), m(2, 1), m(3, 2), m(4, 3)];

    it("cuts off below the requested depth, root level included", () => {
      const forest = buildOrgChart(tree, { depth: 2 });
      expect(forest[0]!.children.map((c) => c.id)).toEqual([2]);
      expect(forest[0]!.children[0]!.children).toEqual([]);
    });

    it("keeps directReportCount at the cut-off so the client can expand", () => {
      const forest = buildOrgChart(tree, { depth: 2 });
      const cutOff = forest[0]!.children[0]!;
      expect(cutOff.children).toEqual([]);
      expect(cutOff.directReportCount).toBe(1);
    });

    it("depth 1 returns roots only, without children", () => {
      const forest = buildOrgChart(tree, { depth: 1 });
      expect(forest[0]!.children).toEqual([]);
      expect(forest[0]!.directReportCount).toBe(1);
    });

    it("returns only the requested subtree when rootEmployeeId is given", () => {
      const forest = buildOrgChart(tree, { rootEmployeeId: 2, depth: 10 });
      expect(ids(forest)).toEqual([2]);
      expect(ids(forest[0]!.children)).toEqual([3]);
    });

    it("returns nothing when rootEmployeeId is not among the members", () => {
      expect(buildOrgChart(tree, { rootEmployeeId: 77, depth: 10 })).toEqual(
        [],
      );
    });
  });

  describe("ordering", () => {
    it("orders roots and siblings by name, then id — deterministically", () => {
      const forest = buildOrgChart(
        [
          m(9, null, "Zed"),
          m(3, null, "Amir"),
          m(5, 9, "Bina"),
          m(4, 9, "Bina"),
          m(7, 9, "Asha"),
        ],
        { depth: 10 },
      );
      expect(ids(forest)).toEqual([3, 9]);
      expect(ids(forest[1]!.children)).toEqual([7, 4, 5]);
    });

    it("gives the same output regardless of input order", () => {
      const a = [m(1, null, "Root"), m(2, 1, "B"), m(3, 1, "A")];
      const b = [...a].reverse();
      expect(buildOrgChart(a, { depth: 10 })).toEqual(
        buildOrgChart(b, { depth: 10 }),
      );
    });
  });

  describe("direct reports", () => {
    it("lists only the manager's reports, sorted, with visible counts", () => {
      const members = [m(1, null), m(2, 1, "Zoe"), m(3, 1, "Adi"), m(4, 2)];
      const counts = new Map([
        [2, 1],
        [3, 0],
      ]);
      const reports = directReportsOf(members, 1, counts);
      expect(ids(reports)).toEqual([3, 2]);
      expect(reports.find((r) => r.id === 2)!.directReportCount).toBe(1);
      expect(reports.find((r) => r.id === 3)!.directReportCount).toBe(0);
    });

    it("returns an empty list for an employee with no direct reports", () => {
      expect(directReportsOf([m(1, null)], 1, new Map())).toEqual([]);
    });

    it("never returns the manager as their own report", () => {
      expect(directReportsOf([m(1, 1)], 1, new Map())).toEqual([]);
    });
  });

  describe("field exposure", () => {
    it("emits only chart fields — no contact or compensation data", () => {
      const row = {
        ...m(1, null),
        workEmail: "a@b.test",
        phone: "+91 9999",
        salary: 1000,
      } as unknown as OrgChartMember;
      const node = buildOrgChart([row], { depth: 10 })[0]!;
      expect(Object.keys(node).sort()).toEqual(
        [
          "children",
          "department",
          "designation",
          "directReportCount",
          "employeeCode",
          "fullName",
          "id",
          "reportsToId",
          "team",
        ].sort(),
      );
    });
  });
});
