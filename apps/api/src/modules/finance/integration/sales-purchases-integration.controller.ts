import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator.js";
import { CancelIntegrationDocumentDto } from "./dto/cancel-integration-document.dto.js";
import { PostPurchaseBillDto } from "./dto/post-purchase-bill.dto.js";
import { PostSalesInvoiceDto } from "./dto/post-sales-invoice.dto.js";
import { SalesPurchasesIntegrationService } from "./sales-purchases-integration.service.js";

@ApiTags("finance-integration")
@Controller("finance/integration")
export class SalesPurchasesIntegrationController {
  constructor(
    private readonly integrationService: SalesPurchasesIntegrationService,
  ) {}

  @Post("sales-invoices/post")
  @RequirePermission("finance.journal.write")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "Post a finalized Sales Invoice / Order to Finance (Journal Entry & Output GST)",
  })
  postSalesInvoice(@Body() dto: PostSalesInvoiceDto) {
    return this.integrationService.postSalesInvoice(dto);
  }

  @Post("sales-invoices/cancel")
  @RequirePermission("finance.journal.write")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "Cancel and reverse a posted Sales Invoice in Finance (Swapped Journal Entry & Cancel GST)",
  })
  cancelSalesInvoice(@Body() dto: CancelIntegrationDocumentDto) {
    return this.integrationService.cancelSalesInvoice(dto);
  }

  @Post("purchase-bills/post")
  @RequirePermission("finance.journal.write")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "Post a confirmed Purchase Bill to Finance (Journal Entry & Input Tax Credit GST)",
  })
  postPurchaseBill(@Body() dto: PostPurchaseBillDto) {
    return this.integrationService.postPurchaseBill(dto);
  }

  @Post("purchase-bills/cancel")
  @RequirePermission("finance.journal.write")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "Cancel and reverse a posted Purchase Bill in Finance (Swapped Journal Entry & Cancel GST)",
  })
  cancelPurchaseBill(@Body() dto: CancelIntegrationDocumentDto) {
    return this.integrationService.cancelPurchaseBill(dto);
  }

  @Get("status/:reference")
  @RequirePermission("finance.journal.read")
  @ApiOperation({
    summary:
      "Retrieve accounting journal and GST integration status for a document reference",
  })
  getIntegrationStatus(@Param("reference") reference: string) {
    return this.integrationService.getIntegrationStatus(reference);
  }
}
