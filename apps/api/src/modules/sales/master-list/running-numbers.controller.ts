import { Body, Controller, Get, Param, Patch, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator.js";
import {
  RunningNumbersQueryDto,
  SetRunningNumberDto,
} from "./dto/running-number.dto.js";
import { RunningNumbersService } from "./running-numbers.service.js";

/** Sales master list → running numbers (quotation, PI, tax invoice, DC).
 * Prefix and width stay under /sales/master/code-formats. */
@ApiTags("sales-master-list")
@Controller("sales/master/running-numbers")
export class RunningNumbersController {
  constructor(private readonly numbers: RunningNumbersService) {}

  @Get()
  @RequirePermission("sales.master.read")
  @ApiOperation({
    summary: "Last and next number of each document for a financial year",
  })
  findAll(@Query() query: RunningNumbersQueryDto) {
    return this.numbers.findAll(query.date);
  }

  @Patch(":codeType")
  @RequirePermission("sales.running_number.write")
  @ApiOperation({
    summary:
      "Set the last number used (100 → next is …/0101); never below an issued number",
  })
  setLastNumber(
    @Param("codeType") codeType: string,
    @Body() dto: SetRunningNumberDto,
  ) {
    return this.numbers.setLastNumber(codeType, dto);
  }
}
