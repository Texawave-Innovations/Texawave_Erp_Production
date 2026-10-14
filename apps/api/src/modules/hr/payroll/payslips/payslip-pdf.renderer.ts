import { Injectable } from "@nestjs/common";
import { HtmlPdfRenderer } from "../../../../shared/pdf/html-pdf-renderer.js";

/** The payslip module's own renderer provider (its own token, so tests can
 * replace it independently). The rendering lives in the shared renderer. */
@Injectable()
export class PayslipPdfRenderer extends HtmlPdfRenderer {}
