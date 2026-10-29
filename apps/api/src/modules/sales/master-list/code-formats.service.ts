import { Injectable } from "@nestjs/common";
import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from "../../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import {
  CODE_TYPES,
  type CodeFormat,
  type CodeType,
  CUSTOMER_PREFIX_PATTERN,
  DEFAULT_CODE_FORMATS,
  exampleCode,
  isCodeType,
} from "./code-formats.rules.js";
import { CodeFormatsRepository } from "./code-formats.repository.js";
import type { UpdateCodeFormatDto } from "./dto/code-format.dto.js";

/** Sales master list — code formats. Every code type is always listed: a
 * type not edited yet shows its default (`isDefault: true`). */
@Injectable()
export class CodeFormatsService {
  constructor(
    private readonly repository: CodeFormatsRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async findAll() {
    const stored = await this.repository.findAll(
      this.tenantContext.getOrgScope(),
    );
    return CODE_TYPES.map((codeType) => {
      const row = stored.find((r) => r.codeType === codeType);
      return this.view(codeType, row ?? null);
    });
  }

  async findOne(codeType: string) {
    const type = this.assertType(codeType);
    const row = await this.repository.findOne(
      this.tenantContext.getOrgScope(),
      type,
    );
    return this.view(type, row);
  }

  async update(codeType: string, dto: UpdateCodeFormatDto) {
    const type = this.assertType(codeType);
    const patch: Partial<CodeFormat> = {};
    if (dto.prefix !== undefined) {
      if (type === "customer" && !CUSTOMER_PREFIX_PATTERN.test(dto.prefix)) {
        throw new BusinessRuleViolationException(
          "A customer code prefix is 1-10 letters or digits with no separators",
          "INVALID_CODE_PREFIX",
        );
      }
      patch.prefix = dto.prefix;
    }
    if (dto.padding !== undefined) patch.padding = dto.padding;
    const row = await this.repository.upsert(
      this.tenantContext.getOrgScope(),
      type,
      patch,
      this.tenantContext.getUserId(),
    );
    return this.view(type, row);
  }

  /** Public, read-only: the effective format for a code type. Used by the
   * modules that issue codes (Docs/CODING_STANDARDS.md §11). */
  async getFormat(codeType: CodeType): Promise<CodeFormat> {
    const row = await this.repository.findOne(
      this.tenantContext.getOrgScope(),
      codeType,
    );
    return row
      ? { prefix: row.prefix, padding: row.padding }
      : DEFAULT_CODE_FORMATS[codeType];
  }

  private view(
    codeType: CodeType,
    row: { prefix: string; padding: number; updatedAt: Date } | null,
  ) {
    const format = row ?? DEFAULT_CODE_FORMATS[codeType];
    return {
      codeType,
      prefix: format.prefix,
      padding: format.padding,
      isDefault: row === null,
      updatedAt: row?.updatedAt ?? null,
      /** What the next code looks like, for the master-list screen. */
      example: exampleCode(codeType, format, new Date()),
    };
  }

  private assertType(codeType: string): CodeType {
    if (!isCodeType(codeType)) {
      throw new ResourceNotFoundException("Code format", codeType);
    }
    return codeType;
  }
}
