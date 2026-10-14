import { ForbiddenException, Injectable } from "@nestjs/common";
import { formatDateOnly } from "../../../common/dates/date-only.js";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import { ResourceNotFoundException } from "../../../common/exceptions/business.exception.js";
import type { TeamScope } from "../../../common/tenancy/team-scope.js";
import { TeamContextService } from "../../../platform/tenancy/team-context.service.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import type {
  CreatePromotionLetterDto,
  QueryPromotionLetterDto,
  UpdatePromotionLetterDto,
} from "./dto/promotion-letter.dto.js";
import {
  defaultEffectiveDate,
  PROMOTION_LETTER_DEFAULTS,
} from "./promotion-letters.rules.js";
import {
  type NewPromotionLetter,
  type PromotionLetterPatch,
  PromotionLettersRepository,
} from "./promotion-letters.repository.js";

const READ = "hr.promotion_letter.read";
const WRITE = "hr.promotion_letter.write";
const REVISION_READ = "hr.revision_letter.read";

@Injectable()
export class PromotionLettersService {
  constructor(
    private readonly repository: PromotionLettersRepository,
    private readonly tenantContext: TenantContextService,
    private readonly teamContext: TeamContextService,
  ) {}

  async findAll(query: QueryPromotionLetterDto) {
    const scope = await this.teamContext.resolveScope(READ);
    const { items, total } = await this.repository.findMany(
      scope,
      { employeeId: query.employeeId },
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  /** 404 — not 403 — outside the caller's scope. */
  async findOne(id: number) {
    const scope = await this.teamContext.resolveScope(READ);
    const row = await this.repository.findOne(scope, id);
    if (!row) throw new ResourceNotFoundException("Promotion letter", id);
    return row;
  }

  /** Past revisions and promotions of one employee (404 outside scope).
   * Revision letters need their own read permission: without it they are
   * left out and `revisionsIncluded` is false, rather than this route
   * widening who may see revision amounts. */
  async salaryHistory(employeeId: number) {
    const scope = await this.teamContext.resolveScope(READ);
    const revisionScope = await this.optionalScope(REVISION_READ);
    const history = await this.repository.salaryHistory(
      scope,
      revisionScope,
      employeeId,
    );
    if (!history) throw new ResourceNotFoundException("Employee", employeeId);
    return history;
  }

  async create(dto: CreatePromotionLetterDto) {
    const scope = await this.writeScope();
    const today = new Date();
    const input: NewPromotionLetter = {
      employeeId: dto.employeeId,
      designationId: dto.designationId,
      location: dto.location ?? PROMOTION_LETTER_DEFAULTS.location,
      letterDate: dto.letterDate ?? formatDateOnly(today),
      effectiveDate: dto.effectiveDate ?? defaultEffectiveDate(today),
      basic: money(dto.basic),
      da: money(dto.da),
      hra: money(dto.hra),
      ca: money(dto.ca),
      signatoryName:
        dto.signatoryName ?? PROMOTION_LETTER_DEFAULTS.signatoryName,
      signatoryDesignation:
        dto.signatoryDesignation ??
        PROMOTION_LETTER_DEFAULTS.signatoryDesignation,
      issuedOn: today,
    };
    return this.repository.create(scope, input, this.tenantContext.getUserId());
  }

  async update(id: number, dto: UpdatePromotionLetterDto) {
    const scope = await this.writeScope();
    const row = await this.repository.update(
      scope,
      id,
      toPatch(dto),
      this.tenantContext.getUserId(),
    );
    if (!row) throw new ResourceNotFoundException("Promotion letter", id);
    return row;
  }

  /** A letter is never issued to, or edited for, the caller's own employee
   * record: `write.own` is reserved and grants nothing (maker-checker). */
  private async writeScope(): Promise<TeamScope> {
    const scope = await this.teamContext.resolveScope(WRITE);
    if (scope.level === "own") {
      throw new ForbiddenException(
        "You may not issue or edit promotion letters",
      );
    }
    return scope;
  }

  private async optionalScope(prefix: string): Promise<TeamScope | null> {
    try {
      return await this.teamContext.resolveScope(prefix);
    } catch (error) {
      if (error instanceof ForbiddenException) return null;
      throw error;
    }
  }
}

/** Money as the 2-dp string the DECIMAL(12,2) column takes. Undefined → 0. */
function money(value: number | undefined): string {
  return (value ?? 0).toFixed(2);
}

function toPatch(dto: UpdatePromotionLetterDto): PromotionLetterPatch {
  return {
    ...(dto.designationId !== undefined
      ? { designationId: dto.designationId }
      : {}),
    ...(dto.location !== undefined ? { location: dto.location } : {}),
    ...(dto.letterDate !== undefined ? { letterDate: dto.letterDate } : {}),
    ...(dto.effectiveDate !== undefined
      ? { effectiveDate: dto.effectiveDate }
      : {}),
    ...(dto.basic !== undefined ? { basic: money(dto.basic) } : {}),
    ...(dto.da !== undefined ? { da: money(dto.da) } : {}),
    ...(dto.hra !== undefined ? { hra: money(dto.hra) } : {}),
    ...(dto.ca !== undefined ? { ca: money(dto.ca) } : {}),
    ...(dto.signatoryName !== undefined
      ? { signatoryName: dto.signatoryName }
      : {}),
    ...(dto.signatoryDesignation !== undefined
      ? { signatoryDesignation: dto.signatoryDesignation }
      : {}),
  };
}
