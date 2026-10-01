import { formatEmployeeCode } from "./employee-code.js";
import {
  auditSnapshot,
  maskPhone,
  type EmployeeRow,
} from "./employee-mappers.js";

describe("formatEmployeeCode", () => {
  it.each([
    [1, "EMP-000001"],
    [42, "EMP-000042"],
    [999999, "EMP-999999"],
    [1000000, "EMP-1000000"], // grows past the padding instead of truncating
  ])("issues %i as %s", (n, expected) => {
    expect(formatEmployeeCode("EMP-", 6, n)).toBe(expected);
  });

  it("matches the database CHECK for every code it can produce", () => {
    const check = /^EMP-[0-9]{6,}$/;
    for (const n of [1, 9, 10, 99999, 123456, 7654321]) {
      expect(formatEmployeeCode("EMP-", 6, n)).toMatch(check);
    }
  });
});

describe("maskPhone", () => {
  it("keeps only the last two digits", () => {
    expect(maskPhone("+91 98765 43210")).toBe("**********10");
    expect(maskPhone("12345678")).toBe("******78");
  });
  it("handles empty and very short input", () => {
    expect(maskPhone(null)).toBeNull();
    expect(maskPhone("")).toBeNull();
    expect(maskPhone("7")).toBe("7");
  });
});

describe("auditSnapshot", () => {
  const row = {
    id: 1,
    employeeCode: "EMP-000001",
    fullName: "Asha",
    workEmail: "a@x.com",
    phone: "+91 98765 43210",
    userId: 7,
    status: "ACTIVE",
    teamId: 1,
    departmentId: null,
    designationId: 2,
    employmentTypeId: 3,
    workLocationId: null,
    reportsToId: null,
    dateOfJoining: new Date("2026-01-05T00:00:00Z"),
    dateOfExit: null,
    exitReason: "private reason",
    version: 4,
    // Fields that must never reach the trail:
    customFields: { secret: "x" },
    createdBy: 1,
  } as unknown as EmployeeRow;

  it("never contains the raw phone number or the exit reason", () => {
    const snap = auditSnapshot(row);
    const text = JSON.stringify(snap);
    expect(text).not.toContain("98765");
    expect(text).not.toContain("private reason");
    expect(snap.phone).toBe("**********10");
  });

  it("is an allow-list: unlisted columns are not carried over", () => {
    const keys = Object.keys(auditSnapshot(row));
    expect(keys).not.toContain("customFields");
    expect(keys).not.toContain("createdBy");
    expect(keys).not.toContain("exitReason");
    expect(keys).toEqual(
      expect.arrayContaining([
        "employeeCode",
        "status",
        "userId",
        "dateOfJoining",
        "version",
      ]),
    );
  });

  it("records dates as plain YYYY-MM-DD", () => {
    expect(auditSnapshot(row).dateOfJoining).toBe("2026-01-05");
    expect(auditSnapshot(row).dateOfExit).toBeNull();
  });
});
