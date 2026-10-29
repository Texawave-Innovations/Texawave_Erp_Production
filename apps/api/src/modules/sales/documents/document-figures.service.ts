import { Injectable } from "@nestjs/common";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import { DocumentFiguresRepository } from "./document-figures.repository.js";

/** Public, read-only: document figures for the Sales dashboard
 * (Docs/CODING_STANDARDS.md §11 — a narrow synchronous read). */
@Injectable()
export class DocumentFiguresService {
  constructor(
    private readonly repository: DocumentFiguresRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  figures(today: Date) {
    return this.repository.figures(this.tenantContext.getOrgScope(), today);
  }
}
