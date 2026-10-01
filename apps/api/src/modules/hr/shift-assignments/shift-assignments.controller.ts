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
import { RequireScopedPermission } from "../../../common/decorators/require-permission.decorator.js";
import {
  CreateShiftAssignmentDto,
  EndShiftAssignmentDto,
  QueryShiftAssignmentDto,
  ResolveShiftQueryDto,
  VoidShiftAssignmentDto,
} from "./dto/shift-assignment.dto.js";
import { ShiftAssignmentsService } from "./shift-assignments.service.js";

/** Team-scoped (`hr.shift_assignment.read/write` are seeded `.own/.team/.all`).
 * Assignments are never edited in place or deleted: a change of shift ends the
 * old assignment and creates a new one; a mistake is voided. */
@ApiTags("hr-shift-assignments")
@Controller("hr/shift-assignments")
export class ShiftAssignmentsController {
  constructor(private readonly assignments: ShiftAssignmentsService) {}

  @Get()
  @RequireScopedPermission("hr.shift_assignment.read")
  findAll(@Paginate(QueryShiftAssignmentDto) query: QueryShiftAssignmentDto) {
    return this.assignments.findAll(query);
  }

  // Declared before ":id" so "resolve" is not read as an id.
  @Get("resolve")
  @RequireScopedPermission("hr.shift_assignment.read")
  @ApiOperation({
    summary:
      "Which shift does this employee work on this date? (employee assignment, else team default)",
  })
  resolve(@Query() query: ResolveShiftQueryDto) {
    return this.assignments.resolve(query);
  }

  @Get(":id")
  @RequireScopedPermission("hr.shift_assignment.read")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.assignments.findOne(id);
  }

  @Post()
  @RequireScopedPermission("hr.shift_assignment.write")
  @ApiOperation({
    summary: "Assign a shift to an employee or a team over a date range",
  })
  create(@Body() dto: CreateShiftAssignmentDto) {
    return this.assignments.create(dto);
  }

  @Post(":id/end")
  @HttpCode(HttpStatus.OK)
  @RequireScopedPermission("hr.shift_assignment.write")
  @ApiOperation({ summary: "End (shorten) an assignment; history is kept" })
  end(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: EndShiftAssignmentDto,
  ) {
    return this.assignments.end(id, dto);
  }

  @Post(":id/void")
  @HttpCode(HttpStatus.OK)
  @RequireScopedPermission("hr.shift_assignment.write")
  @ApiOperation({
    summary: "Mark an assignment as entered in error (kept, ignored)",
  })
  void(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: VoidShiftAssignmentDto,
  ) {
    return this.assignments.void(id, dto);
  }
}
