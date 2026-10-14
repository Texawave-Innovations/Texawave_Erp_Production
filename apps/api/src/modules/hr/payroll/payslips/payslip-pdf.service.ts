import { Injectable } from "@nestjs/common";
import { TenantContextService } from "../../../../platform/tenancy/tenant-context.service.js";
import type { PayslipSnapshot } from "../shared/payslip-snapshot.js";
import { PayslipPdfRenderer } from "./payslip-pdf.renderer.js";
import {
  type PayslipPdfView,
  renderPayslipHtml,
} from "./payslip-pdf.template.js";
import { PayslipsRepository } from "./payslips.repository.js";
import { PayslipsService } from "./payslips.service.js";

export interface PayslipPdfFile {
  buffer: Buffer;
  fileName: string;
}

/**
 * Payslip PDF downloads. Reads go through `PayslipsService`, so the HR route
 * keeps its team scope and the self-service route stays restricted to the
 * caller's own payslips.
 *
 * A payslip is a fixed document (Docs/PAYROLL_AND_COMPLIANCE.md §6): its
 * content is the snapshot taken at generation, and its first rendering is
 * stored, so every later download returns exactly the same bytes. Only a
 * regeneration (new version, with a reason) drops the stored PDF. A payslip
 * generated before snapshots existed is rendered from its live (masked)
 * rows and not stored.
 */
@Injectable()
export class PayslipPdfService {
  constructor(
    private readonly payslips: PayslipsService,
    private readonly repository: PayslipsRepository,
    private readonly tenantContext: TenantContextService,
    private readonly renderer: PayslipPdfRenderer,
  ) {}

  async forHr(id: number): Promise<PayslipPdfFile> {
    return this.toPdf(id, await this.payslips.findById(id));
  }

  async forSelf(id: number): Promise<PayslipPdfFile> {
    return this.toPdf(id, await this.payslips.findMineById(id));
  }

  private async toPdf(
    id: number,
    live: PayslipPdfView,
  ): Promise<PayslipPdfFile> {
    const scope = this.tenantContext.getOrgScope();
    const state = await this.repository.findPdfState(scope, id);
    const fileName = `${live.payslipNumber}.pdf`;
    if (state?.pdfContent) {
      return { buffer: Buffer.from(state.pdfContent), fileName };
    }
    if (state?.snapshot) {
      const snapshot = state.snapshot as unknown as PayslipSnapshot;
      const buffer = await this.renderer.render(
        renderPayslipHtml({
          ...snapshot,
          payslipNumber: state.payslipNumber,
          generatedAt: state.generatedAt,
          version: state.version,
        }),
      );
      await this.repository.storePdf(scope, id, state.version, buffer);
      return { buffer, fileName };
    }
    const buffer = await this.renderer.render(renderPayslipHtml(live));
    return { buffer, fileName };
  }
}
