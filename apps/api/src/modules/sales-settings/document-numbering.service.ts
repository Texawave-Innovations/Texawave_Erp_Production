import { BadRequestException, Injectable } from "@nestjs/common";
import { TenantContextService } from "../../platform/tenancy/tenant-context.service.js";
import { DocumentNumberingRepository } from "./document-numbering.repository.js";
import type { UpdateDocumentNumberingDto } from "./dto/update-document-numbering.dto.js";
import {
  SALES_DOCUMENT_TYPES,
  type SalesDocumentType,
} from "./sales-settings.constants.js";

@Injectable()
export class DocumentNumberingService {
  constructor(
    private readonly repository: DocumentNumberingRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  /** Returns one row per `SalesDocumentType`, synthesizing an unsaved default
   * (prefix "", padding 6, nextNumber 1) for any type not yet configured —
   * the Numbering tab always shows all 8 fields, even before first save. */
  async findAll() {
    const scope = this.tenantContext.getOrgScope();
    const rows = await this.repository.findMany(scope, SALES_DOCUMENT_TYPES);
    const byDocType = new Map(rows.map((row) => [row.docType, row]));
    return SALES_DOCUMENT_TYPES.map(
      (docType) =>
        byDocType.get(docType) ?? {
          docType,
          prefix: "",
          padding: 6,
          nextNumber: 1,
        },
    );
  }

  upsert(docType: SalesDocumentType, dto: UpdateDocumentNumberingDto) {
    if (!SALES_DOCUMENT_TYPES.includes(docType)) {
      throw new BadRequestException(
        `Unknown document type "${docType}" — expected one of ${SALES_DOCUMENT_TYPES.join(", ")}`,
      );
    }
    const scope = this.tenantContext.getOrgScope();
    return this.repository.upsert(
      scope,
      docType,
      dto,
      this.tenantContext.getUserId(),
    );
  }
}
