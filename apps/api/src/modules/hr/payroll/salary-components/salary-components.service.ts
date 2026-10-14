import { Injectable } from "@nestjs/common";
import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from "../../../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../../../platform/tenancy/tenant-context.service.js";
import type {
  CreateSalaryComponentDto,
  CreateSalaryTemplateDto,
  TemplateLineDto,
  UpdateSalaryComponentDto,
  UpdateSalaryTemplateDto,
} from "./dto/salary-component.dto.js";
import {
  SalaryComponentsRepository,
  type TemplateLineInput,
} from "./salary-components.repository.js";
import {
  type AppliedLine,
  applyTemplate,
  RESERVED_COMPONENT_CODES,
  TemplateRuleError,
} from "./salary-template.rules.js";

/**
 * The organization's salary component list and salary templates
 * (Docs/PAYROLL_AND_COMPLIANCE.md §3.0, §4.10). Exported for the salary
 * service, which builds an employee's lines from components or a template.
 */
@Injectable()
export class SalaryComponentsService {
  constructor(
    private readonly repository: SalaryComponentsRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  private get scope() {
    return this.tenantContext.getOrgScope();
  }

  async listComponents(includeInactive = false) {
    await this.repository.ensureSystemComponents(this.scope);
    return this.repository.findComponents(this.scope, includeInactive);
  }

  async createComponent(dto: CreateSalaryComponentDto) {
    if ((RESERVED_COMPONENT_CODES as readonly string[]).includes(dto.code)) {
      throw new BusinessRuleViolationException(
        `${dto.code} is produced by the payroll engine itself and cannot be a component code`,
        "COMPONENT_CODE_RESERVED",
      );
    }
    await this.repository.ensureSystemComponents(this.scope);
    return this.repository.createComponent(
      this.scope,
      dto,
      this.tenantContext.getUserId(),
    );
  }

  async updateComponent(id: number, dto: UpdateSalaryComponentDto) {
    const current = await this.repository.findComponentById(this.scope, id);
    if (!current) throw new ResourceNotFoundException("Salary component", id);
    if (current.code === "BASIC" && dto.isActive === false) {
      throw new BusinessRuleViolationException(
        "Basic Salary cannot be deactivated: PF and percent-of-Basic lines depend on it",
        "COMPONENT_REQUIRED",
      );
    }
    return this.repository.updateComponent(
      this.scope,
      id,
      dto,
      this.tenantContext.getUserId(),
    );
  }

  /**
   * Active components by id or code, for a salary's lines. Fails on an
   * unknown, inactive or repeated component.
   */
  async resolveComponents(
    refs: Array<{
      componentId?: number | undefined;
      code?: string | undefined;
    }>,
  ) {
    await this.repository.ensureSystemComponents(this.scope);
    const ids = refs.flatMap((r) => (r.componentId ? [r.componentId] : []));
    const codes = refs.flatMap((r) =>
      !r.componentId && r.code ? [r.code.toUpperCase()] : [],
    );
    const found = [
      ...(ids.length
        ? await this.repository.findComponentsByIds(this.scope, ids)
        : []),
      ...(codes.length
        ? await this.repository.findComponentsByCodes(this.scope, codes)
        : []),
    ];
    const byId = new Map(found.map((c) => [c.id, c]));
    const byCode = new Map(found.map((c) => [c.code, c]));
    const out = refs.map((r) => {
      const c = r.componentId
        ? byId.get(r.componentId)
        : byCode.get((r.code ?? "").toUpperCase());
      if (!c) {
        throw new BusinessRuleViolationException(
          `Unknown salary component: ${r.componentId ?? r.code}`,
          "SALARY_COMPONENT_UNKNOWN",
        );
      }
      if (!c.isActive) {
        throw new BusinessRuleViolationException(
          `Salary component ${c.code} is inactive`,
          "SALARY_COMPONENT_INACTIVE",
        );
      }
      return c;
    });
    if (new Set(out.map((c) => c.id)).size !== out.length) {
      throw new BusinessRuleViolationException(
        "A salary component appears more than once",
        "SALARY_COMPONENT_DUPLICATE",
      );
    }
    return out;
  }

  // ---- templates -------------------------------------------------------------

  listTemplates(includeInactive = false) {
    return this.repository.findTemplates(this.scope, includeInactive);
  }

  async getTemplate(id: number) {
    const row = await this.repository.findTemplateById(this.scope, id);
    if (!row) throw new ResourceNotFoundException("Salary template", id);
    return row;
  }

  async createTemplate(dto: CreateSalaryTemplateDto) {
    const lines = await this.validateLines(dto.lines);
    return this.repository.createTemplate(
      this.scope,
      { code: dto.code, name: dto.name, description: dto.description },
      lines,
      this.tenantContext.getUserId(),
    );
  }

  async updateTemplate(id: number, dto: UpdateSalaryTemplateDto) {
    await this.getTemplate(id);
    const lines = dto.lines ? await this.validateLines(dto.lines) : undefined;
    return this.repository.updateTemplate(
      this.scope,
      id,
      { name: dto.name, description: dto.description, isActive: dto.isActive },
      lines,
      this.tenantContext.getUserId(),
    );
  }

  /** The lines a template gives for a gross monthly salary. */
  async applyTemplate(
    id: number,
    grossMonthly: number,
  ): Promise<AppliedLine[]> {
    const template = await this.getTemplate(id);
    if (!template.isActive) {
      throw new BusinessRuleViolationException(
        `Salary template ${template.code} is inactive`,
        "SALARY_TEMPLATE_INACTIVE",
      );
    }
    try {
      return applyTemplate(
        template.lines.map((l) => ({
          componentId: l.component.id,
          code: l.component.code,
          kind: l.component.kind === "DEDUCTION" ? "DEDUCTION" : "EARNING",
          calculationType:
            l.calculationType as TemplateLineDto["calculationType"],
          value: Number(l.value),
        })),
        grossMonthly,
      );
    } catch (err) {
      if (err instanceof TemplateRuleError) {
        throw new BusinessRuleViolationException(err.message, err.code);
      }
      throw err;
    }
  }

  async previewTemplate(id: number, grossMonthly: number) {
    const lines = await this.applyTemplate(id, grossMonthly);
    return {
      grossMonthly,
      lines,
      totalEarnings: lines
        .filter((l) => l.kind === "EARNING")
        .reduce((s, l) => s + l.monthlyAmount, 0),
    };
  }

  private async validateLines(
    lines: TemplateLineDto[],
  ): Promise<TemplateLineInput[]> {
    const components = await this.resolveComponents(
      lines.map((l) => ({ componentId: l.componentId })),
    );
    const remainders = lines.filter((l) => l.calculationType === "REMAINDER");
    if (remainders.length > 1) {
      throw new BusinessRuleViolationException(
        "A template may have only one REMAINDER line",
        "TEMPLATE_REMAINDER_DUPLICATE",
      );
    }
    return lines.map((l, i) => {
      const component = components[i]!;
      if (l.calculationType === "REMAINDER" && component.kind !== "EARNING") {
        throw new BusinessRuleViolationException(
          `${component.code} is a deduction; only an earning can take the remainder`,
          "TEMPLATE_REMAINDER_NOT_EARNING",
        );
      }
      if (l.calculationType !== "REMAINDER" && l.value === undefined) {
        throw new BusinessRuleViolationException(
          `${component.code} needs a value for ${l.calculationType}`,
          "TEMPLATE_VALUE_REQUIRED",
        );
      }
      if (
        (l.calculationType === "PERCENT_OF_GROSS" ||
          l.calculationType === "PERCENT_OF_BASIC") &&
        (l.value ?? 0) > 100
      ) {
        throw new BusinessRuleViolationException(
          `${component.code}: a percentage cannot exceed 100`,
          "TEMPLATE_PERCENT_INVALID",
        );
      }
      return {
        componentId: component.id,
        calculationType: l.calculationType,
        value: l.calculationType === "REMAINDER" ? 0 : (l.value ?? 0),
        displayOrder: component.displayOrder,
      };
    });
  }
}
