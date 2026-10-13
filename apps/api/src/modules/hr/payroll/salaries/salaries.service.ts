import { Injectable } from "@nestjs/common";
import { parseDateOnly } from "../../../../common/dates/date-only.js";
import { PaginatedResponseDto } from "../../../../common/dto/paginated-response.dto.js";
import {
  BusinessRuleConflictException,
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from "../../../../common/exceptions/business.exception.js";
import { TeamContextService } from "../../../../platform/tenancy/team-context.service.js";
import { TenantContextService } from "../../../../platform/tenancy/tenant-context.service.js";
import type {
  CreateSalaryDto,
  QuerySalaryDto,
  SalaryLineDto,
  UpdateSalaryDto,
} from "./dto/salary.dto.js";
import { SalaryComponentsService } from "../salary-components/salary-components.service.js";
import { PayrollSettingsService } from "../settings/payroll-settings.service.js";
import { splitGross } from "../settings/payroll-settings.rules.js";
import {
  SalariesRepository,
  type SalaryLine,
  type SalaryRow,
} from "./salaries.repository.js";

const READ = "hr.salary.read";
const WRITE = "hr.salary.write";

/** Legacy request fields → the system component they set. */
const LEGACY_FIELDS = [
  ["basic", "BASIC"],
  ["hra", "HRA"],
  ["conveyance", "CONVEYANCE"],
  ["otherAllowance", "OTHER_ALLOWANCE"],
  ["specialAllowance", "SPECIAL_ALLOWANCE"],
] as const;

function round2(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

function earningsTotal(lines: readonly SalaryLine[]): number {
  return round2(
    lines
      .filter((l) => l.kind === "EARNING")
      .reduce((s, l) => s + l.monthlyAmount, 0),
  );
}

@Injectable()
export class SalariesService {
  constructor(
    private readonly repository: SalariesRepository,
    private readonly tenantContext: TenantContextService,
    private readonly teamContext: TeamContextService,
    private readonly settings: PayrollSettingsService,
    private readonly components: SalaryComponentsService,
  ) {}

  async create(dto: CreateSalaryDto) {
    const orgScope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();
    const teamScope = await this.teamContext.resolveScope(WRITE);

    const from = parseDateOnly(dto.effectiveFrom);
    const to = dto.effectiveTo ? parseDateOnly(dto.effectiveTo) : null;

    if (to && to < from) {
      throw new BusinessRuleViolationException(
        "Effective to date cannot precede effective from date",
        "SALARY_DATES_INVALID",
      );
    }

    const clash = await this.repository.findOverlapping(
      orgScope,
      dto.employeeId,
      from,
      to,
    );
    if (clash) {
      throw new BusinessRuleConflictException(
        "Salary structure overlaps an existing salary record for this employee",
        "SALARY_OVERLAP",
      );
    }

    if (dto.revisionLetterId) {
      const letter = await this.repository.findRevisionLetter(
        orgScope,
        dto.revisionLetterId,
        dto.employeeId,
      );
      if (!letter) {
        throw new BusinessRuleViolationException(
          "The revision letter does not exist or belongs to another employee",
          "REVISION_LETTER_MISMATCH",
        );
      }
    }

    const lines = await this.resolveLines(dto);
    // The repository re-reads the employee through the caller's write scope
    // (404 outside it; `.own` may not set anyone's salary).
    return this.repository.create(
      teamScope,
      {
        employeeId: dto.employeeId,
        effectiveFrom: from,
        effectiveTo: to,
        arrearsSalary: dto.arrearsSalary ?? 0,
        salaryTemplateId: dto.salaryTemplateId ?? null,
        revisionLetterId: dto.revisionLetterId ?? null,
      },
      lines,
      userId,
    );
  }

  /**
   * The structure's lines (Docs/PAYROLL_AND_COMPLIANCE.md §3.0), from — in
   * order of precedence — explicit components, a template, the legacy
   * basic/hra fields, or the gross alone split by the payroll settings.
   * A gross given alongside must equal the earning lines' total.
   */
  private async resolveLines(dto: CreateSalaryDto): Promise<SalaryLine[]> {
    let lines: SalaryLine[];
    if (dto.components) {
      lines = await this.linesFrom(dto.components);
    } else if (dto.salaryTemplateId !== undefined) {
      if (dto.grossMonthly === undefined) {
        throw new BusinessRuleViolationException(
          "A template needs the gross monthly salary to apply",
          "SALARY_COMPONENTS_INCOMPLETE",
        );
      }
      lines = await this.components.applyTemplate(
        dto.salaryTemplateId,
        dto.grossMonthly,
      );
    } else if (dto.basic !== undefined && dto.hra !== undefined) {
      lines = await this.linesFrom(
        LEGACY_FIELDS.flatMap(([field, code]) => {
          const amount = dto[field];
          return amount !== undefined &&
            (amount > 0 || code === "BASIC" || code === "HRA")
            ? [{ code, monthlyAmount: amount }]
            : [];
        }),
      );
    } else if (
      dto.basic !== undefined ||
      dto.hra !== undefined ||
      dto.conveyance !== undefined ||
      dto.otherAllowance !== undefined
    ) {
      throw new BusinessRuleViolationException(
        "Give basic and hra together, or give only grossMonthly to split it automatically",
        "SALARY_COMPONENTS_INCOMPLETE",
      );
    } else if (dto.grossMonthly === undefined) {
      throw new BusinessRuleViolationException(
        "Give components, a template with grossMonthly, basic and hra, or grossMonthly",
        "SALARY_COMPONENTS_INCOMPLETE",
      );
    } else {
      const special = dto.specialAllowance ?? 0;
      const splitBase = dto.grossMonthly - special;
      if (splitBase <= 0) {
        throw new BusinessRuleViolationException(
          "Special allowance cannot be the whole gross salary when splitting automatically",
          "SALARY_SPLIT_INVALID",
        );
      }
      const parts = splitGross(splitBase, await this.settings.rules());
      lines = await this.linesFrom([
        { code: "BASIC", monthlyAmount: parts.basic },
        { code: "HRA", monthlyAmount: parts.hra },
        ...(parts.conveyance > 0
          ? [{ code: "CONVEYANCE", monthlyAmount: parts.conveyance }]
          : []),
        ...(parts.otherAllowance > 0
          ? [{ code: "OTHER_ALLOWANCE", monthlyAmount: parts.otherAllowance }]
          : []),
        ...(special > 0
          ? [{ code: "SPECIAL_ALLOWANCE", monthlyAmount: special }]
          : []),
      ]);
    }

    const gross = earningsTotal(lines);
    if (gross <= 0) {
      throw new BusinessRuleViolationException(
        "A salary structure needs at least one earning above zero",
        "SALARY_COMPONENTS_INCOMPLETE",
      );
    }
    if (
      dto.grossMonthly !== undefined &&
      Math.abs(gross - dto.grossMonthly) > 0.01
    ) {
      throw new BusinessRuleViolationException(
        `The earning lines add up to ${gross}, not the gross ${dto.grossMonthly}`,
        "SALARY_GROSS_MISMATCH",
      );
    }
    return lines;
  }

  /** Lines over the active component master (by id or code). */
  private async linesFrom(
    given: Array<Pick<SalaryLineDto, "componentId" | "code" | "monthlyAmount">>,
  ): Promise<SalaryLine[]> {
    const components = await this.components.resolveComponents(given);
    return given.map((g, i) => {
      const c = components[i]!;
      return {
        componentId: c.id,
        code: c.code,
        kind: c.kind === "DEDUCTION" ? "DEDUCTION" : "EARNING",
        monthlyAmount: round2(g.monthlyAmount),
      };
    });
  }

  /**
   * Payslips of a finalized period were calculated from this structure, so
   * its recurring amounts cannot change, and it cannot be closed before the
   * end of the last finalized period it covers. A pay change is a new
   * structure from the next period. One-time arrears stay editable: they are
   * paid by the next finalized period.
   */
  private async assertNotLockedByPayroll(
    current: { effectiveFrom: Date; effectiveTo: Date | null },
    amountsChanged: boolean,
    dto: UpdateSalaryDto,
    newTo: Date | null,
  ) {
    if (!amountsChanged && dto.effectiveTo === undefined) return;

    const finalized = await this.repository.findFinalizedPeriodsOverlapping(
      this.tenantContext.getOrgScope(),
      current.effectiveFrom,
      current.effectiveTo,
    );
    const latest = finalized[0];
    if (!latest) return;
    const label = `${latest.year}-${String(latest.month).padStart(2, "0")}`;
    if (amountsChanged) {
      throw new BusinessRuleViolationException(
        `Payroll for ${label} is finalized with this salary structure; create a new structure effective from the next period instead`,
        "SALARY_LOCKED_BY_FINALIZED_PAYROLL",
      );
    }
    if (newTo !== null && newTo < latest.periodEnd) {
      throw new BusinessRuleViolationException(
        `This structure cannot end before ${latest.periodEnd.toISOString().slice(0, 10)}, the end of finalized payroll ${label}`,
        "SALARY_LOCKED_BY_FINALIZED_PAYROLL",
      );
    }
  }

  async findAll(query: QuerySalaryDto) {
    const scope = await this.teamContext.resolveScope(READ);
    const { items, total } = await this.repository.findMany(
      scope,
      query,
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  async findOne(id: number) {
    const scope = await this.teamContext.resolveScope(READ);
    const row = await this.repository.findById(scope, id);
    if (!row) throw new ResourceNotFoundException("Salary structure", id);
    return row;
  }

  async findApplicableOn(employeeId: number, dateStr?: string) {
    const scope = await this.teamContext.resolveScope(READ);
    const date = dateStr ? parseDateOnly(dateStr) : new Date();
    const row = await this.repository.findApplicableOn(scope, employeeId, date);
    if (!row) {
      throw new ResourceNotFoundException(
        "Applicable salary structure for employee",
        employeeId,
      );
    }
    return row;
  }

  async update(id: number, dto: UpdateSalaryDto) {
    const orgScope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();
    const writeScope = await this.teamContext.resolveScope(WRITE);
    const current = await this.repository.findById(writeScope, id);
    if (!current) throw new ResourceNotFoundException("Salary structure", id);

    let to = current.effectiveTo;
    if (dto.effectiveTo !== undefined) {
      to = dto.effectiveTo ? parseDateOnly(dto.effectiveTo) : null;
      if (to && to < current.effectiveFrom) {
        throw new BusinessRuleViolationException(
          "Effective to date cannot precede effective from date",
          "SALARY_DATES_INVALID",
        );
      }
      const clash = await this.repository.findOverlapping(
        orgScope,
        current.employeeId,
        current.effectiveFrom,
        to,
        id,
      );
      if (clash) {
        throw new BusinessRuleConflictException(
          "Salary structure overlaps an existing salary record for this employee",
          "SALARY_OVERLAP",
        );
      }
    }

    const lines = await this.updatedLines(current, dto);
    await this.assertNotLockedByPayroll(current, lines !== undefined, dto, to);

    return this.repository.update(
      writeScope,
      id,
      {
        effectiveTo: dto.effectiveTo !== undefined ? to : undefined,
        arrearsSalary: dto.arrearsSalary,
      },
      lines,
      userId,
    );
  }

  /** The new lines, or undefined when no amount changes: `components`
   * replaces them all; a legacy field changes its system line. */
  private async updatedLines(
    current: SalaryRow,
    dto: UpdateSalaryDto,
  ): Promise<SalaryLine[] | undefined> {
    if (dto.components) {
      const lines = await this.linesFrom(dto.components);
      if (earningsTotal(lines) <= 0) {
        throw new BusinessRuleViolationException(
          "A salary structure needs at least one earning above zero",
          "SALARY_COMPONENTS_INCOMPLETE",
        );
      }
      return lines;
    }
    const changed = LEGACY_FIELDS.filter(([field]) => dto[field] !== undefined);
    if (changed.length === 0) return undefined;

    const byCode = new Map<string, { code: string; monthlyAmount: number }>(
      current.components.map((c) => [
        c.component.code,
        { code: c.component.code, monthlyAmount: Number(c.monthlyAmount) },
      ]),
    );
    for (const [field, code] of changed) {
      byCode.set(code, { code, monthlyAmount: dto[field] as number });
    }
    return this.linesFrom([...byCode.values()]);
  }
}
