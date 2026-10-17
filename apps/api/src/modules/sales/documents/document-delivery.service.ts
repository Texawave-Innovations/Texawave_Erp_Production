import { Injectable } from "@nestjs/common";
import { BusinessRuleViolationException } from "../../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import { MailerService } from "../../../shared/mailer/mailer.service.js";
import { CompanyProfileService } from "../master-list/company-profile.service.js";
import { DocumentFieldsService } from "../master-list/document-fields.service.js";
import {
  type DocumentEntity,
  DocumentDeliveryRepository,
} from "./document-delivery.repository.js";
import {
  type PrintableDocument,
  renderSalesDocumentHtml,
} from "./document-pdf.template.js";
import { whatsappNumber } from "./documents.rules.js";
import type { SendDocumentEmailDto } from "./dto/document-parts.dto.js";
import { pdfFileName, shareMessage } from "./printable.js";
import { SalesPdfRenderer } from "./sales-pdf.renderer.js";

export interface PdfFile {
  buffer: Buffer;
  fileName: string;
}

/**
 * Getting a Sales document out: PDF download, email with the PDF attached,
 * and a WhatsApp share link. Shared by the quotation, invoice and delivery
 * challan services; each send is audited.
 *
 * WhatsApp: this builds a `https://wa.me/<number>?text=…` link the user
 * opens (WhatsApp then sends from their own account). Sending directly from
 * the server, with the PDF attached, needs a WhatsApp Business API provider —
 * not set up.
 */
@Injectable()
export class DocumentDeliveryService {
  constructor(
    private readonly renderer: SalesPdfRenderer,
    private readonly mailer: MailerService,
    private readonly repository: DocumentDeliveryRepository,
    private readonly tenantContext: TenantContextService,
    private readonly companyProfile: CompanyProfileService,
    private readonly documentFields: DocumentFieldsService,
  ) {}

  /** Adds the company logo and the chosen seal / signature images from the
   * Sales master list (for the PDF). */
  async withImages(
    doc: PrintableDocument,
    refs: { sealItemId: number | null; signatureItemId: number | null },
  ): Promise<PrintableDocument> {
    const [logo, seal, signature] = await Promise.all([
      this.companyProfile.logoDataUri(),
      this.documentFields.imageDataUri(refs.sealItemId),
      this.documentFields.imageDataUri(refs.signatureItemId),
    ]);
    return { ...doc, images: { logo, seal, signature } };
  }

  /** The document's HTML — exactly what `pdf()` renders. For live
   * previews of unsaved forms. */
  html(doc: PrintableDocument): string {
    return renderSalesDocumentHtml(doc);
  }

  async pdf(doc: PrintableDocument): Promise<PdfFile> {
    return {
      buffer: await this.renderer.render(renderSalesDocumentHtml(doc)),
      fileName: pdfFileName(doc.number),
    };
  }

  async email(
    entity: DocumentEntity,
    entityId: number,
    doc: PrintableDocument,
    dto: SendDocumentEmailDto,
  ) {
    const to = dto.to ?? [doc.customer.email];
    const subject = dto.subject ?? `${doc.title} ${doc.number}`;
    const file = await this.pdf(doc);
    const status = await this.mailer.send({
      to,
      cc: dto.cc,
      subject,
      text: dto.message ?? shareMessage(doc),
      attachments: [
        {
          filename: file.fileName,
          content: file.buffer,
          contentType: "application/pdf",
        },
      ],
    });
    await this.repository.record(
      this.tenantContext.getOrgScope(),
      entity,
      entityId,
      "send_email",
      { number: doc.number, to, cc: dto.cc ?? [], subject, status },
    );
    return { status, to, cc: dto.cc ?? [], subject };
  }

  async whatsapp(
    entity: DocumentEntity,
    entityId: number,
    doc: PrintableDocument,
  ) {
    const phone = whatsappNumber(doc.customer.mobile);
    if (phone.length < 8) {
      throw new BusinessRuleViolationException(
        `Customer ${doc.customer.customerCode} has no usable mobile number`,
        "CUSTOMER_MOBILE_REQUIRED",
      );
    }
    const message = shareMessage(doc);
    await this.repository.record(
      this.tenantContext.getOrgScope(),
      entity,
      entityId,
      "share_whatsapp",
      { number: doc.number, phone },
    );
    return {
      phone,
      message,
      url: `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
    };
  }
}
