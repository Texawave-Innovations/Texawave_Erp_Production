import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Paginate } from "../../../common/decorators/paginate.decorator.js";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator.js";
import { QuotationsService } from "./quotations.service.js";
import { QueryQuotationDto, QuotationPayloadDto } from "./dto/quotation.dto.js";

/** Migrated from the LIVE legacy TexaWave_ERP/src/modules/crm/QuoteForm.tsx
 * + Quotes.tsx + domain/quotationsService.ts (RTDB `crm/quotations` +
 * `crm/quotationItems`). Org-wide reference data, no team dimension —
 * see the catalog.ts note on crm.quotation.*.
 *
 * Delete is gated by the SEPARATE `crm.quotation.delete` permission, not
 * `.write` — unlike every other CRM entity's controller so far. This is
 * deliberate: legacy's Delete is admin-only while Create/Update have no
 * gate at all, and an ordinary write-only role must not be able to
 * delete (approved decision D1).
 *
 * `PUT /:id` is a full replace-all of both the header and every line
 * item in one call (approved decision D2) — there is no `PATCH` and no
 * per-line-item endpoint the way `OpportunityProduct` has one; legacy's
 * single Save button always submits everything together. */
@ApiTags("crm-quotations")
@Controller("crm/quotations")
export class QuotationsController {
  constructor(private readonly quotations: QuotationsService) {}

  @Get()
  @RequirePermission("crm.quotation.read")
  @ApiOperation({
    summary:
      "List quotations (search quotationNumber/subject/account, filter by status/account/opportunity)",
  })
  findAll(@Paginate(QueryQuotationDto) query: QueryQuotationDto) {
    return this.quotations.findAll(query);
  }

  @Get(":id")
  @RequirePermission("crm.quotation.read")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.quotations.findOne(id);
  }

  @Post()
  @RequirePermission("crm.quotation.write")
  @ApiOperation({
    summary:
      "Create a quotation with its line items; totals are always server-computed",
  })
  create(@Body() dto: QuotationPayloadDto) {
    return this.quotations.create(dto);
  }

  @Put(":id")
  @RequirePermission("crm.quotation.write")
  @ApiOperation({
    summary:
      "Replace the full quotation header and every line item in one transaction",
  })
  replace(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: QuotationPayloadDto,
  ) {
    return this.quotations.replace(id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission("crm.quotation.delete")
  @ApiOperation({
    summary:
      "Soft-delete a quotation (requires crm.quotation.delete, not just .write)",
  })
  async remove(@Param("id", ParseIntPipe) id: number) {
    await this.quotations.remove(id);
  }
}
