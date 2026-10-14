import { describe, expect, it } from "vitest";
import {
  istInstant,
  mapImportHeader,
  overlaps,
  parseImportDate,
  parseImportRows,
  parseImportTime,
  toExportRow,
} from "./attendance-csv.js";

const NOW = new Date("2026-10-11T12:00:00+05:30");

describe("attendance CSV — header", () => {
  it("maps the template headers", () => {
    const r = mapImportHeader([
      "Employee Code",
      "Date",
      "Check In",
      "Check Out",
    ]);
    expect(r.errors).toEqual([]);
    expect(r.index).toEqual({
      employeeCode: 0,
      date: 1,
      checkIn: 2,
      checkOut: 3,
    });
  });

  it("accepts common biometric aliases and ignores export-only columns", () => {
    const r = mapImportHeader([
      "Emp_Code",
      "Name",
      "Punch Date",
      "In Time",
      "Out-Time",
      "Status",
    ]);
    expect(r.errors).toEqual([]);
    expect(r.index).toEqual({
      employeeCode: 0,
      date: 2,
      checkIn: 3,
      checkOut: 4,
    });
  });

  it("reports unknown, duplicate and missing columns", () => {
    const r = mapImportHeader(["Employee Code", "Code", "Shoe Size", "Date"]);
    expect(r.errors).toEqual([
      'Column "Code" appears more than once',
      'Unknown column "Shoe Size"',
      'Missing required column "Check In"',
      'Missing required column "Check Out"',
    ]);
  });
});

describe("attendance CSV — values", () => {
  it("parses ISO and day-first dates, rejecting impossible ones", () => {
    expect(parseImportDate("2026-09-17")).toBe("2026-09-17");
    expect(parseImportDate("17-09-2026")).toBe("2026-09-17");
    expect(parseImportDate("7/9/2026")).toBe("2026-09-07");
    expect(parseImportDate("31-02-2026")).toBeNull();
    expect(parseImportDate("09/17/2026")).toBeNull();
    expect(parseImportDate("yesterday")).toBeNull();
  });

  it("parses 24-hour and AM/PM times", () => {
    expect(parseImportTime("09:05")).toBe(545);
    expect(parseImportTime("9:05:30")).toBe(545);
    expect(parseImportTime("6:30 PM")).toBe(1110);
    expect(parseImportTime("12:15 am")).toBe(15);
    expect(parseImportTime("24:00")).toBeNull();
    expect(parseImportTime("13:00 PM")).toBeNull();
    expect(parseImportTime("9.30")).toBeNull();
  });

  it("builds IST instants", () => {
    expect(istInstant("2026-09-17", 600).toISOString()).toBe(
      "2026-09-17T04:30:00.000Z",
    );
  });
});

describe("attendance CSV — rows", () => {
  const index = { employeeCode: 0, date: 1, checkIn: 2, checkOut: 3 };

  it("turns valid rows into punch pairs with file row numbers", () => {
    const r = parseImportRows(
      [["emp-1", "2026-09-17", "10:00", "18:30"]],
      index,
      NOW,
    );
    expect(r.errors).toEqual([]);
    expect(r.rows).toEqual([
      {
        row: 2,
        employeeCode: "EMP-1",
        date: "2026-09-17",
        checkInAt: new Date("2026-09-17T10:00:00+05:30"),
        checkOutAt: new Date("2026-09-17T18:30:00+05:30"),
      },
    ]);
  });

  it("reports missing and malformed cells per field", () => {
    const r = parseImportRows([["", "17/13/2026", "x", ""]], index, NOW);
    expect(r.rows).toEqual([]);
    expect(r.errors.map((e) => e.field)).toEqual([
      "Employee Code",
      "Date",
      "Check In",
      "Check Out",
    ]);
  });

  it("refuses check-out before check-in (no overnight pairs) and future punches", () => {
    const r = parseImportRows(
      [
        ["E1", "2026-09-17", "22:00", "06:00"],
        ["E1", "2026-10-11", "10:00", "18:00"],
      ],
      index,
      NOW,
    );
    expect(r.rows).toEqual([]);
    expect(r.errors[0]?.message).toMatch(/overnight/);
    expect(r.errors[1]?.message).toMatch(/future/);
  });

  it("refuses rows of one employee and day that overlap, but allows touching ones", () => {
    const r = parseImportRows(
      [
        ["E1", "2026-09-17", "10:00", "13:00"],
        ["E1", "2026-09-17", "13:00", "18:00"],
        ["E1", "2026-09-17", "17:00", "19:00"],
        ["E2", "2026-09-17", "10:00", "18:00"],
      ],
      index,
      NOW,
    );
    expect(r.errors).toEqual([
      {
        row: 4,
        field: "Check In",
        message: "Overlaps row 3 for the same employee and date",
      },
    ]);
    expect(r.rows.map((p) => p.row)).toEqual([2, 3, 5]);
  });

  it("strips the formula guard our export adds", () => {
    const r = parseImportRows(
      [["'=E1", "2026-09-17", "10:00", "18:00"]],
      index,
      NOW,
    );
    expect(r.rows[0]?.employeeCode).toBe("=E1");
  });
});

describe("attendance CSV — overlap and export", () => {
  const at = (h: number) => new Date(Date.UTC(2026, 8, 17, h));

  it("treats an open session as running to the end of time", () => {
    expect(
      overlaps(
        { checkInAt: at(4), checkOutAt: null },
        { checkInAt: at(10), checkOutAt: at(11) },
      ),
    ).toBe(true);
    expect(
      overlaps(
        { checkInAt: at(4), checkOutAt: at(6) },
        { checkInAt: at(6), checkOutAt: at(7) },
      ),
    ).toBe(false);
  });

  it("writes one export row with IST times and hours", () => {
    expect(
      toExportRow(
        { employeeCode: "E1", fullName: "Asha" },
        {
          attendanceDate: "2026-09-17",
          status: "PRESENT",
          workedMinutes: 480,
          overtimeMinutes: 30,
          shortfallMinutes: 0,
          sessions: [
            {
              checkInAt: new Date("2026-09-17T10:00:00+05:30"),
              checkOutAt: new Date("2026-09-17T18:30:00+05:30"),
            },
          ],
        },
      ),
    ).toEqual([
      "E1",
      "Asha",
      "2026-09-17",
      "Thu",
      "PRESENT",
      "10:00",
      "18:30",
      1,
      "8.00",
      "0.50",
      "0.00",
    ]);
  });
});
