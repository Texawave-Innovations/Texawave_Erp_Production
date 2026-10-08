import { Injectable } from "@nestjs/common";
import { PayslipPdfRenderer } from "./payslip-pdf.renderer.js";
import {
  type PayslipPdfView,
  renderPayslipHtml,
} from "./payslip-pdf.template.js";
import { PayslipsService } from "./payslips.service.js";

export interface PayslipPdfFile {
  buffer: Buffer;
  fileName: string;
}

/**
 * Payslip PDF downloads. Reads go through `PayslipsService`, so the HR route
 * keeps its team scope and the self-service route stays restricted to the
 * caller's own payslips, and the PDF shows the same masked bank/PAN values
 * as the JSON responses.
 */
@Injectable()
export class PayslipPdfService {
  constructor(
    private readonly payslips: PayslipsService,
    private readonly renderer: PayslipPdfRenderer,
  ) {}

  async forHr(id: number): Promise<PayslipPdfFile> {
    return this.toPdf(await this.payslips.findById(id));
  }

  async forSelf(id: number): Promise<PayslipPdfFile> {
    return this.toPdf(await this.payslips.findMineById(id));
  }

  private async toPdf(payslip: PayslipPdfView): Promise<PayslipPdfFile> {
    const buffer = await this.renderer.render(renderPayslipHtml(payslip));
    return { buffer, fileName: `${payslip.payslipNumber}.pdf` };
  }
}
