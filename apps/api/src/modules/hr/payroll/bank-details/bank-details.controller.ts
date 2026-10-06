import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Put,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RequireScopedPermission } from "../../../../common/decorators/require-permission.decorator.js";
import { BankDetailsService } from "./bank-details.service.js";
import { UpsertBankDetailsDto } from "./dto/bank-details.dto.js";

@ApiTags("hr-bank-details")
@Controller("hr/bank-details")
export class BankDetailsController {
  constructor(private readonly service: BankDetailsService) {}

  @Get(":employeeId")
  @RequireScopedPermission("hr.salary.read")
  @ApiOperation({ summary: "Get employee bank details" })
  findByEmployeeId(@Param("employeeId", ParseIntPipe) employeeId: number) {
    return this.service.findByEmployeeId(employeeId);
  }

  @Put(":employeeId")
  @HttpCode(HttpStatus.OK)
  @RequireScopedPermission("hr.salary.write")
  @ApiOperation({ summary: "Upsert employee bank details" })
  upsert(
    @Param("employeeId", ParseIntPipe) employeeId: number,
    @Body() dto: UpsertBankDetailsDto,
  ) {
    return this.service.upsert(employeeId, dto);
  }
}
