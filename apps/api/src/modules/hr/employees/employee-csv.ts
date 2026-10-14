import { plainToInstance } from "class-transformer";
import { validateSync, type ValidationError } from "class-validator";
import { CreateEmployeeDto } from "./dto/create-employee.dto.js";
import type { EmployeeDetail } from "./employee-mappers.js";
import type { NewEmployee } from "./employees.repository.js";

/** Most rows one import may carry (one transaction holds them all). */
export const MAX_IMPORT_ROWS = 500;
/** Most rows one export returns; narrow the filters beyond this. */
export const MAX_EXPORT_ROWS = 10_000;

/** Export columns. The import reads the same headers, so an exported file
 * (minus the read-only columns) can be edited and imported again. */
export const EXPORT_HEADERS = [
  "Employee Code",
  "Full Name",
  "Work Email",
  "Phone",
  "Team",
  "Department",
  "Designation",
  "Employment Type",
  "Work Location",
  "Reports To",
  "Date of Joining",
  "Probation End Date",
  "Confirmation Date",
  "Referred By",
  "Work Domain",
  "Status",
  "Onboarding Status",
  "Review Status",
  "Date of Exit",
] as const;

export function toExportRow(e: EmployeeDetail): unknown[] {
  return [
    e.employeeCode,
    e.fullName,
    e.workEmail,
    e.phone,
    e.team.name,
    e.department?.name,
    e.designation.name,
    e.employmentType.name,
    e.workLocation?.name,
    e.reportsTo?.employeeCode,
    e.dateOfJoining,
    e.probationEndDate,
    e.confirmationDate,
    e.referredBy,
    e.workDomain,
    e.status,
    e.onboardingStatus,
    e.onboardingReviewStatus,
    e.dateOfExit,
  ];
}

/** Import columns: header → how it maps. Names are matched to the active
 * masters case-insensitively; "Reports To" is an employee code. */
const IMPORT_COLUMNS = {
  "full name": "fullName",
  "work email": "workEmail",
  phone: "phone",
  team: "team",
  department: "department",
  designation: "designation",
  "employment type": "employmentType",
  "work location": "workLocation",
  "reports to": "reportsTo",
  "date of joining": "dateOfJoining",
  "probation end date": "probationEndDate",
  "confirmation date": "confirmationDate",
  "referred by": "referredBy",
  "work domain": "workDomain",
} as const;
type ImportField = (typeof IMPORT_COLUMNS)[keyof typeof IMPORT_COLUMNS];
const REQUIRED_COLUMNS: ImportField[] = [
  "fullName",
  "team",
  "designation",
  "employmentType",
  "dateOfJoining",
];
/** Exported-only columns, accepted in the header and ignored. */
const IGNORED_COLUMNS = new Set([
  "employee code",
  "status",
  "onboarding status",
  "review status",
  "date of exit",
]);

export interface ImportLookups {
  teams: Map<string, number>;
  departments: Map<string, number>;
  designations: Map<string, number>;
  employmentTypes: Map<string, number>;
  workLocations: Map<string, number>;
  employeeIdByCode: Map<string, number>;
  takenEmails: Set<string>;
  takenPhones: Set<string>;
}

export interface ImportRowError {
  row: number;
  field?: string;
  message: string;
}

export interface ParsedImport {
  rows: Array<{ row: number; input: NewEmployee }>;
  errors: ImportRowError[];
}

/** A leading `'` is how our export (and Excel) protects formula-like text;
 * strip it again so `'+91 98…` imports as `+91 98…`. */
function clean(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim().replace(/^'(?=[=+\-@])/, "");
  return trimmed === "" ? undefined : trimmed;
}

function flatten(errors: ValidationError[]): string[] {
  return errors.flatMap((e) => [
    ...Object.values(e.constraints ?? {}),
    ...flatten(e.children ?? []),
  ]);
}

/** Validates the header row; returns the column index of each field. */
export function mapHeader(header: string[]): {
  index: Partial<Record<ImportField, number>>;
  errors: string[];
} {
  const index: Partial<Record<ImportField, number>> = {};
  const errors: string[] = [];
  header.forEach((raw, i) => {
    const key = raw.trim().toLowerCase();
    if (key === "" || IGNORED_COLUMNS.has(key)) return;
    const field = (IMPORT_COLUMNS as Record<string, ImportField>)[key];
    if (!field) {
      errors.push(`Unknown column "${raw.trim()}"`);
      return;
    }
    if (index[field] !== undefined) {
      errors.push(`Column "${raw.trim()}" appears more than once`);
      return;
    }
    index[field] = i;
  });
  for (const field of REQUIRED_COLUMNS) {
    if (index[field] === undefined) {
      const name = Object.entries(IMPORT_COLUMNS).find(
        ([, f]) => f === field,
      )?.[0];
      errors.push(`Missing required column "${name}"`);
    }
  }
  return { index, errors };
}

/**
 * Turns data rows into create inputs. Every problem is reported against its
 * file row (the header is row 1), and duplicate e-mails/phones are caught
 * here — within the file and against existing employees — because a database
 * unique violation would abort the whole import transaction.
 */
export function parseImportRows(
  dataRows: string[][],
  index: Partial<Record<ImportField, number>>,
  lookups: ImportLookups,
): ParsedImport {
  const result: ParsedImport = { rows: [], errors: [] };
  const seenEmails = new Map<string, number>();
  const seenPhones = new Map<string, number>();

  dataRows.forEach((cells, i) => {
    const row = i + 2;
    const get = (field: ImportField) =>
      index[field] === undefined ? undefined : clean(cells[index[field]]);
    const rowErrors: ImportRowError[] = [];
    const resolve = (
      field: ImportField,
      map: Map<string, number>,
      label: string,
    ): number | undefined => {
      const name = get(field);
      if (name === undefined) return undefined;
      const id = map.get(name.toLowerCase());
      if (id === undefined) {
        rowErrors.push({
          row,
          field,
          message: `${label} "${name}" does not exist or is inactive`,
        });
      }
      return id;
    };

    const teamId = resolve("team", lookups.teams, "Team");
    const departmentId = resolve(
      "department",
      lookups.departments,
      "Department",
    );
    const designationId = resolve(
      "designation",
      lookups.designations,
      "Designation",
    );
    const employmentTypeId = resolve(
      "employmentType",
      lookups.employmentTypes,
      "Employment type",
    );
    const workLocationId = resolve(
      "workLocation",
      lookups.workLocations,
      "Work location",
    );
    const reportsToCode = get("reportsTo");
    let reportsToId: number | undefined;
    if (reportsToCode !== undefined) {
      reportsToId = lookups.employeeIdByCode.get(reportsToCode.toUpperCase());
      if (reportsToId === undefined) {
        rowErrors.push({
          row,
          field: "reportsTo",
          message: `No employee has the code "${reportsToCode}"`,
        });
      }
    }

    const plain = {
      fullName: get("fullName"),
      workEmail: get("workEmail"),
      phone: get("phone"),
      teamId,
      departmentId,
      designationId,
      employmentTypeId,
      workLocationId,
      reportsToId,
      dateOfJoining: get("dateOfJoining"),
      probationEndDate: get("probationEndDate"),
      confirmationDate: get("confirmationDate"),
      referredBy: get("referredBy"),
      workDomain: get("workDomain"),
    };
    const dto = plainToInstance(CreateEmployeeDto, plain);
    // Unresolved references were reported above; don't repeat them as
    // "must be an integer" from the DTO rules.
    const unresolved = new Set(rowErrors.map((e) => `${e.field}Id`));
    for (const error of validateSync(dto, { whitelist: true })) {
      if (unresolved.has(error.property)) continue;
      const field = error.property.endsWith("Id")
        ? error.property.slice(0, -2)
        : error.property;
      if (plain[error.property as keyof typeof plain] === undefined) {
        rowErrors.push({ row, field, message: `${field} is required` });
        continue;
      }
      for (const message of flatten([error])) {
        rowErrors.push({ row, field, message });
      }
    }

    if (dto.workEmail) {
      const email = dto.workEmail.toLowerCase();
      const firstRow = seenEmails.get(email);
      if (lookups.takenEmails.has(email)) {
        rowErrors.push({
          row,
          field: "workEmail",
          message: "Another employee already has this work e-mail address",
        });
      } else if (firstRow !== undefined) {
        rowErrors.push({
          row,
          field: "workEmail",
          message: `Same work e-mail as row ${firstRow}`,
        });
      } else {
        seenEmails.set(email, row);
      }
    }
    if (dto.phone) {
      const digits = dto.phone.replace(/\D/g, "");
      const firstRow = seenPhones.get(digits);
      if (lookups.takenPhones.has(digits)) {
        rowErrors.push({
          row,
          field: "phone",
          message: "Another employee already has this phone number",
        });
      } else if (firstRow !== undefined) {
        rowErrors.push({
          row,
          field: "phone",
          message: `Same phone number as row ${firstRow}`,
        });
      } else {
        seenPhones.set(digits, row);
      }
    }

    if (rowErrors.length > 0) {
      result.errors.push(...rowErrors);
      return;
    }
    result.rows.push({
      row,
      input: {
        fullName: dto.fullName,
        workEmail: dto.workEmail,
        phone: dto.phone,
        teamId: dto.teamId,
        departmentId: dto.departmentId,
        designationId: dto.designationId,
        employmentTypeId: dto.employmentTypeId,
        workLocationId: dto.workLocationId,
        reportsToId: dto.reportsToId,
        dateOfJoining: dto.dateOfJoining,
        probationEndDate: dto.probationEndDate,
        confirmationDate: dto.confirmationDate,
        referredBy: dto.referredBy,
        workDomain: dto.workDomain,
      },
    });
  });
  return result;
}
