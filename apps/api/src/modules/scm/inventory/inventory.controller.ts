import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Paginate } from "../../../common/decorators/paginate.decorator.js";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator.js";
import {
  CreateAdjustmentDto,
  CreateBatchDto,
  CreateReservationDto,
  CreateSerialsDto,
  CreateTransferDto,
  OpeningBalanceDto,
  QueryInventoryDocsDto,
  QueryLedgerDto,
  QueryOverviewDto,
  ReleaseReservationDto,
  UpdateBatchStatusDto,
  UpdateSerialStatusDto,
} from "./dto/inventory.dto.js";
import { InventoryService } from "./inventory.service.js";

/** Migrated from the LEGACY TexaWave_ERP_old/src/modules/scm/inventory.
 * Reading needs scm.inventory.read, mutating scm.inventory.write, and
 * approving a transfer/adjustment scm.inventory.approve (legacy had one
 * module-level boolean for all of it). */
@ApiTags("scm-inventory")
@Controller("scm/inventory")
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get("overview")
  @RequirePermission("scm.inventory.read")
  overview(@Paginate(QueryOverviewDto) query: QueryOverviewDto) {
    return this.inventory.overview(query);
  }

  @Get("overview/kpis")
  @RequirePermission("scm.inventory.read")
  kpis(@Paginate(QueryOverviewDto) query: QueryOverviewDto) {
    return this.inventory.overviewKpis(query);
  }

  @Get("overview/:productId")
  @RequirePermission("scm.inventory.read")
  productDetail(@Param("productId", ParseIntPipe) productId: number) {
    return this.inventory.productDetail(productId);
  }

  @Get("ledger")
  @RequirePermission("scm.inventory.read")
  ledger(@Paginate(QueryLedgerDto) query: QueryLedgerDto) {
    return this.inventory.ledger(query);
  }

  @Post("opening-balance")
  @RequirePermission("scm.inventory.write")
  openingBalance(@Body() dto: OpeningBalanceDto) {
    return this.inventory.postOpeningBalance(dto);
  }

  // reservations
  @Get("reservations")
  @RequirePermission("scm.inventory.read")
  reservations(@Paginate(QueryInventoryDocsDto) query: QueryInventoryDocsDto) {
    return this.inventory.reservations(query);
  }

  @Post("reservations")
  @RequirePermission("scm.inventory.write")
  createReservation(@Body() dto: CreateReservationDto) {
    return this.inventory.createReservation(dto);
  }

  @Post("reservations/:id/release")
  @RequirePermission("scm.inventory.write")
  releaseReservation(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ReleaseReservationDto,
  ) {
    return this.inventory.releaseReservation(id, dto.status);
  }

  // transfers
  @Get("transfers")
  @RequirePermission("scm.inventory.read")
  transfers(@Paginate(QueryInventoryDocsDto) query: QueryInventoryDocsDto) {
    return this.inventory.transfers(query);
  }

  @Post("transfers")
  @RequirePermission("scm.inventory.write")
  createTransfer(@Body() dto: CreateTransferDto) {
    return this.inventory.createTransfer(dto);
  }

  @Post("transfers/:id/approve")
  @RequirePermission("scm.inventory.approve")
  approveTransfer(@Param("id", ParseIntPipe) id: number) {
    return this.inventory.transitionTransfer(id, "approve");
  }

  @Post("transfers/:id/dispatch")
  @RequirePermission("scm.inventory.write")
  dispatchTransfer(@Param("id", ParseIntPipe) id: number) {
    return this.inventory.transitionTransfer(id, "dispatch");
  }

  @Post("transfers/:id/receive")
  @RequirePermission("scm.inventory.write")
  receiveTransfer(@Param("id", ParseIntPipe) id: number) {
    return this.inventory.transitionTransfer(id, "receive");
  }

  @Post("transfers/:id/cancel")
  @RequirePermission("scm.inventory.write")
  cancelTransfer(@Param("id", ParseIntPipe) id: number) {
    return this.inventory.transitionTransfer(id, "cancel");
  }

  // adjustments
  @Get("adjustments")
  @RequirePermission("scm.inventory.read")
  adjustments(@Paginate(QueryInventoryDocsDto) query: QueryInventoryDocsDto) {
    return this.inventory.adjustments(query);
  }

  @Post("adjustments")
  @RequirePermission("scm.inventory.write")
  createAdjustment(@Body() dto: CreateAdjustmentDto) {
    return this.inventory.createAdjustment(dto);
  }

  @Post("adjustments/:id/approve")
  @RequirePermission("scm.inventory.approve")
  approveAdjustment(@Param("id", ParseIntPipe) id: number) {
    return this.inventory.decideAdjustment(id, "APPROVED");
  }

  @Post("adjustments/:id/reject")
  @RequirePermission("scm.inventory.approve")
  rejectAdjustment(@Param("id", ParseIntPipe) id: number) {
    return this.inventory.decideAdjustment(id, "REJECTED");
  }

  // batches
  @Get("batches")
  @RequirePermission("scm.inventory.read")
  batches(@Paginate(QueryInventoryDocsDto) query: QueryInventoryDocsDto) {
    return this.inventory.batches(query);
  }

  @Post("batches")
  @RequirePermission("scm.inventory.write")
  createBatch(@Body() dto: CreateBatchDto) {
    return this.inventory.createBatch(dto);
  }

  @Patch("batches/:id/status")
  @RequirePermission("scm.inventory.write")
  setBatchStatus(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateBatchStatusDto,
  ) {
    return this.inventory.setBatchStatus(id, dto);
  }

  // serials
  @Get("serials")
  @RequirePermission("scm.inventory.read")
  serials(@Paginate(QueryInventoryDocsDto) query: QueryInventoryDocsDto) {
    return this.inventory.serials(query);
  }

  @Post("serials")
  @RequirePermission("scm.inventory.write")
  createSerials(@Body() dto: CreateSerialsDto) {
    return this.inventory.createSerials(dto);
  }

  @Patch("serials/:id/status")
  @RequirePermission("scm.inventory.write")
  setSerialStatus(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateSerialStatusDto,
  ) {
    return this.inventory.setSerialStatus(id, dto);
  }
}
