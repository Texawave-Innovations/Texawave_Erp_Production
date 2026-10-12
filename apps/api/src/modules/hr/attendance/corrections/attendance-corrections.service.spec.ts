import { ForbiddenException } from "@nestjs/common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from "../../../../common/exceptions/business.exception.js";
import { AttendanceSelfApprovalForbiddenException } from "../attendance.exceptions.js";
import {
  AttendanceCorrectionsService,
  CORRECTION_APPROVE,
  CORRECTION_READ,
  validateSubmission,
} from "./attendance-corrections.service.js";

const ORG_SCOPE = { organizationId: 1 };
const APPROVER_ID = 42;
// 11:30 IST on 2026-10-05.
const NOW = new Date("2026-10-05T06:00:00Z");
const DATE = "2026-10-03";
// 09:30 and 18:30 IST on 2026-10-03.
const IN_AT = "2026-10-03T04:00:00.000Z";
const OUT_AT = "2026-10-03T13:00:00.000Z";

function makeService(opts?: {
  level?: "own" | "team" | "all";
  found?: unknown;
}) {
  const scope = { organizationId: 1, level: opts?.level ?? "team", teamId: 3 };
  const repository = {
    create: vi
      .fn()
      .mockImplementation(
        (_scope: unknown, data: Record<string, unknown>, userId: number) => ({
          id: 1,
          status: "PENDING",
          ...data,
          requestedBy: userId,
        }),
      ),
    findMany: vi.fn().mockResolvedValue({ items: [{ id: 1 }], total: 1 }),
    findOne: vi.fn().mockResolvedValue(opts?.found ?? null),
    decide: vi
      .fn()
      .mockImplementation(
        (_scope: unknown, id: number, data: Record<string, unknown>) => ({
          id,
          ...data,
        }),
      ),
  };
  const tenantContext = {
    getOrgScope: vi.fn().mockReturnValue(ORG_SCOPE),
    getUserId: vi.fn().mockReturnValue(APPROVER_ID),
  };
  const teamContext = { resolveScope: vi.fn().mockResolvedValue(scope) };
  const employees = {
    getCurrentEmployee: vi.fn().mockResolvedValue({ id: 7, userId: 5 }),
  };
  const service = new AttendanceCorrectionsService(
    repository as never,
    tenantContext as never,
    teamContext as never,
    employees as never,
  );
  return { service, scope, repository, teamContext, employees };
}

const pending = (requestedBy = 5, employeeUserId: number | null = 5) => ({
  id: 11,
  status: "PENDING",
  requestedBy,
  employee: { id: 7, userId: employeeUserId },
});

describe("AttendanceCorrectionsService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("submitForCurrentEmployee", () => {
    it("files the correction against the authenticated user's own employee", async () => {
      const { service, repository } = makeService();
      const dto = {
        attendanceDate: DATE,
        correctionType: "MISSED_CHECK_OUT",
        requestedCheckOutAt: OUT_AT,
        reason: "forgot",
      };
      const created = await service.submitForCurrentEmployee(dto as never);
      expect(repository.create).toHaveBeenCalledWith(
        ORG_SCOPE,
        { ...dto, employeeId: 7 },
        APPROVER_ID,
      );
      expect(created).toMatchObject({ employeeId: 7, status: "PENDING" });
    });

    it("ignores an employeeId smuggled into the body", async () => {
      const { service, repository } = makeService();
      await service.submitForCurrentEmployee({
        attendanceDate: DATE,
        correctionType: "LATE_ARRIVAL",
        requestedCheckInAt: IN_AT,
        employeeId: 999,
      } as never);
      expect(repository.create.mock.calls[0]![1]).toMatchObject({
        employeeId: 7,
      });
    });

    it("validates before loading the employee or writing", async () => {
      const { service, repository, employees } = makeService();
      await expect(
        service.submitForCurrentEmployee({
          attendanceDate: DATE,
          correctionType: "MISSED_CHECK_OUT",
        } as never),
      ).rejects.toMatchObject({ errorCode: "CORRECTION_TIME_REQUIRED" });
      expect(employees.getCurrentEmployee).not.toHaveBeenCalled();
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe("findAll / findOne", () => {
    it("lists within the READ scope and paginates", async () => {
      const { service, scope, repository, teamContext } = makeService();
      const query = { status: "PENDING", page: 2, limit: 10 };
      const result = await service.findAll(query as never);
      expect(teamContext.resolveScope).toHaveBeenCalledWith(CORRECTION_READ);
      expect(repository.findMany).toHaveBeenCalledWith(scope, query, query);
      expect(result).toMatchObject({
        items: [{ id: 1 }],
        total: 1,
        page: 2,
        limit: 10,
      });
    });

    it("returns the row in scope", async () => {
      const { service, scope, repository } = makeService({
        found: pending(),
      });
      await expect(service.findOne(11)).resolves.toMatchObject({ id: 11 });
      expect(repository.findOne).toHaveBeenCalledWith(scope, 11);
    });

    it("answers 404 (not 403) outside the scope", async () => {
      const { service } = makeService();
      await expect(service.findOne(11)).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
    });
  });

  describe("approve / reject", () => {
    it("approves as the caller with the APPROVE permission scope", async () => {
      const { service, repository, teamContext } = makeService({
        found: pending(),
      });
      const result = await service.approve(11, { note: "ok" } as never);
      expect(teamContext.resolveScope).toHaveBeenCalledWith(CORRECTION_APPROVE);
      expect(repository.decide).toHaveBeenCalledWith(ORG_SCOPE, 11, {
        status: "APPROVED",
        decidedBy: APPROVER_ID,
        note: "ok",
      });
      expect(result).toMatchObject({ status: "APPROVED" });
    });

    it("rejects with the given note", async () => {
      const { service, repository } = makeService({
        level: "all",
        found: pending(),
      });
      await service.reject(11, { note: "no evidence" } as never);
      expect(repository.decide).toHaveBeenCalledWith(ORG_SCOPE, 11, {
        status: "REJECTED",
        decidedBy: APPROVER_ID,
        note: "no evidence",
      });
    });

    it("an `own` scope grants no decision at all", async () => {
      const { service, repository } = makeService({
        level: "own",
        found: pending(),
      });
      await expect(service.approve(11, {} as never)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(repository.findOne).not.toHaveBeenCalled();
      expect(repository.decide).not.toHaveBeenCalled();
    });

    it("answers 404 when the correction is outside the scope", async () => {
      const { service, repository } = makeService();
      await expect(service.reject(11, {} as never)).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
      expect(repository.decide).not.toHaveBeenCalled();
    });

    it("refuses deciding a correction the caller requested", async () => {
      const { service, repository } = makeService({
        found: pending(APPROVER_ID, 5),
      });
      await expect(service.approve(11, {} as never)).rejects.toBeInstanceOf(
        AttendanceSelfApprovalForbiddenException,
      );
      expect(repository.decide).not.toHaveBeenCalled();
    });

    it("refuses deciding a correction on the caller's own employee record, even if someone else filed it", async () => {
      const { service, repository } = makeService({
        found: pending(5, APPROVER_ID),
      });
      await expect(service.reject(11, {} as never)).rejects.toMatchObject({
        errorCode: "SELF_APPROVAL_FORBIDDEN",
      });
      expect(repository.decide).not.toHaveBeenCalled();
    });

    it("allows deciding for an employee with no linked user", async () => {
      const { service, repository } = makeService({
        found: pending(5, null),
      });
      await service.approve(11, {} as never);
      expect(repository.decide).toHaveBeenCalledTimes(1);
    });
  });
});

describe("validateSubmission", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const code = (dto: Record<string, unknown>) => {
    try {
      validateSubmission(dto as never);
      return null;
    } catch (e) {
      expect(e).toBeInstanceOf(BusinessRuleViolationException);
      return (e as { errorCode?: string }).errorCode;
    }
  };

  it("accepts each type with the times it requires", () => {
    expect(
      code({
        attendanceDate: DATE,
        correctionType: "MISSED_CHECK_IN",
        requestedCheckInAt: IN_AT,
      }),
    ).toBeNull();
    expect(
      code({
        attendanceDate: DATE,
        correctionType: "MISSED_CHECK_OUT",
        requestedCheckOutAt: OUT_AT,
      }),
    ).toBeNull();
    expect(
      code({
        attendanceDate: DATE,
        correctionType: "INCORRECT_TIME",
        requestedCheckInAt: IN_AT,
        requestedCheckOutAt: OUT_AT,
      }),
    ).toBeNull();
    expect(
      code({
        attendanceDate: DATE,
        correctionType: "INCORRECT_TIME",
        requestedCheckOutAt: OUT_AT,
      }),
    ).toBeNull();
    expect(
      code({
        attendanceDate: DATE,
        correctionType: "LATE_ARRIVAL",
        requestedCheckInAt: IN_AT,
      }),
    ).toBeNull();
    expect(
      code({
        attendanceDate: DATE,
        correctionType: "EARLY_DEPARTURE",
        requestedCheckOutAt: OUT_AT,
      }),
    ).toBeNull();
  });

  it("accepts a correction for today", () => {
    expect(
      code({
        attendanceDate: "2026-10-05",
        correctionType: "LATE_ARRIVAL",
        requestedCheckInAt: "2026-10-05T04:00:00.000Z",
      }),
    ).toBeNull();
  });

  it("refuses an unknown type", () => {
    expect(
      code({
        attendanceDate: DATE,
        correctionType: "TELEPORTED",
        requestedCheckInAt: IN_AT,
      }),
    ).toBe("INVALID_CORRECTION_TYPE");
  });

  it("refuses a request with no time at all", () => {
    expect(
      code({ attendanceDate: DATE, correctionType: "INCORRECT_TIME" }),
    ).toBe("CORRECTION_TIME_REQUIRED");
  });

  it("refuses a time the type does not change", () => {
    expect(
      code({
        attendanceDate: DATE,
        correctionType: "MISSED_CHECK_OUT",
        requestedCheckInAt: IN_AT,
        requestedCheckOutAt: OUT_AT,
      }),
    ).toBe("CORRECTION_FIELD_NOT_ALLOWED");
    expect(
      code({
        attendanceDate: DATE,
        correctionType: "LATE_ARRIVAL",
        requestedCheckInAt: IN_AT,
        requestedCheckOutAt: OUT_AT,
      }),
    ).toBe("CORRECTION_FIELD_NOT_ALLOWED");
    expect(
      code({
        attendanceDate: DATE,
        correctionType: "EARLY_DEPARTURE",
        requestedCheckInAt: IN_AT,
      }),
    ).toBe("CORRECTION_FIELD_NOT_ALLOWED");
  });

  it("refuses a missed check-in without the check-in time", () => {
    expect(
      code({
        attendanceDate: DATE,
        correctionType: "MISSED_CHECK_IN",
        requestedCheckOutAt: OUT_AT,
      }),
    ).toBe("CORRECTION_TIME_REQUIRED");
  });

  it("refuses a future date", () => {
    expect(
      code({
        attendanceDate: "2026-10-06",
        correctionType: "LATE_ARRIVAL",
        requestedCheckInAt: "2026-10-06T04:00:00.000Z",
      }),
    ).toBe("FUTURE_DATE");
  });

  it("refuses a requested time on another IST date", () => {
    // 2026-10-03T19:00Z is 00:30 IST on 2026-10-04.
    expect(
      code({
        attendanceDate: DATE,
        correctionType: "MISSED_CHECK_OUT",
        requestedCheckOutAt: "2026-10-03T19:00:00.000Z",
      }),
    ).toBe("PUNCH_OUTSIDE_DATE");
    expect(
      code({
        attendanceDate: DATE,
        correctionType: "LATE_ARRIVAL",
        requestedCheckInAt: "2026-10-02T04:00:00.000Z",
      }),
    ).toBe("PUNCH_OUTSIDE_DATE");
  });

  it("refuses a check-out at or before the check-in", () => {
    expect(
      code({
        attendanceDate: DATE,
        correctionType: "INCORRECT_TIME",
        requestedCheckInAt: OUT_AT,
        requestedCheckOutAt: IN_AT,
      }),
    ).toBe("CHECK_OUT_BEFORE_CHECK_IN");
    expect(
      code({
        attendanceDate: DATE,
        correctionType: "MISSED_CHECK_IN",
        requestedCheckInAt: IN_AT,
        requestedCheckOutAt: IN_AT,
      }),
    ).toBe("CHECK_OUT_BEFORE_CHECK_IN");
  });
});
