import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Paginate } from "../../../common/decorators/paginate.decorator.js";
import { RequireScopedPermission } from "../../../common/decorators/require-permission.decorator.js";
import {
  CreatePromotionLetterDto,
  QueryPromotionLetterDto,
  UpdatePromotionLetterDto,
} from "./dto/promotion-letter.dto.js";
import { PromotionLettersService } from "./promotion-letters.service.js";

/** Recruitment → Promotion Letter. Team-scoped through the employee, exactly
 * like revision letters: reads and writes are own/team/all, a row outside the
 * caller's scope is a 404, and there is no delete route. The designation
 * dropdown is served by `/master-data/designations`. */
@ApiTags("hr-promotion-letters")
@Controller("hr/promotion-letters")
export class PromotionLettersController {
  constructor(private readonly letters: PromotionLettersService) {}

  @Get()
  @RequireScopedPermission("hr.promotion_letter.read")
  @ApiOperation({ summary: "Promotion letters in the caller's scope" })
  findAll(@Paginate(QueryPromotionLetterDto) query: QueryPromotionLetterDto) {
    return this.letters.findAll(query);
  }

  @Get("salary-history/:employeeId")
  @RequireScopedPermission("hr.promotion_letter.read")
  @ApiOperation({
    summary:
      "An employee's past revision and promotion letters, newest effective date first",
  })
  salaryHistory(@Param("employeeId", ParseIntPipe) employeeId: number) {
    return this.letters.salaryHistory(employeeId);
  }

  @Get(":id")
  @RequireScopedPermission("hr.promotion_letter.read")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.letters.findOne(id);
  }

  @Post()
  @RequireScopedPermission("hr.promotion_letter.write")
  @ApiOperation({ summary: "Issue a promotion letter to an employee in scope" })
  create(@Body() dto: CreatePromotionLetterDto) {
    return this.letters.create(dto);
  }

  @Patch(":id")
  @RequireScopedPermission("hr.promotion_letter.write")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdatePromotionLetterDto,
  ) {
    return this.letters.update(id, dto);
  }
}
