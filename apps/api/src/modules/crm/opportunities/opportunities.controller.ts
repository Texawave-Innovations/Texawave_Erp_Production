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
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Paginate } from "../../../common/decorators/paginate.decorator.js";
import { RequireScopedPermission } from "../../../common/decorators/require-permission.decorator.js";
import { OpportunitiesService } from "./opportunities.service.js";
import { OpportunityProductsService } from "./opportunity-products.service.js";
import {
  ChangeStageDto,
  CreateOpportunityDto,
  MarkLostDto,
  MarkWonDto,
  QueryOpportunityDto,
  ReopenDto,
  SetOnHoldDto,
  SetStuckReasonDto,
  UpdateOpportunityDto,
} from "./dto/opportunity.dto.js";
import {
  AddOpportunityProductsDto,
  UpdateOpportunityProductDto,
} from "./dto/opportunity-product.dto.js";

/** Migrated from the LIVE legacy TexaWave_ERP/src/modules/crm/Pipeline.tsx
 * + domain/opportunitiesService.ts + domain/OpportunityDrawer.tsx (RTDB
 * `crm/opportunities` + `crm/opportunityStageHistory`). Delete is
 * soft-delete, gated behind the write permission — see the catalog.ts
 * note on crm.opportunity.write for why (legacy gates broader management
 * behind "CRM Admin / Sales Head", this app has no separate role concept
 * yet). The `:id/products` routes below are the Deal Products tab
 * (domain/AddDealProductsDialog.tsx + dealProductsService.ts) — gated by
 * the same crm.opportunity.* permission as the rest of this controller,
 * not a separate one (see catalog.ts). No Quotation/Activity record is
 * created or touched — neither entity exists in production yet. */
@ApiTags("crm-opportunities")
@Controller("crm/opportunities")
export class OpportunitiesController {
  constructor(
    private readonly opportunities: OpportunitiesService,
    private readonly lineItems: OpportunityProductsService,
  ) {}

  @Get()
  @RequireScopedPermission("crm.opportunity.read")
  @ApiOperation({
    summary:
      "List opportunities in the caller's scope (search title/owner/account, filter by account/stage/status)",
  })
  findAll(@Paginate(QueryOpportunityDto) query: QueryOpportunityDto) {
    return this.opportunities.findAll(query);
  }

  @Get(":id")
  @RequireScopedPermission("crm.opportunity.read")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.opportunities.findOne(id);
  }

  @Get(":id/stage-history")
  @RequireScopedPermission("crm.opportunity.read")
  @ApiOperation({
    summary: "Append-only stage-transition history, most recent first",
  })
  findStageHistory(@Param("id", ParseIntPipe) id: number) {
    return this.opportunities.findStageHistory(id);
  }

  @Post()
  @RequireScopedPermission("crm.opportunity.write")
  @ApiOperation({ summary: "Create an opportunity" })
  create(@Body() dto: CreateOpportunityDto) {
    return this.opportunities.create(dto);
  }

  @Patch(":id")
  @RequireScopedPermission("crm.opportunity.write")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateOpportunityDto,
  ) {
    return this.opportunities.update(id, dto);
  }

  @Post(":id/stage")
  @RequireScopedPermission("crm.opportunity.write")
  @ApiOperation({
    summary: "Move to a different stage (no-op if already there)",
  })
  changeStage(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ChangeStageDto,
  ) {
    return this.opportunities.changeStage(id, dto);
  }

  @Post(":id/won")
  @RequireScopedPermission("crm.opportunity.write")
  @ApiOperation({ summary: "Mark Won" })
  markWon(@Param("id", ParseIntPipe) id: number, @Body() dto: MarkWonDto) {
    return this.opportunities.markWon(id, dto);
  }

  @Post(":id/lost")
  @RequireScopedPermission("crm.opportunity.write")
  @ApiOperation({ summary: "Mark Lost" })
  markLost(@Param("id", ParseIntPipe) id: number, @Body() dto: MarkLostDto) {
    return this.opportunities.markLost(id, dto);
  }

  @Post(":id/on-hold")
  @RequireScopedPermission("crm.opportunity.write")
  @ApiOperation({ summary: "Put On Hold" })
  setOnHold(@Param("id", ParseIntPipe) id: number, @Body() dto: SetOnHoldDto) {
    return this.opportunities.setOnHold(id, dto);
  }

  @Post(":id/reopen")
  @RequireScopedPermission("crm.opportunity.write")
  @ApiOperation({
    summary:
      "Reopen a Won/Lost/On-Hold opportunity back to OPEN in the given stage",
  })
  reopen(@Param("id", ParseIntPipe) id: number, @Body() dto: ReopenDto) {
    return this.opportunities.reopen(id, dto);
  }

  @Patch(":id/stuck-reason")
  @RequireScopedPermission("crm.opportunity.write")
  setStuckReason(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: SetStuckReasonDto,
  ) {
    return this.opportunities.setStuckReason(id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireScopedPermission("crm.opportunity.write")
  @ApiOperation({ summary: "Soft-delete an opportunity" })
  async remove(@Param("id", ParseIntPipe) id: number) {
    await this.opportunities.remove(id);
  }

  @Get(":id/products")
  @RequireScopedPermission("crm.opportunity.read")
  @ApiOperation({ summary: "List this opportunity's deal line items" })
  findProducts(@Param("id", ParseIntPipe) id: number) {
    return this.lineItems.findAll(id);
  }

  @Post(":id/products")
  @RequireScopedPermission("crm.opportunity.write")
  @ApiOperation({
    summary:
      "Add one or more products to this deal, snapshotting name/unitPrice/taxPercent from the live catalog at this moment",
  })
  addProducts(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: AddOpportunityProductsDto,
  ) {
    return this.lineItems.addItems(id, dto);
  }

  @Patch(":id/products/:itemId")
  @RequireScopedPermission("crm.opportunity.write")
  @ApiOperation({
    summary: "Update a line item's quantity/discount (recomputes its total)",
  })
  updateProduct(
    @Param("id", ParseIntPipe) id: number,
    @Param("itemId", ParseIntPipe) itemId: number,
    @Body() dto: UpdateOpportunityProductDto,
  ) {
    return this.lineItems.updateItem(id, itemId, dto);
  }

  @Delete(":id/products/:itemId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireScopedPermission("crm.opportunity.write")
  @ApiOperation({ summary: "Soft-delete a line item" })
  async removeProduct(
    @Param("id", ParseIntPipe) id: number,
    @Param("itemId", ParseIntPipe) itemId: number,
  ) {
    await this.lineItems.removeItem(id, itemId);
  }
}
