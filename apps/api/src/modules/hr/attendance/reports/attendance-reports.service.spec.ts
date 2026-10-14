import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AttendanceRangeTooLargeException } from "../attendance.exceptions.js";
import type { EffectiveStatus } from "../services/attendance-calculation.service.js";
import type {
  DayView,
  StoredDay,
} from "../services/attendance-day-view.service.js";
import {
  AttendanceReportsService,
  REPORT_READ,
} from "./attendance-reports.service.js";

const ORG_SCOPE = { organizationId: 1 };
// 11:30 IST on 2026-10-05.
const NOW = new Date("2026-10-05T06:00:00Z");

const ALICE = {
  id: 7,
  employeeCode: "E007",
  fullName: "Alice",
  teamId: 3,
  workLocationId: 9,
};
const BOB = {
  id: 8,
  employeeCode: "E008",
  fullName: "Bob",
  teamId: 3,
  workLocationId: null,
};

type Derive = (day: StoredDay) => Partial<DayView>;

/** Default derivation: a stored day is PRESENT with 8h worked; a day with no
 * record is NOT_MARKED. Tests override per day where the rule matters. */
const defaultDerive: Derive = (d) =>
  d.recordId === null
    ? { status: "NOT_MARKED" }
    : { status: "PRESENT", workedMinutes: 480, targetMinutes: 480 };

function makeService(opts: {
  employees: unknown[];
  stored?: StoredDay[];
  derive?: Derive;
  level?: "own" | "team" | "all";
}) {
  const scope = { organizationId: 1, level: opts.level ?? "team", teamId: 3 };
  const page = { items: opts.employees, total: opts.employees.length };
  const reportEmployees = {
    findEmployeesEmployedBetween: vi.fn().mockResolvedValue(page),
    findActiveEmployeesEmployedBetween: vi.fn().mockResolvedValue(page),
  };
  const records = {
    findDaysForEmployees: vi.fn().mockResolvedValue(opts.stored ?? []),
  };
  const dayContext = { load: vi.fn().mockResolvedValue({ ctx: true }) };
  const derive = opts.derive ?? defaultDerive;
  const dayViews = {
    build: vi
      .fn()
      .mockImplementation(
        (_ctx: unknown, _refs: unknown, days: StoredDay[]): DayView[] =>
          days.map((d) => ({
            ...d,
            status: "NOT_MARKED" as EffectiveStatus,
            targetMinutes: null,
            workedMinutes: 0,
            overtimeMinutes: 0,
            shortfallMinutes: 0,
            hasOpenSession: d.sessions.some((s) => s.checkOutAt === null),
            ...derive(d),
          })),
      ),
  };
  const teamContext = { resolveScope: vi.fn().mockResolvedValue(scope) };
  const tenantContext = { getOrgScope: vi.fn().mockReturnValue(ORG_SCOPE) };
  const service = new AttendanceReportsService(
    reportEmployees as never,
    records as never,
    dayContext as never,
    dayViews as never,
    teamContext as never,
    tenantContext as never,
  );
  return {
    service,
    scope,
    reportEmployees,
    records,
    dayContext,
    dayViews,
    teamContext,
  };
}

function stored(
  employeeId: number,
  attendanceDate: string,
  sessions: StoredDay["sessions"] = [],
  storedStatus: StoredDay["storedStatus"] = null,
): StoredDay {
  return {
    recordId: 1000 + employeeId,
    employeeId,
    attendanceDate,
    storedStatus,
    sessions,
  };
}

describe("AttendanceReportsService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("daily", () => {
    it("returns one row per employee for the date, including unmarked ones", async () => {
      const {
        service,
        scope,
        reportEmployees,
        records,
        dayContext,
        teamContext,
      } = makeService({
        employees: [ALICE, BOB],
        stored: [stored(7, "2026-10-02")],
      });
      const query = { date: "2026-10-02", page: 1, limit: 20 };
      const result = await service.daily(query as never);

      expect(teamContext.resolveScope).toHaveBeenCalledWith(REPORT_READ);
      expect(reportEmployees.findEmployeesEmployedBetween).toHaveBeenCalledWith(
        scope,
        "2026-10-02",
        "2026-10-02",
        query,
      );
      expect(records.findDaysForEmployees).toHaveBeenCalledWith(
        ORG_SCOPE,
        [7, 8],
        "2026-10-02",
        "2026-10-02",
      );
      expect(dayContext.load).toHaveBeenCalledWith(
        ORG_SCOPE,
        [
          { id: 7, teamId: 3, workLocationId: 9 },
          { id: 8, teamId: 3, workLocationId: null },
        ],
        "2026-10-02",
        "2026-10-02",
      );
      expect(result.items).toEqual([
        expect.objectContaining({
          employeeId: 7,
          status: "PRESENT",
          employee: { id: 7, employeeCode: "E007", fullName: "Alice" },
        }),
        expect.objectContaining({
          employeeId: 8,
          recordId: null,
          status: "NOT_MARKED",
          employee: { id: 8, employeeCode: "E008", fullName: "Bob" },
        }),
      ]);
      expect(result).toMatchObject({ total: 2, page: 1, limit: 20 });
    });

    it("loads nothing when no employee is in scope", async () => {
      const { service, records, dayContext, dayViews } = makeService({
        employees: [],
      });
      const result = await service.daily({
        date: "2026-10-02",
        page: 1,
        limit: 20,
      } as never);
      expect(result.items).toEqual([]);
      expect(records.findDaysForEmployees).not.toHaveBeenCalled();
      expect(dayContext.load).not.toHaveBeenCalled();
      expect(dayViews.build).not.toHaveBeenCalled();
    });
  });

  describe("monthly", () => {
    it("summarises a past month over every calendar day of it", async () => {
      const derive: Derive = (d) => {
        if (d.attendanceDate === "2026-09-01")
          return {
            status: "PRESENT",
            workedMinutes: 540,
            overtimeMinutes: 60,
          };
        if (d.attendanceDate === "2026-09-02")
          return {
            status: "HALF_DAY",
            workedMinutes: 240,
            shortfallMinutes: 240,
          };
        if (d.attendanceDate === "2026-09-06") return { status: "WEEKLY_OFF" };
        return { status: "ABSENT", shortfallMinutes: 480 };
      };
      const { service, reportEmployees, dayViews } = makeService({
        employees: [ALICE],
        derive,
      });
      const result = await service.monthly({
        month: "2026-09",
        page: 1,
        limit: 20,
      } as never);

      expect(
        reportEmployees.findEmployeesEmployedBetween.mock.calls[0]!.slice(1, 3),
      ).toEqual(["2026-09-01", "2026-09-30"]);
      expect(dayViews.build.mock.calls[0]![2]).toHaveLength(30);
      const [row] = result.items;
      expect(row).toEqual({
        employee: { id: 7, employeeCode: "E007", fullName: "Alice" },
        month: "2026-09",
        daysCounted: 30,
        countsByStatus: {
          PRESENT: 1,
          ABSENT: 27,
          HALF_DAY: 1,
          HOLIDAY: 0,
          WEEKLY_OFF: 1,
          ON_LEAVE: 0,
          NOT_MARKED: 0,
        },
        workedMinutes: 780,
        overtimeMinutes: 60,
        shortfallMinutes: 240 + 27 * 480,
      });
    });

    it("counts the current month only up to and including today (IST)", async () => {
      const { service, records } = makeService({
        employees: [ALICE, BOB],
        stored: [stored(7, "2026-10-01"), stored(8, "2026-10-05")],
      });
      const result = await service.monthly({
        month: "2026-10",
        page: 1,
        limit: 20,
      } as never);
      expect(records.findDaysForEmployees.mock.calls[0]!.slice(2)).toEqual([
        "2026-10-01",
        "2026-10-05",
      ]);
      expect(result.items.map((r) => r.daysCounted)).toEqual([5, 5]);
      expect(result.items[0]!.countsByStatus).toMatchObject({
        PRESENT: 1,
        NOT_MARKED: 4,
      });
      expect(result.items[1]!.employee.id).toBe(8);
      expect(result.items[1]!.countsByStatus.PRESENT).toBe(1);
      expect(result.items[1]!.workedMinutes).toBe(480);
    });

    it("a future month yields zero rows of counts without loading any day", async () => {
      const { service, records, dayViews } = makeService({
        employees: [ALICE],
      });
      const result = await service.monthly({
        month: "2026-11",
        page: 1,
        limit: 20,
      } as never);
      expect(records.findDaysForEmployees).not.toHaveBeenCalled();
      expect(dayViews.build).not.toHaveBeenCalled();
      expect(result.items).toEqual([
        expect.objectContaining({
          month: "2026-11",
          daysCounted: 0,
          workedMinutes: 0,
          countsByStatus: expect.objectContaining({ PRESENT: 0 }) as unknown,
        }),
      ]);
    });

    it("handles February in a leap year", async () => {
      const { service, reportEmployees } = makeService({
        employees: [],
      });
      await service.monthly({ month: "2028-02", page: 1, limit: 20 } as never);
      expect(
        reportEmployees.findEmployeesEmployedBetween.mock.calls[0]!.slice(1, 3),
      ).toEqual(["2028-02-01", "2028-02-29"]);
    });
  });

  describe("fullMonthPresent", () => {
    const joined = (iso: string, exit: string | null = null) => ({
      dateOfJoining: new Date(`${iso}T00:00:00.000Z`),
      dateOfExit: exit ? new Date(`${exit}T00:00:00.000Z`) : null,
    });

    it("marks an employee present on every working day of a completed month", async () => {
      const derive: Derive = (d) => {
        if (d.employeeId === 8 && d.attendanceDate === "2026-09-10")
          return { status: "ABSENT" };
        if (d.attendanceDate === "2026-09-06") return { status: "WEEKLY_OFF" };
        if (d.attendanceDate === "2026-09-15") return { status: "HOLIDAY" };
        return { status: "PRESENT" };
      };
      const { service, scope, reportEmployees } = makeService({
        employees: [
          { ...ALICE, ...joined("2025-01-01") },
          { ...BOB, ...joined("2025-01-01") },
        ],
        derive,
      });
      const query = {
        month: "2026-09",
        employeeId: undefined,
        teamId: 3,
        page: 1,
        limit: 20,
      };
      const result = await service.fullMonthPresent(query as never);

      expect(
        reportEmployees.findActiveEmployeesEmployedBetween,
      ).toHaveBeenCalledWith(scope, "2026-09-01", "2026-09-30", query, {
        employeeId: undefined,
        teamId: 3,
      });
      const [alice, bob] = result.items;
      expect(alice).toMatchObject({
        month: "2026-09",
        monthComplete: true,
        employedWholeMonth: true,
        presentDays: 28,
        fullMonthPresent: true,
      });
      expect(alice!.countsByStatus).toMatchObject({
        PRESENT: 28,
        WEEKLY_OFF: 1,
        HOLIDAY: 1,
      });
      expect(alice!.days).toHaveLength(30);
      expect(alice!.days[0]).toEqual({
        attendanceDate: "2026-09-01",
        status: "PRESENT",
      });
      expect(bob).toMatchObject({
        presentDays: 27,
        fullMonthPresent: false,
      });
      expect(bob!.countsByStatus.ABSENT).toBe(1);
    });

    it("is never full-month-present for an employee who joined mid-month or exited before month end", async () => {
      const { service } = makeService({
        employees: [
          { ...ALICE, ...joined("2026-09-02") },
          { ...BOB, ...joined("2025-01-01", "2026-09-29") },
        ],
        derive: () => ({ status: "PRESENT" }),
      });
      const result = await service.fullMonthPresent({
        month: "2026-09",
        page: 1,
        limit: 20,
      } as never);
      expect(result.items.map((r) => r.employedWholeMonth)).toEqual([
        false,
        false,
      ]);
      expect(result.items.map((r) => r.fullMonthPresent)).toEqual([
        false,
        false,
      ]);
    });

    it("counts an exit on the last day as employed the whole month", async () => {
      const { service } = makeService({
        employees: [{ ...ALICE, ...joined("2026-09-01", "2026-09-30") }],
        derive: () => ({ status: "PRESENT" }),
      });
      const result = await service.fullMonthPresent({
        month: "2026-09",
        page: 1,
        limit: 20,
      } as never);
      expect(result.items[0]).toMatchObject({
        employedWholeMonth: true,
        fullMonthPresent: true,
      });
    });

    it("an incomplete (current) month is never full-month-present yet", async () => {
      const { service, records } = makeService({
        employees: [{ ...ALICE, ...joined("2025-01-01") }],
        derive: () => ({ status: "PRESENT" }),
      });
      const result = await service.fullMonthPresent({
        month: "2026-10",
        page: 1,
        limit: 20,
      } as never);
      expect(records.findDaysForEmployees.mock.calls[0]!.slice(2)).toEqual([
        "2026-10-01",
        "2026-10-05",
      ]);
      expect(result.items[0]).toMatchObject({
        monthComplete: false,
        presentDays: 5,
        fullMonthPresent: false,
      });
    });

    it("a future month loads no days and reports empty counts", async () => {
      const { service, records } = makeService({
        employees: [{ ...ALICE, ...joined("2025-01-01") }],
      });
      const result = await service.fullMonthPresent({
        month: "2026-12",
        page: 1,
        limit: 20,
      } as never);
      expect(records.findDaysForEmployees).not.toHaveBeenCalled();
      expect(result.items[0]).toMatchObject({
        monthComplete: false,
        presentDays: 0,
        fullMonthPresent: false,
        days: [],
      });
    });
  });

  describe("missingPunches", () => {
    const open = (iso: string) => ({
      id: 1,
      checkInAt: new Date(iso),
      checkOutAt: null,
      source: "SELF",
    });

    const setup = () =>
      makeService({
        employees: [ALICE, BOB],
        stored: [
          // Open session on a past day → MISSING_CHECKOUT.
          stored(7, "2026-10-02", [open("2026-10-02T04:00:00Z")]),
          // Open session today → not missing yet.
          stored(7, "2026-10-05", [open("2026-10-05T04:00:00Z")]),
          // HR stored PRESENT with no punch → MISSING_CHECK_IN.
          stored(8, "2026-10-03", [], "PRESENT"),
        ],
        derive: (d) =>
          d.storedStatus === "PRESENT" || d.sessions.length > 0
            ? { status: "PRESENT" }
            : { status: "NOT_MARKED" },
      });

    it("reports each type of missing punch and skips unmarked days", async () => {
      const { service, reportEmployees, scope } = setup();
      const query = {
        from: "2026-10-01",
        to: "2026-10-05",
        employeeId: undefined,
        teamId: undefined,
        page: 1,
        limit: 20,
      };
      const result = await service.missingPunches(query as never);
      expect(reportEmployees.findEmployeesEmployedBetween).toHaveBeenCalledWith(
        scope,
        "2026-10-01",
        "2026-10-05",
        query,
        {
          employeeId: undefined,
          teamId: undefined,
        },
      );
      expect(
        result.items.map((r) => [
          r.employee.fullName,
          r.attendanceDate,
          r.type,
        ]),
      ).toEqual([
        ["Alice", "2026-10-02", "MISSING_CHECKOUT"],
        ["Bob", "2026-10-03", "MISSING_CHECK_IN"],
      ]);
      // Total is the employee page total, not the row count.
      expect(result.total).toBe(2);
    });

    it("filters by type within the page", async () => {
      const { service } = setup();
      const result = await service.missingPunches({
        from: "2026-10-01",
        to: "2026-10-05",
        type: "MISSING_CHECK_IN",
        page: 1,
        limit: 20,
      } as never);
      expect(result.items.map((r) => r.type)).toEqual(["MISSING_CHECK_IN"]);
    });

    it("refuses an over-long range before resolving scope", async () => {
      const { service, teamContext } = setup();
      await expect(
        service.missingPunches({
          from: "2026-01-01",
          to: "2026-06-01",
        } as never),
      ).rejects.toBeInstanceOf(AttendanceRangeTooLargeException);
      expect(teamContext.resolveScope).not.toHaveBeenCalled();
    });
  });

  describe("overtime", () => {
    it("totals each employee's overtime days, and lists employees with none", async () => {
      const derive: Derive = (d) =>
        d.employeeId === 7 && d.attendanceDate !== "2026-10-02"
          ? {
              status: "PRESENT",
              targetMinutes: 480,
              workedMinutes:
                480 + (d.attendanceDate === "2026-10-01" ? 30 : 45),
              overtimeMinutes: d.attendanceDate === "2026-10-01" ? 30 : 45,
            }
          : { status: "PRESENT", targetMinutes: 480, workedMinutes: 480 };
      const { service, reportEmployees, scope } = makeService({
        employees: [ALICE, BOB],
        derive,
      });
      const query = {
        from: "2026-10-01",
        to: "2026-10-03",
        employeeId: 7,
        teamId: 3,
        page: 1,
        limit: 20,
      };
      const result = await service.overtime(query as never);
      expect(reportEmployees.findEmployeesEmployedBetween).toHaveBeenCalledWith(
        scope,
        "2026-10-01",
        "2026-10-03",
        query,
        {
          employeeId: 7,
          teamId: 3,
        },
      );
      const [alice, bob] = result.items;
      expect(alice).toEqual({
        employee: { id: 7, employeeCode: "E007", fullName: "Alice" },
        from: "2026-10-01",
        to: "2026-10-03",
        daysWithOvertime: 2,
        overtimeMinutes: 75,
        days: [
          {
            attendanceDate: "2026-10-01",
            status: "PRESENT",
            targetMinutes: 480,
            workedMinutes: 510,
            overtimeMinutes: 30,
          },
          {
            attendanceDate: "2026-10-03",
            status: "PRESENT",
            targetMinutes: 480,
            workedMinutes: 525,
            overtimeMinutes: 45,
          },
        ],
      });
      expect(bob).toMatchObject({
        daysWithOvertime: 0,
        overtimeMinutes: 0,
        days: [],
      });
    });

    it("refuses an inverted range", async () => {
      const { service } = makeService({ employees: [ALICE] });
      await expect(
        service.overtime({ from: "2026-10-03", to: "2026-10-01" } as never),
      ).rejects.toMatchObject({ errorCode: "INVALID_DATE_RANGE" });
    });
  });
});
