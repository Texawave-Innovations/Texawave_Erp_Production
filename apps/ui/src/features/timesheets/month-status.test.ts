import test from "node:test";
import assert from "node:assert/strict";
import { visibleMonthStatus } from "./month-status.js";

const today = "2026-11-23";
const on = (date: string, attendanceStatus: string | null) => ({
  date,
  attendanceStatus,
});

test("a holiday assigned to a future date is shown", () => {
  assert.equal(
    visibleMonthStatus(on("2026-11-26", "HOLIDAY"), today),
    "HOLIDAY",
  );
});

test("a future weekly off and approved leave are shown", () => {
  assert.equal(
    visibleMonthStatus(on("2026-11-29", "WEEKLY_OFF"), today),
    "WEEKLY_OFF",
  );
  assert.equal(
    visibleMonthStatus(on("2026-11-27", "ON_LEAVE"), today),
    "ON_LEAVE",
  );
});

test("a future working day has no verdict yet", () => {
  assert.equal(visibleMonthStatus(on("2026-11-24", "NOT_MARKED"), today), null);
  assert.equal(visibleMonthStatus(on("2026-11-24", "PRESENT"), today), null);
});

test("today and past days show their status as is", () => {
  assert.equal(
    visibleMonthStatus(on(today, "NOT_MARKED"), today),
    "NOT_MARKED",
  );
  assert.equal(visibleMonthStatus(on("2026-11-20", "ABSENT"), today), "ABSENT");
  assert.equal(visibleMonthStatus(on("2026-11-20", null), today), null);
});
