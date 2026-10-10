import { ForbiddenException, HttpStatus } from "@nestjs/common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from "../../../common/exceptions/business.exception.js";
import {
  AlreadyCheckedInException,
  AttendanceRangeTooLargeException,
  AttendanceSelfApprovalForbiddenException,
  NotCheckedInException,
} from "./attendance.exceptions.js";
import {
  AttendanceService,
  assertRange,
  parseSessions,
  READ,
  WRITE,
} from "./attendance.service.js";
import type { StoredDay } from "./services/attendance-day-view.service.js";

const ORG_SCOPE = { organizationId: 1 };
const USER_ID = 42;
const EMPLOYEE = { id: 7, userId: USER_ID };
// 11:30 IST on 2026-10-05.
const NOW = new Date("2026-10-05T06:00:00Z");

function row(
  id: number,
  employeeId: number,
  date: string,
  sessions: { checkInAt: Date; checkOutAt: Date | null }[] = [],
) {
  return {
    id,
    employeeId,
    attendanceDate: new Date(`${date}T00:00:00.000Z`),
    status: null,
    sessions: sessions.map((s, i) => ({ id: i + 1, source: "SELF", ...s })),
    employee: { id: employeeId, teamId: 3, workLocationId: 9 },
  };
}

function makeService(opts?: {
  level?: "own" | "team" | "all";
  found?: unknown;
  edited?: unknown;
}) {
  const scope = { organizationId: 1, level: opts?.level ?? "all", teamId: 3 };
  const repository = {
    checkIn: vi.fn().mockResolvedValue({ id: 100, sessionId: 1 }),
    checkOut: vi.fn().mockResolvedValue({ id: 100, sessionId: 1 }),
    findMine: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    findMany: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    findOne: vi.fn().mockResolvedValue(opts?.found ?? null),
    manualEdit: vi.fn().mockResolvedValue(opts?.edited ?? null),
  };
  const dayContext = { load: vi.fn().mockResolvedValue({ ctx: true }) };
  const dayViews = {
    build: vi
      .fn()
      .mockImplementation((_ctx: unknown, _refs: unknown, days: StoredDay[]) =>
        days.map((d) => ({ ...d, status: "PRESENT" })),
      ),
  };
  const tenantContext = {
    getOrgScope: vi.fn().mockReturnValue(ORG_SCOPE),
    getUserId: vi.fn().mockReturnValue(USER_ID),
  };
  const teamContext = { resolveScope: vi.fn().mockResolvedValue(scope) };
  const employees = {
    getCurrentEmployee: vi.fn().mockResolvedValue(EMPLOYEE),
  };
  const locationPrivilege = {
    assertPunchAllowed: vi.fn().mockResolvedValue(undefined),
  };
  const service = new AttendanceService(
    repository as never,
    dayContext as never,
    dayViews as never,
    tenantContext as never,
    teamContext as never,
    employees as never,
    locationPrivilege as never,
  );
  return {
    service,
    scope,
    repository,
    dayContext,
    dayViews,
    teamContext,
    locationPrivilege,
  };
}

describe("AttendanceService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("checkIn", () => {
    it("stamps the server instant and the IST business date for the current employee", async () => {
      const { service, repository, locationPrivilege } = makeService();
      const result = await service.checkIn();
      expect(locationPrivilege.assertPunchAllowed).toHaveBeenCalledWith(7);
      expect(repository.checkIn).toHaveBeenCalledWith(
        ORG_SCOPE,
        7,
        "2026-10-05",
        NOW,
        USER_ID,
      );
      expect(result).toEqual({
        id: 100,
        sessionId: 1,
        attendanceDate: "2026-10-05",
        checkInAt: NOW,
      });
    });

    it("uses the IST date, not the UTC date, just after IST midnight", async () => {
      // 2026-10-05T19:00Z is 00:30 IST on 2026-10-06.
      vi.setSystemTime(new Date("2026-10-05T19:00:00Z"));
      const { service, repository } = makeService();
      const result = await service.checkIn();
      expect(result.attendanceDate).toBe("2026-10-06");
      expect(repository.checkIn.mock.calls[0]![2]).toBe("2026-10-06");
    });

    it("writes nothing when the location gate denies the punch", async () => {
      const { service, repository, locationPrivilege } = makeService();
      locationPrivilege.assertPunchAllowed.mockRejectedValue(
        new ForbiddenException("not here"),
      );
      await expect(service.checkIn()).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(repository.checkIn).not.toHaveBeenCalled();
    });

    it("propagates an already-checked-in conflict from the repository", async () => {
      const { service, repository } = makeService();
      repository.checkIn.mockRejectedValue(new AlreadyCheckedInException());
      await expect(service.checkIn()).rejects.toMatchObject({
        errorCode: "ALREADY_CHECKED_IN",
      });
    });
  });

  describe("checkOut", () => {
    it("closes the open session at the server instant", async () => {
      const { service, repository } = makeService();
      const result = await service.checkOut();
      expect(repository.checkOut).toHaveBeenCalledWith(
        ORG_SCOPE,
        7,
        NOW,
        USER_ID,
      );
      expect(result).toEqual({ id: 100, sessionId: 1, checkOutAt: NOW });
    });

    it("writes nothing when the location gate denies the punch", async () => {
      const { service, repository, locationPrivilege } = makeService();
      locationPrivilege.assertPunchAllowed.mockRejectedValue(
        new ForbiddenException("not here"),
      );
      await expect(service.checkOut()).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(repository.checkOut).not.toHaveBeenCalled();
    });
  });

  describe("findMine", () => {
    it("queries only the current employee's records and builds one view per row", async () => {
      const { service, repository, dayContext, dayViews } = makeService();
      repository.findMine.mockResolvedValue({
        items: [row(1, 7, "2026-10-01"), row(2, 7, "2026-10-02")],
        total: 2,
      });
      const query = {
        from: "2026-10-01",
        to: "2026-10-05",
        page: 1,
        limit: 20,
      };
      const result = await service.findMine(query as never);

      expect(repository.findMine).toHaveBeenCalledWith(
        ORG_SCOPE,
        7,
        { from: "2026-10-01", to: "2026-10-05" },
        query,
      );
      // Calendar facts are loaded once for the page with each employee once.
      expect(dayContext.load).toHaveBeenCalledTimes(1);
      expect(dayContext.load).toHaveBeenCalledWith(
        ORG_SCOPE,
        [{ id: 7, teamId: 3, workLocationId: 9 }],
        "2026-10-01",
        "2026-10-05",
      );
      const days = dayViews.build.mock.calls[0]![2] as StoredDay[];
      expect(days.map((d) => d.attendanceDate)).toEqual([
        "2026-10-01",
        "2026-10-02",
      ]);
      expect(result.items).toHaveLength(2);
      expect(result.items[0]).toMatchObject({ recordId: 1, status: "PRESENT" });
      expect(result).toMatchObject({ total: 2, page: 1, limit: 20 });
    });

    it("refuses an inverted range before touching the repository", async () => {
      const { service, repository } = makeService();
      await expect(
        service.findMine({ from: "2026-10-05", to: "2026-10-01" } as never),
      ).rejects.toMatchObject({ errorCode: "INVALID_DATE_RANGE" });
      expect(repository.findMine).not.toHaveBeenCalled();
    });
  });

  describe("findAll", () => {
    it("resolves the READ team scope and passes filters through", async () => {
      const { service, scope, repository, teamContext, dayContext } =
        makeService({ level: "team" });
      repository.findMany.mockResolvedValue({
        items: [
          row(1, 7, "2026-10-01"),
          row(2, 8, "2026-10-01"),
          row(3, 7, "2026-10-02"),
        ],
        total: 3,
      });
      const query = {
        from: "2026-10-01",
        to: "2026-10-02",
        employeeId: 7,
        status: "PRESENT",
        page: 1,
        limit: 50,
      };
      const result = await service.findAll(query as never);

      expect(teamContext.resolveScope).toHaveBeenCalledWith(READ);
      expect(repository.findMany).toHaveBeenCalledWith(
        scope,
        {
          from: "2026-10-01",
          to: "2026-10-02",
          employeeId: 7,
          status: "PRESENT",
        },
        query,
      );
      // Two distinct employees, de-duplicated.
      const refs = dayContext.load.mock.calls[0]![1] as { id: number }[];
      expect(refs.map((r) => r.id)).toEqual([7, 8]);
      expect(result.items).toHaveLength(3);
      expect(result.total).toBe(3);
    });

    it("refuses a range over the maximum window", async () => {
      const { service, teamContext } = makeService();
      await expect(
        service.findAll({ from: "2026-01-01", to: "2026-12-31" } as never),
      ).rejects.toBeInstanceOf(AttendanceRangeTooLargeException);
      expect(teamContext.resolveScope).not.toHaveBeenCalled();
    });
  });

  describe("findOne", () => {
    it("returns the derived view of the record for its own date", async () => {
      const found = row(5, 7, "2026-10-03");
      const { service, scope, repository, dayContext } = makeService({
        found,
      });
      const view = await service.findOne(5);
      expect(repository.findOne).toHaveBeenCalledWith(scope, 5);
      expect(dayContext.load.mock.calls[0]!.slice(2)).toEqual([
        "2026-10-03",
        "2026-10-03",
      ]);
      expect(view).toMatchObject({
        recordId: 5,
        employeeId: 7,
        attendanceDate: "2026-10-03",
        status: "PRESENT",
      });
    });

    it("answers 404 (not 403) for a record outside the caller's scope", async () => {
      const { service } = makeService({ found: null });
      await expect(service.findOne(99)).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
    });
  });

  describe("manualEdit", () => {
    const date = "2026-10-03";
    // 09:30 and 18:30 IST on 2026-10-03.
    const inAt = "2026-10-03T04:00:00.000Z";
    const outAt = "2026-10-03T13:00:00.000Z";

    it("an `own` scope grants no write, even on the caller's own record", async () => {
      const { service, repository, teamContext } = makeService({
        level: "own",
        found: row(5, 7, date),
      });
      await expect(
        service.manualEdit(5, { status: "PRESENT" } as never),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(teamContext.resolveScope).toHaveBeenCalledWith(WRITE);
      expect(repository.findOne).not.toHaveBeenCalled();
      expect(repository.manualEdit).not.toHaveBeenCalled();
    });

    it("answers 404 when the record is outside the scope", async () => {
      const { service, repository } = makeService({ level: "team" });
      await expect(
        service.manualEdit(5, { status: "PRESENT" } as never),
      ).rejects.toBeInstanceOf(ResourceNotFoundException);
      expect(repository.manualEdit).not.toHaveBeenCalled();
    });

    it("passes undefined sessions when the edit does not touch punches", async () => {
      const found = row(5, 7, date);
      const { service, repository } = makeService({
        level: "team",
        found,
        edited: { ...found, status: "ABSENT" },
      });
      const dto = { status: "ABSENT", reason: "no show" };
      const view = await service.manualEdit(5, dto as never);
      expect(repository.manualEdit).toHaveBeenCalledWith(
        ORG_SCOPE,
        5,
        dto,
        undefined,
        USER_ID,
      );
      expect(view).toMatchObject({ recordId: 5, storedStatus: "ABSENT" });
    });

    it("parses sessions against the record's date and returns the edited view", async () => {
      const found = row(5, 7, date);
      const edited = row(5, 7, date, [
        { checkInAt: new Date(inAt), checkOutAt: new Date(outAt) },
      ]);
      const { service, repository } = makeService({
        level: "all",
        found,
        edited,
      });
      const view = await service.manualEdit(5, {
        sessions: [{ checkInAt: inAt, checkOutAt: outAt }],
      } as never);
      expect(repository.manualEdit.mock.calls[0]![3]).toEqual([
        { checkInAt: new Date(inAt), checkOutAt: new Date(outAt) },
      ]);
      expect(view.sessions).toHaveLength(1);
    });

    it("refuses a punch that falls on another IST date and writes nothing", async () => {
      const { service, repository } = makeService({
        level: "all",
        found: row(5, 7, date),
      });
      await expect(
        service.manualEdit(5, {
          sessions: [{ checkInAt: "2026-10-04T04:00:00.000Z" }],
        } as never),
      ).rejects.toMatchObject({ errorCode: "PUNCH_OUTSIDE_DATE" });
      expect(repository.manualEdit).not.toHaveBeenCalled();
    });
  });
});

describe("assertRange", () => {
  it("accepts a single day and the maximum 62-day window", () => {
    expect(() => assertRange("2026-10-01", "2026-10-01")).not.toThrow();
    // 2026-10-01 .. 2026-12-01 inclusive = 62 days.
    expect(() => assertRange("2026-10-01", "2026-12-01")).not.toThrow();
  });

  it("refuses 63 days with a 422 RANGE_TOO_LARGE", () => {
    try {
      assertRange("2026-10-01", "2026-12-02");
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(AttendanceRangeTooLargeException);
      const ex = e as AttendanceRangeTooLargeException;
      expect(ex.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
      expect(ex.errorCode).toBe("RANGE_TOO_LARGE");
      expect(ex.message).toBe("The date range may not exceed 62 days");
    }
  });

  it("refuses `from` after `to`", () => {
    expect(() => assertRange("2026-10-02", "2026-10-01")).toThrow(
      BusinessRuleViolationException,
    );
  });
});

describe("parseSessions", () => {
  const date = "2026-10-03";

  it("parses open and closed sessions on the IST date", () => {
    const parsed = parseSessions(
      [
        {
          checkInAt: "2026-10-03T03:30:00.000Z",
          checkOutAt: "2026-10-03T07:30:00.000Z",
        },
        { checkInAt: "2026-10-03T08:00:00.000Z", checkOutAt: null },
      ],
      date,
    );
    expect(parsed).toEqual([
      {
        checkInAt: new Date("2026-10-03T03:30:00.000Z"),
        checkOutAt: new Date("2026-10-03T07:30:00.000Z"),
      },
      { checkInAt: new Date("2026-10-03T08:00:00.000Z"), checkOutAt: null },
    ]);
  });

  it("accepts a punch at 00:30 IST whose UTC date is the previous day", () => {
    // 2026-10-02T19:00Z is 00:30 IST on 2026-10-03.
    expect(
      parseSessions([{ checkInAt: "2026-10-02T19:00:00.000Z" }], date),
    ).toHaveLength(1);
  });

  it("refuses a check-out that falls on the next IST date", () => {
    // 2026-10-03T19:00Z is 00:30 IST on 2026-10-04.
    expect(() =>
      parseSessions(
        [
          {
            checkInAt: "2026-10-03T04:00:00.000Z",
            checkOutAt: "2026-10-03T19:00:00.000Z",
          },
        ],
        date,
      ),
    ).toThrow(
      expect.objectContaining({ errorCode: "PUNCH_OUTSIDE_DATE" }) as Error,
    );
  });

  it("refuses a session that ends before it starts as SESSIONS_INCONSISTENT", () => {
    expect(() =>
      parseSessions(
        [
          {
            checkInAt: "2026-10-03T08:00:00.000Z",
            checkOutAt: "2026-10-03T07:00:00.000Z",
          },
        ],
        date,
      ),
    ).toThrow(
      expect.objectContaining({ errorCode: "SESSIONS_INCONSISTENT" }) as Error,
    );
  });

  it("refuses overlapping sessions", () => {
    expect(() =>
      parseSessions(
        [
          {
            checkInAt: "2026-10-03T04:00:00.000Z",
            checkOutAt: "2026-10-03T08:00:00.000Z",
          },
          {
            checkInAt: "2026-10-03T07:00:00.000Z",
            checkOutAt: "2026-10-03T09:00:00.000Z",
          },
        ],
        date,
      ),
    ).toThrow(
      expect.objectContaining({ errorCode: "SESSIONS_INCONSISTENT" }) as Error,
    );
  });

  it("an unparseable timestamp surfaces as a RangeError, not a business error (DTO validation is the guard)", () => {
    // "not-a-date" parses to Invalid Date, which Intl refuses to format.
    expect(() => parseSessions([{ checkInAt: "not-a-date" }], date)).toThrow(
      RangeError,
    );
  });
});

describe("attendance exceptions", () => {
  it("map to the documented status and error code", () => {
    const cases = [
      [
        new AlreadyCheckedInException(),
        HttpStatus.CONFLICT,
        "ALREADY_CHECKED_IN",
      ],
      [new NotCheckedInException(), HttpStatus.CONFLICT, "NOT_CHECKED_IN"],
      [
        new AttendanceSelfApprovalForbiddenException(),
        HttpStatus.FORBIDDEN,
        "SELF_APPROVAL_FORBIDDEN",
      ],
      [
        new AttendanceRangeTooLargeException(31),
        HttpStatus.UNPROCESSABLE_ENTITY,
        "RANGE_TOO_LARGE",
      ],
    ] as const;
    for (const [ex, status, code] of cases) {
      expect(ex.getStatus()).toBe(status);
      expect(ex.errorCode).toBe(code);
    }
    expect(new AttendanceRangeTooLargeException(31).message).toContain(
      "31 days",
    );
  });
});
