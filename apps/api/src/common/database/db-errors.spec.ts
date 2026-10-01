import {
  ResourceConflictException,
  BusinessRuleViolationException,
} from "../exceptions/business.exception.js";
import { classifyDbError, translateDbError } from "./db-errors.js";

const prismaError = (code: string, meta: object, message = "x") =>
  Object.assign(new Error(message), { code, meta });

describe("classifyDbError", () => {
  it("reads a Prisma unique violation (P2002) with its columns", () => {
    expect(
      classifyDbError(
        prismaError("P2002", { target: ["organization_id", "employee_code"] }),
      ),
    ).toEqual({
      kind: "unique",
      columns: ["organization_id", "employee_code"],
    });
  });

  it("reads a Prisma unique violation whose target is an index name", () => {
    expect(
      classifyDbError(prismaError("P2002", { target: "holidays_date_key" })),
    ).toEqual({ kind: "unique", constraint: "holidays_date_key" });
  });

  it("reads a foreign-key violation (P2003)", () => {
    expect(
      classifyDbError(
        prismaError("P2003", { constraint: "employees_team_fkey" }),
      ),
    ).toEqual({ kind: "foreign_key", constraint: "employees_team_fkey" });
  });

  it.each([
    ["23505", "unique"],
    ["23P01", "exclusion"],
    ["23514", "check"],
    ["23503", "foreign_key"],
    ["23502", "not_null"],
  ])("reads raw-query SQLSTATE %s as %s", (sqlstate, kind) => {
    expect(
      classifyDbError(prismaError("P2010", { code: sqlstate })),
    ).toMatchObject({ kind });
  });

  it("extracts the constraint name from an ORM error message", () => {
    expect(
      classifyDbError(
        new Error(
          'conflicting key value violates exclusion constraint "shift_assignments_employee_no_overlap"',
        ),
      ),
    ).toEqual({
      kind: "exclusion",
      constraint: "shift_assignments_employee_no_overlap",
    });
    expect(
      classifyDbError(
        new Error(
          'new row for relation "x" violates check constraint "x_dates_check"',
        ),
      ),
    ).toEqual({ kind: "check", constraint: "x_dates_check" });
  });

  it("reads the debug-formatted message Prisma really produces (escaped quotes)", () => {
    // Captured from a real PrismaClientUnknownRequestError for an ORM create().
    const real = new Error(
      'Error occurred during query execution: ConnectorError(ConnectorError { user_facing_error: None, kind: QueryError(PostgresError { code: \\"23P01\\", message: \\"conflicting key value violates exclusion constraint \\"shift_assignments_employee_no_overlap\\"\\", severity: \\"ERROR\\" }) })',
    );
    expect(classifyDbError(real)).toEqual({
      kind: "exclusion",
      constraint: "shift_assignments_employee_no_overlap",
    });
    const check = new Error(
      'new row for relation \\"shifts\\" violates check constraint \\"shifts_overnight_consistency_check\\"',
    );
    expect(classifyDbError(check)).toEqual({
      kind: "check",
      constraint: "shifts_overnight_consistency_check",
    });
  });

  it.each([null, undefined, "boom", 42, new Error("plain"), {}])(
    "returns null for a non-constraint error (%s)",
    (error) => {
      expect(classifyDbError(error)).toBeNull();
    },
  );
});

describe("translateDbError", () => {
  const conflict = new ResourceConflictException("dup");
  const rule = new BusinessRuleViolationException("overlap", "OVERLAP");

  it("maps by constraint name", () => {
    const err = new Error('violates exclusion constraint "my_exclusion"');
    expect(translateDbError(err, { my_exclusion: rule })).toBe(rule);
  });

  it("maps a P2002 by comma-joined columns", () => {
    const err = prismaError("P2002", { target: ["organization_id", "code"] });
    expect(translateDbError(err, { "organization_id,code": conflict })).toBe(
      conflict,
    );
  });

  it("returns the original error when nothing matches", () => {
    const err = prismaError("P2002", { target: ["other"] });
    expect(translateDbError(err, { "organization_id,code": conflict })).toBe(
      err,
    );
  });

  it("returns a non-database error untouched", () => {
    const err = new Error("network");
    expect(translateDbError(err, { anything: conflict })).toBe(err);
  });
});
