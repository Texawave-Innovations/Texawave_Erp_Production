import { ForbiddenException, Injectable } from "@nestjs/common";
import { formatDateOnly } from "../../../common/dates/date-only.js";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import { ResourceNotFoundException } from "../../../common/exceptions/business.exception.js";
import { TeamContextService } from "../../../platform/tenancy/team-context.service.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import type {
  CreateRevisionLetterDto,
  QueryRevisionLetterDto,
  UpdateRevisionLetterDto,
} from "./dto/revision-letter.dto.js";
import {
  defaultEffectiveDate,
  REVISION_LETTER_DEFAULTS,
} from "./revision-letters.rules.js";
import {
  type NewRevisionLetter,
  type RevisionLetterPatch,
  RevisionLettersRepository,
} from "./revision-letters.repository.js";
import type { TeamScope } from "../../../common/tenancy/team-scope.js";

const READ = "hr.revision_letter.read";
const WRITE = "hr.revision_letter.write";

@Injectable()
export class RevisionLettersService {
  constructor(
    private readonly repository: RevisionLettersRepository,
    private readonly tenantContext: TenantContextService,
    private readonly teamContext: TeamContextService,
  ) {}

  async findAll(query: QueryRevisionLetterDto) {
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
    if (!row) throw new ResourceNotFoundException("Revision letter", id);
    return row;
  }

  async create(dto: CreateRevisionLetterDto) {
    const scope = await this.writeScope();
    const today = new Date();
    const input: NewRevisionLetter = {
      employeeId: dto.employeeId,
      designation: dto.designation,
      location: dto.location ?? REVISION_LETTER_DEFAULTS.location,
      letterDate: dto.letterDate ?? formatDateOnly(today),
      effectiveDate: dto.effectiveDate ?? defaultEffectiveDate(today),
      basic: money(dto.basic),
      da: money(dto.da),
      hra: money(dto.hra),
      ca: money(dto.ca),
      signatoryName:
        dto.signatoryName ?? REVISION_LETTER_DEFAULTS.signatoryName,
      signatoryDesignation:
        dto.signatoryDesignation ??
        REVISION_LETTER_DEFAULTS.signatoryDesignation,
      issuedOn: today,
    };
    return this.repository.create(scope, input, this.tenantContext.getUserId());
  }

  async update(id: number, dto: UpdateRevisionLetterDto) {
    const scope = await this.writeScope();
    const row = await this.repository.update(
      scope,
      id,
      toPatch(dto),
      this.tenantContext.getUserId(),
    );
    if (!row) throw new ResourceNotFoundException("Revision letter", id);
    return row;
  }

  /** A letter is never issued to, or edited for, the caller's own employee
   * record: `write.own` is reserved and grants nothing (maker-checker). */
  private async writeScope(): Promise<TeamScope> {
    const scope = await this.teamContext.resolveScope(WRITE);
    if (scope.level === "own") {
      throw new ForbiddenException(
        "You may not issue or edit revision letters",
      );
    }
    return scope;
  }
}

/** Money as the 2-dp string the DECIMAL(12,2) column takes. Undefined → 0,
 * matching the legacy form's starting values. */
function money(value: number | undefined): string {
  return (value ?? 0).toFixed(2);
}

function toPatch(dto: UpdateRevisionLetterDto): RevisionLetterPatch {
  return {
    ...(dto.designation !== undefined ? { designation: dto.designation } : {}),
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
