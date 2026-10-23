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
import { ApiTags } from "@nestjs/swagger";
import { Paginate } from "../../../common/decorators/paginate.decorator.js";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator.js";
import {
  CreateCrmTaskDto,
  QueryCrmTaskDto,
  UpdateCrmTaskDto,
  UpdateCrmTaskStatusDto,
} from "./dto/task.dto.js";
import { CrmTasksService } from "./tasks.service.js";

@ApiTags("crm-tasks")
@Controller("crm/tasks")
export class CrmTasksController {
  constructor(private readonly tasks: CrmTasksService) {}

  @Get()
  @RequirePermission("crm.task.read")
  findAll(@Paginate(QueryCrmTaskDto) query: QueryCrmTaskDto) {
    return this.tasks.findAll(query);
  }

  @Get(":id")
  @RequirePermission("crm.task.read")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.tasks.findOne(id);
  }

  @Post()
  @RequirePermission("crm.task.write")
  create(@Body() dto: CreateCrmTaskDto) {
    return this.tasks.create(dto);
  }

  @Patch(":id")
  @RequirePermission("crm.task.write")
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateCrmTaskDto) {
    return this.tasks.update(id, dto);
  }

  @Patch(":id/status")
  @RequirePermission("crm.task.write")
  updateStatus(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateCrmTaskStatusDto,
  ) {
    return this.tasks.updateStatus(id, dto);
  }

  @Delete(":id")
  @RequirePermission("crm.task.delete")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.tasks.remove(id);
  }
}
