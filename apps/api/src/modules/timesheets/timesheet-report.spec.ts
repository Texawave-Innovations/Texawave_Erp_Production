import { describe, expect, it } from "vitest";
import {
  buildEmployeeReport,
  dayReportRow,
  employeeReportRow,
  hours,
} from "./timesheet-report.js";
import type { DaySummary } from "./timesheet-review-views.js";

const day = (over: Partial<DaySummary> = {}): DaySummary => ({
  employee: { id: 1, code: "E1", name: "Asha", team: "Software" },
  date: "2026-11-16",
  status: "DRAFT",
  stage: null,
  approvalLevels: 2,
  approverBasis: null,
  submittedAt: null,
  firstApprovedAt: null,
  firstApprovalNote: null,
  decidedAt: null,
  decisionNote: null,
  totalMinutes: 120,
  taskMinutes: 90,
  customMinutes: 30,
  rowCount: 2,
  needsAttention: false,
  native: true,
  ...over,
});

describe("buildEmployeeReport", () => {
  it("adds up each employee's days, hours and review states", () => {
    const lines = buildEmployeeReport([
      day({ status: "APPROVED" }),
      day({ date: "2026-11-17", status: "SUBMITTED", stage: "HR" }),
      day({ date: "2026-11-18", status: "REJECTED" }),
      day({ date: "2026-11-19", status: "DRAFT" }),
    ]);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      daysRecorded: 4,
      taskMinutes: 360,
      customMinutes: 120,
      totalMinutes: 480,
      approvedDays: 1,
      submittedDays: 1,
      returnedDays: 1,
      notSubmittedDays: 1,
    });
  });

  it("never counts imported legacy drafts as not submitted", () => {
    const [line] = buildEmployeeReport([day({ native: false })]);
    expect(line?.notSubmittedDays).toBe(0);
    expect(line?.daysRecorded).toBe(1); // still recorded work
  });

  it("counts days that need a look", () => {
    const [line] = buildEmployeeReport([
      day({ needsAttention: true }),
      day({ date: "2026-11-17" }),
    ]);
    expect(line?.needsAttentionDays).toBe(1);
  });

  it("keeps employees apart and sorts them by name", () => {
    const lines = buildEmployeeReport([
      day({ employee: { id: 2, code: "E2", name: "Zed", team: "T" } }),
      day({ employee: { id: 1, code: "E1", name: "Asha", team: "T" } }),
      day({ employee: { id: 2, code: "E2", name: "Zed", team: "T" } }),
    ]);
    expect(lines.map((l) => [l.employee.name, l.daysRecorded])).toEqual([
      ["Asha", 1],
      ["Zed", 2],
    ]);
  });

  it("is empty for no days", () => {
    expect(buildEmployeeReport([])).toEqual([]);
  });
});

describe("csv rows", () => {
  it("hours are decimals a spreadsheet can add", () => {
    expect(hours(135)).toBe(2.25);
    expect(hours(0)).toBe(0);
    expect(hours(50)).toBe(0.83);
  });

  it("an employee line becomes a row in header order", () => {
    const [line] = buildEmployeeReport([day({ status: "APPROVED" })]);
    expect(employeeReportRow(line!)).toEqual([
      "E1",
      "Asha",
      "Software",
      1,
      1.5,
      0.5,
      2,
      0,
      0,
      1,
      0,
      0,
    ]);
  });

  it("a day row says what it is waiting for in words", () => {
    expect(
      dayReportRow(day({ status: "SUBMITTED", stage: "MANAGER" }))[5],
    ).toBe("Manager");
    expect(dayReportRow(day({ status: "SUBMITTED", stage: "HR" }))[5]).toBe(
      "HR",
    );
    expect(dayReportRow(day({ status: "APPROVED" }))[4]).toBe("Approved");
    expect(dayReportRow(day({ status: "REJECTED" }))[4]).toBe("Returned");
  });
});
