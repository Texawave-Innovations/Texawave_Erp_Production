import test from "node:test";
import assert from "node:assert/strict";
import {
  buildWeekGrid,
  cellStateLabel,
  isOpenable,
  shiftDate,
  weekDates,
  weekStartOf,
} from "./week-grid.js";
import type { ReviewDaySummary } from "./types.js";

const day = (over: Partial<ReviewDaySummary> = {}): ReviewDaySummary => ({
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
  totalMinutes: 60,
  taskMinutes: 60,
  customMinutes: 0,
  rowCount: 1,
  needsAttention: false,
  native: true,
  ...over,
});

test("weekStartOf gives the Monday of the ISO week, for every weekday and over a month end", () => {
  // 16 Nov 2026 is a Monday
  for (const d of [
    "2026-11-16",
    "2026-11-17",
    "2026-11-19",
    "2026-11-21",
    "2026-11-22", // Sunday belongs to the week that started on the 16th
  ]) {
    assert.equal(weekStartOf(d), "2026-11-16", d);
  }
  assert.equal(weekStartOf("2026-11-23"), "2026-11-23");
  // across a month and a year boundary
  assert.equal(weekStartOf("2026-12-01"), "2026-11-30");
  assert.equal(weekStartOf("2027-01-01"), "2026-12-28");
});

test("weekDates is seven days, Monday first, and shiftDate moves by whole days", () => {
  assert.deepEqual(weekDates("2026-11-16"), [
    "2026-11-16",
    "2026-11-17",
    "2026-11-18",
    "2026-11-19",
    "2026-11-20",
    "2026-11-21",
    "2026-11-22",
  ]);
  assert.equal(shiftDate("2026-11-30", 1), "2026-12-01");
  assert.equal(shiftDate("2026-03-01", -1), "2026-02-28");
  assert.equal(shiftDate("2026-11-16", -7), "2026-11-09");
});

test("buildWeekGrid puts each employee on one row and each day with work in its column", () => {
  const grid = buildWeekGrid("2026-11-16", [
    day({ date: "2026-11-16", totalMinutes: 120 }),
    day({ date: "2026-11-18", totalMinutes: 90 }),
    day({
      employee: { id: 2, code: "E2", name: "Ben", team: "Software" },
      date: "2026-11-16",
      totalMinutes: 30,
    }),
  ]);
  assert.equal(grid.rows.length, 2);
  assert.deepEqual(
    grid.rows.map((r) => [r.employee.name, r.totalMinutes, r.dayCount]),
    [
      ["Asha", 210, 2],
      ["Ben", 30, 1],
    ],
  );
  assert.equal(grid.rows[0]!.cells["2026-11-16"]?.totalMinutes, 120);
  // a day with no work has no cell: nothing is invented
  assert.equal(grid.rows[0]!.cells["2026-11-17"], undefined);
});

test("column and week totals add up, and every date of the week is a column even when empty", () => {
  const grid = buildWeekGrid("2026-11-16", [
    day({ date: "2026-11-16", totalMinutes: 120 }),
    day({
      employee: { id: 2, code: "E2", name: "Ben", team: "Software" },
      date: "2026-11-16",
      totalMinutes: 30,
    }),
    day({ date: "2026-11-18", totalMinutes: 90 }),
  ]);
  assert.equal(grid.dates.length, 7);
  assert.equal(grid.dayTotals["2026-11-16"], 150);
  assert.equal(grid.dayTotals["2026-11-17"], 0);
  assert.equal(grid.dayTotals["2026-11-18"], 90);
  assert.equal(grid.weekTotalMinutes, 240);
});

test("days outside the week are ignored", () => {
  const grid = buildWeekGrid("2026-11-16", [
    day({ date: "2026-11-15", totalMinutes: 500 }), // the Sunday before
    day({ date: "2026-11-23", totalMinutes: 500 }), // the Monday after
    day({ date: "2026-11-22", totalMinutes: 45 }), // this week's Sunday
  ]);
  assert.equal(grid.weekTotalMinutes, 45);
  assert.equal(grid.rows.length, 1);
});

test("state counts and days that need a look are counted over the whole grid", () => {
  const grid = buildWeekGrid("2026-11-16", [
    day({ date: "2026-11-16", status: "APPROVED" }),
    day({ date: "2026-11-17", status: "SUBMITTED", stage: "HR" }),
    day({ date: "2026-11-18", status: "SUBMITTED", stage: "MANAGER" }),
    day({ date: "2026-11-19", status: "REJECTED", needsAttention: true }),
    day({ date: "2026-11-20", status: "DRAFT" }),
  ]);
  assert.deepEqual(grid.stateCounts, {
    DRAFT: 1,
    SUBMITTED: 2,
    APPROVED: 1,
    REJECTED: 1,
  });
  assert.equal(grid.needsAttentionDays, 1);
});

test("employees are listed in name order, whatever order the API sent", () => {
  const grid = buildWeekGrid("2026-11-16", [
    day({ employee: { id: 3, code: "E3", name: "Zed", team: "T" } }),
    day({ employee: { id: 1, code: "E1", name: "Asha", team: "T" } }),
    day({ employee: { id: 2, code: "E2", name: "Mira", team: "T" } }),
  ]);
  assert.deepEqual(
    grid.rows.map((r) => r.employee.name),
    ["Asha", "Mira", "Zed"],
  );
});

test("an empty week is an empty grid, not an error", () => {
  const grid = buildWeekGrid("2026-11-16", []);
  assert.equal(grid.rows.length, 0);
  assert.equal(grid.weekTotalMinutes, 0);
  assert.equal(grid.dates.length, 7);
});

test("a cell says who a submitted day is waiting for, and only submitted days open", () => {
  assert.equal(cellStateLabel(day({ status: "DRAFT" })), "Draft");
  assert.equal(
    cellStateLabel(day({ status: "SUBMITTED", stage: "MANAGER" })),
    "Waiting for manager",
  );
  assert.equal(
    cellStateLabel(day({ status: "SUBMITTED", stage: "HR" })),
    "Waiting for HR",
  );
  assert.equal(cellStateLabel(day({ status: "APPROVED" })), "Approved");
  assert.equal(cellStateLabel(day({ status: "REJECTED" })), "Returned");
  assert.equal(isOpenable(day({ status: "DRAFT" })), false);
  for (const status of ["SUBMITTED", "APPROVED", "REJECTED"] as const) {
    assert.equal(isOpenable(day({ status })), true, status);
  }
});
