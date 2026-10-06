import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Paginate } from "../../../../common/decorators/paginate.decorator.js";
import { RequireScopedPermission } from "../../../../common/decorators/require-permission.decorator.js";
import {
  CreateSalaryDto,
  QuerySalaryDto,
  UpdateSalaryDto,
} from "./dto/salary.dto.js";
import { SalariesService } from "./salaries.service.js";

@ApiTags("hr-salaries")
@Controller("hr/salaries")
export class SalariesController {
  constructor(private readonly service: SalariesService) {}

  @Post()
  @RequireScopedPermission("hr.salary.write")
  @ApiOperation({ summary: "Create effective-dated salary structure" })
  create(@Body() dto: CreateSalaryDto) {
    return this.service.create(dto);
  }

  @Get()
  @RequireScopedPermission("hr.salary.read")
  @ApiOperation({
    summary: "List salary structures with filtering and pagination",
  })
  findAll(@Paginate(QuerySalaryDto) query: QuerySalaryDto) {
    return this.service.findAll(query);
  }

  @Get("applicable")
  @RequireScopedPermission("hr.salary.read")
  @ApiOperation({ summary: "Get current applicable salary for an employee" })
  findApplicable(
    @Query("employeeId", ParseIntPipe) employeeId: number,
    @Query("date") date?: string,
  ) {
    return this.service.findApplicableOn(employeeId, date);
  }

  @Get(":id")
  @RequireScopedPermission("hr.salary.read")
  @ApiOperation({ summary: "Get salary structure by id" })
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Patch(":id")
  @RequireScopedPermission("hr.salary.write")
  @ApiOperation({ summary: "Update salary structure" })
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateSalaryDto) {
    return this.service.update(id, dto);
  }
}
