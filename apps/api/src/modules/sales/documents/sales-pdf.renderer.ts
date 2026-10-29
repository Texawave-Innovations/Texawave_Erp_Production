import { Injectable } from "@nestjs/common";
import { HtmlPdfRenderer } from "../../../shared/pdf/html-pdf-renderer.js";

/** Sales documents' own renderer provider (its own token, so tests can
 * replace it without a browser). The rendering lives in the shared renderer. */
@Injectable()
export class SalesPdfRenderer extends HtmlPdfRenderer {}
