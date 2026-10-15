import { Injectable } from "@nestjs/common";
import { parseDateOnly } from "../../../common/dates/date-only.js";
import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from "../../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import {
  type DocumentCodeType,
  fiscalYearLabel,
  formatDocumentNumber,
} from "./code-formats.rules.js";
import { CodeFormatsService } from "./code-formats.service.js";
import type { SetRunningNumberDto } from "./dto/running-number.dto.js";
import { RunningNumbersRepository } from "./running-numbers.repository.js";

export const RUNNING_NUMBER_TYPES: readonly DocumentCodeType[] = [
  "quotation",
  "proforma_invoice",
  "tax_invoice",
  "delivery_challan",
];

function isRunningType(value: string): value is DocumentCodeType {
  return (RUNNING_NUMBER_TYPES as readonly string[]).includes(value);
}

/** A two-digit-year label is consecutive: 26-27, 99-00. */
function assertFiscalYear(label: string): void {
  const [a, b] = label.split("-").map(Number);
  if (a === undefined || b === undefined || (a + 1) % 100 !== b) {
    throw new BusinessRuleViolationException(
      `${label} is not a financial year (e.g. 26-27)`,
      "INVALID_FISCAL_YEAR",
    );
  }
}

/** Sales master list — running numbers of the four documents, on one page. */
@Injectable()
export class RunningNumbersService {
  constructor(
    private readonly repository: RunningNumbersRepository,
    private readonly codeFormats: CodeFormatsService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async findAll(date: string | undefined) {
    const fiscalYear = fiscalYearLabel(date ? parseDateOnly(date) : new Date());
    return Promise.all(
      RUNNING_NUMBER_TYPES.map((codeType) => this.view(codeType, fiscalYear)),
    );
  }

  async setLastNumber(codeType: string, dto: SetRunningNumberDto) {
    if (!isRunningType(codeType)) {
      throw new ResourceNotFoundException("Running number", codeType);
    }
    const fiscalYear = dto.fiscalYear ?? fiscalYearLabel(new Date());
    assertFiscalYear(fiscalYear);
    await this.repository.setLastNumber(
      this.tenantContext.getOrgScope(),
      codeType,
      fiscalYear,
      await this.codeFormats.getFormat(codeType),
      dto.lastNumber,
      this.tenantContext.getUserId(),
    );
    return this.view(codeType, fiscalYear);
  }

  private async view(codeType: DocumentCodeType, fiscalYear: string) {
    const [format, next] = await Promise.all([
      this.codeFormats.getFormat(codeType),
      this.repository.nextNumber(
        this.tenantContext.getOrgScope(),
        codeType,
        fiscalYear,
      ),
    ]);
    return {
      codeType,
      prefix: format.prefix,
      padding: format.padding,
      fiscalYear,
      lastNumber: next - 1,
      /** What was last issued or set, e.g. TW/QUO/26-27/0100 (null = none). */
      lastCode:
        next > 1 ? formatDocumentNumber(format, fiscalYear, next - 1) : null,
      /** What the next document gets, e.g. TW/QUO/26-27/0101. */
      nextCode: formatDocumentNumber(format, fiscalYear, next),
    };
  }
}
