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
import { RequirePermission } from "../../../common/decorators/require-permission.decorator.js";
import {
  CreateInterviewDto,
  QueryInterviewDto,
  UpdateInterviewStatusDto,
} from "./dto/interview.dto.js";
import { InterviewsService } from "./interviews.service.js";

/** Recruitment → Interview Schedule. Organization-wide by explicit permission
 * (no own/team/all): legacy records have no owner to scope by. There is no
 * edit, reschedule or delete route; legacy has none that the platform allows. */
@ApiTags("hr-interviews")
@Controller("hr/interviews")
export class InterviewsController {
  constructor(private readonly interviews: InterviewsService) {}

  @Get()
  @RequirePermission("hr.interview.read")
  @ApiOperation({ summary: "Interview schedule, newest first" })
  findAll(@Paginate(QueryInterviewDto) query: QueryInterviewDto) {
    return this.interviews.findAll(query);
  }

  @Get(":id")
  @RequirePermission("hr.interview.read")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.interviews.findOne(id);
  }

  @Post()
  @RequirePermission("hr.interview.write")
  @ApiOperation({ summary: "Schedule an interview (starts SCHEDULED)" })
  create(@Body() dto: CreateInterviewDto) {
    return this.interviews.create(dto);
  }

  @Patch(":id/status")
  @RequirePermission("hr.interview.write")
  @ApiOperation({ summary: "Set the status to any legacy value" })
  setStatus(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateInterviewStatusDto,
  ) {
    return this.interviews.setStatus(id, dto);
  }
}
