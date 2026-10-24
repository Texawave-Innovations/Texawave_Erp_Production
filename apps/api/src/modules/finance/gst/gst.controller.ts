import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Paginate } from "../../../common/decorators/paginate.decorator.js";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator.js";
import { CreateGstEntryDto } from "./dto/create-gst-entry.dto.js";
import { QueryGstEntriesDto } from "./dto/query-gst-entries.dto.js";
import { QueryGstr1Dto } from "./dto/query-gstr1.dto.js";
import { QueryGstr3bDto } from "./dto/query-gstr3b.dto.js";
import { QueryHsnSummaryDto } from "./dto/query-hsn-summary.dto.js";
import { ReconcileGstDto } from "./dto/reconcile-gst.dto.js";
import { GstService } from "./gst.service.js";

@ApiTags("finance-gst")
@Controller("finance/gst")
export class GstController {
  constructor(private readonly gstService: GstService) {}

  @Post("entries")
  @RequirePermission("finance.gst.write")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      "Record a GST entry (outward liability or inward input tax credit)",
  })
  createEntry(@Body() dto: CreateGstEntryDto) {
    return this.gstService.createEntry(dto);
  }

  @Get("entries")
  @RequirePermission("finance.gst.read")
  @ApiOperation({
    summary:
      "List GST tax ledger entries with pagination, period, and status filters",
  })
  getEntries(@Paginate(QueryGstEntriesDto) query: QueryGstEntriesDto) {
    return this.gstService.getEntries(query);
  }

  @Get("entries/:id")
  @RequirePermission("finance.gst.read")
  @ApiOperation({
    summary: "Retrieve a specific GST tax ledger entry by ID",
  })
  getEntryById(@Param("id", ParseIntPipe) id: number) {
    return this.gstService.getEntryById(id);
  }

  @Get("reports/hsn-summary")
  @RequirePermission("finance.gst.read")
  @ApiOperation({
    summary:
      "HSN/SAC summary report aggregating taxable and tax component values",
  })
  getHsnSummary(@Query() query: QueryHsnSummaryDto) {
    return this.gstService.getHsnSummary(query);
  }

  @Get("reports/gstr1-summary")
  @RequirePermission("finance.gst.read")
  @ApiOperation({
    summary:
      "GSTR-1 Outward Tax Summary (B2B vs B2C breakdown, rate slabs, proforma exclusion)",
  })
  getGstr1Summary(@Query() query: QueryGstr1Dto) {
    return this.gstService.getGstr1Summary(query);
  }

  @Get("reports/gstr3b-summary")
  @RequirePermission("finance.gst.read")
  @ApiOperation({
    summary:
      "GSTR-3B Summary Report (Outward liability vs Eligible ITC, Net Tax Payable)",
  })
  getGstr3bSummary(@Query() query: QueryGstr3bDto) {
    return this.gstService.getGstr3bSummary(query);
  }

  @Post("reconciliation")
  @RequirePermission("finance.gst.write")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "Reconcile ERP purchase books against counterpart GSTR-2B filing data",
  })
  reconcile(@Body() dto: ReconcileGstDto) {
    return this.gstService.reconcile(dto);
  }

  @Get("reconciliation/summary")
  @RequirePermission("finance.gst.read")
  @ApiOperation({
    summary: "Retrieve period reconciliation status summary and percentage",
  })
  getReconciliationSummary(@Query("period") period: string) {
    return this.gstService.getReconciliationSummary(period);
  }
}
