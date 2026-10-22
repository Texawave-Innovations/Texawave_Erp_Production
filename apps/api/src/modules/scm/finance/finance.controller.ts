import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiConsumes, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Paginate } from "../../../common/decorators/paginate.decorator.js";
import { RawResponse } from "../../../common/decorators/raw-response.decorator.js";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator.js";
import { MAX_UPLOAD_BYTES } from "../../../shared/file-storage/file-storage.service.js";
import {
  CreateBillDto,
  CreatePaymentDto,
  QueryBillDto,
  QueryPaymentDto,
  ReasonDto,
  UpdateBillDto,
  UploadSupplierDocumentDto,
} from "./dto/finance.dto.js";
import {
  FinanceService,
  type UploadedSupplierFile,
} from "./finance.service.js";

/** Supplier bills (Accounts Payable). Cancelling needs no payments on the
 * bill; editing only an open, unpaid bill. */
@ApiTags("scm-finance")
@Controller("scm/finance/bills")
export class SupplierBillsController {
  constructor(private readonly finance: FinanceService) {}

  @Get()
  @RequirePermission("scm.finance.read")
  @ApiOperation({
    summary: "List supplier bills (search, status, supplier, overdue)",
  })
  findAll(@Paginate(QueryBillDto) query: QueryBillDto) {
    return this.finance.listBills(query);
  }

  @Get(":id")
  @RequirePermission("scm.finance.read")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.finance.getBill(id);
  }

  @Post()
  @RequirePermission("scm.finance.write")
  create(@Body() dto: CreateBillDto) {
    return this.finance.createBill(dto);
  }

  @Patch(":id")
  @RequirePermission("scm.finance.write")
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateBillDto) {
    return this.finance.updateBill(id, dto);
  }

  @Post(":id/cancel")
  @RequirePermission("scm.finance.write")
  cancel(@Param("id", ParseIntPipe) id: number, @Body() dto: ReasonDto) {
    return this.finance.cancelBill(id, dto.reason);
  }
}

/** Payments made to suppliers, optionally applied to a bill. */
@ApiTags("scm-finance")
@Controller("scm/finance/payments")
export class SupplierPaymentsController {
  constructor(private readonly finance: FinanceService) {}

  @Get()
  @RequirePermission("scm.finance.read")
  findAll(@Paginate(QueryPaymentDto) query: QueryPaymentDto) {
    return this.finance.listPayments(query);
  }

  @Post()
  @RequirePermission("scm.finance.write")
  create(@Body() dto: CreatePaymentDto) {
    return this.finance.createPayment(dto);
  }

  @Post(":id/void")
  @RequirePermission("scm.finance.write")
  void(@Param("id", ParseIntPipe) id: number, @Body() dto: ReasonDto) {
    return this.finance.voidPayment(id, dto.reason);
  }
}

@ApiTags("scm-finance")
@Controller("scm/finance/suppliers")
export class SupplierFinanceSummaryController {
  constructor(private readonly finance: FinanceService) {}

  @Get(":supplierId/summary")
  @RequirePermission("scm.finance.read")
  @ApiOperation({
    summary: "Billed / paid / outstanding / overdue for one supplier",
  })
  summary(@Param("supplierId", ParseIntPipe) supplierId: number) {
    return this.finance.supplierSummary(supplierId);
  }
}

/** Supplier documents (GST certificate, PAN, contracts...). PDF, JPG or PNG,
 * 5 MB or smaller; stored on local disk by the shared FileStorageService. */
@ApiTags("scm-suppliers")
@Controller("scm/suppliers/:supplierId/documents")
export class SupplierDocumentsController {
  constructor(private readonly finance: FinanceService) {}

  @Get()
  @RequirePermission("scm.supplier.read")
  list(@Param("supplierId", ParseIntPipe) supplierId: number) {
    return this.finance.listDocuments(supplierId);
  }

  @Post()
  @RequirePermission("scm.supplier.write")
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: MAX_UPLOAD_BYTES } }),
  )
  @ApiConsumes("multipart/form-data")
  @ApiOperation({
    summary:
      "Upload a supplier document. PDF, JPG or PNG, 5 MB or smaller. Field name: file.",
  })
  upload(
    @Param("supplierId", ParseIntPipe) supplierId: number,
    @Body() dto: UploadSupplierDocumentDto,
    @UploadedFile() file: UploadedSupplierFile | undefined,
  ) {
    return this.finance.uploadDocument(supplierId, dto, file);
  }

  @Get(":id/file")
  @RequirePermission("scm.supplier.read")
  @RawResponse()
  @ApiOperation({ summary: "Download one document" })
  async download(
    @Param("supplierId", ParseIntPipe) supplierId: number,
    @Param("id", ParseIntPipe) id: number,
  ) {
    const file = await this.finance.downloadDocument(supplierId, id);
    return new StreamableFile(file.buffer, {
      type: file.mimeType,
      disposition: `inline; filename="${encodeURIComponent(file.fileName)}"`,
    });
  }

  @Delete(":id")
  @RequirePermission("scm.supplier.write")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param("supplierId", ParseIntPipe) supplierId: number,
    @Param("id", ParseIntPipe) id: number,
  ) {
    return this.finance.removeDocument(supplierId, id);
  }
}
