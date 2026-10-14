import { describe, expect, it } from "vitest";
import { parseCsv } from "../../../common/csv/csv.js";
import {
  type ImportLookups,
  mapHeader,
  parseImportRows,
} from "./employee-csv.js";

const LOOKUPS: ImportLookups = {
  teams: new Map([["software", 1]]),
  departments: new Map([["engineering", 2]]),
  designations: new Map([["software engineer", 3]]),
  employmentTypes: new Map([["permanent", 4]]),
  workLocations: new Map([["omr", 5]]),
  employeeIdByCode: new Map([["EMP-000001", 10]]),
  takenEmails: new Set(["taken@texawave.com"]),
  takenPhones: new Set(["9840012345"]),
};

const HEADER =
  "Full Name,Work Email,Phone,Team,Designation,Employment Type,Date of Joining,Reports To,Work Location";

function parse(csv: string) {
  const [header, ...rows] = parseCsv(csv);
  const mapped = mapHeader(header!);
  expect(mapped.errors).toEqual([]);
  return parseImportRows(rows, mapped.index, LOOKUPS);
}

describe("mapHeader", () => {
  it("accepts the exported read-only columns and reports unknown or missing ones", () => {
    expect(
      mapHeader(["Employee Code", "Full Name", "Status", "Nickname"]).errors,
    ).toEqual([
      'Unknown column "Nickname"',
      'Missing required column "team"',
      'Missing required column "designation"',
      'Missing required column "employment type"',
      'Missing required column "date of joining"',
    ]);
  });
});

describe("parseImportRows", () => {
  it("resolves master names case-insensitively and the manager by code", () => {
    const result = parse(
      `${HEADER}\nAsha Verma,Asha@Texawave.com,98400 99999,SOFTWARE,Software Engineer,permanent,2026-10-01,emp-000001,OMR`,
    );
    expect(result.errors).toEqual([]);
    expect(result.rows.map((r) => r.row)).toEqual([2]);
    expect(result.rows[0]?.input).toMatchObject({
      fullName: "Asha Verma",
      workEmail: "asha@texawave.com",
      teamId: 1,
      designationId: 3,
      employmentTypeId: 4,
      reportsToId: 10,
      workLocationId: 5,
      dateOfJoining: "2026-10-01",
    });
  });

  it("reports every problem against its file row", () => {
    const result = parse(
      [
        HEADER,
        ",x@t.com,,Software,Software Engineer,Permanent,2026-10-01,,",
        "B,,,Hardware,Software Engineer,Permanent,01/10/2026,EMP-999999,",
      ].join("\n"),
    );
    expect(result.rows).toEqual([]);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        { row: 2, field: "fullName", message: "fullName is required" },
        {
          row: 3,
          field: "team",
          message: 'Team "Hardware" does not exist or is inactive',
        },
        {
          row: 3,
          field: "reportsTo",
          message: 'No employee has the code "EMP-999999"',
        },
        expect.objectContaining({ row: 3, field: "dateOfJoining" }),
      ]),
    );
  });

  it("catches duplicate e-mails and phones within the file and against existing staff", () => {
    const row = (name: string, email: string, phone: string) =>
      `${name},${email},${phone},Software,Software Engineer,Permanent,2026-10-01,,`;
    const result = parse(
      [
        HEADER,
        row("A", "a@t.com", "9000000001"),
        row("B", "A@t.com", "+91-9000000002"),
        row("C", "taken@texawave.com", "98400-12345"),
        row("D", "d@t.com", "9000000001"),
      ].join("\n"),
    );
    expect(result.errors).toEqual([
      { row: 3, field: "workEmail", message: "Same work e-mail as row 2" },
      {
        row: 4,
        field: "workEmail",
        message: "Another employee already has this work e-mail address",
      },
      {
        row: 4,
        field: "phone",
        message: "Another employee already has this phone number",
      },
      { row: 5, field: "phone", message: "Same phone number as row 2" },
    ]);
    expect(result.rows.map((r) => r.row)).toEqual([2]);
  });

  it("strips the apostrophe our export adds to formula-like text", () => {
    const result = parse(
      `${HEADER}\nA,a@t.com,'+91 90000 00009,Software,Software Engineer,Permanent,2026-10-01,,`,
    );
    expect(result.rows[0]?.input.phone).toBe("+91 90000 00009");
  });
});
