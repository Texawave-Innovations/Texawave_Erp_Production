import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Paginate } from "../../../common/decorators/paginate.decorator.js";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator.js";
import {
  CreateDefectDto,
  CreateInspectionDto,
  CreateTemplateDto,
  QcReasonDto,
  QuarantineActionDto,
  QueryActivityDto,
  QueryDefectDto,
  QueryInspectionDto,
  QueryQuarantineDto,
  QuerySourcesDto,
  QueryTemplateDto,
  RecordItemResultDto,
  StartInspectionDto,
  UpdateDefectDto,
  UpdateTemplateDto,
} from "./dto/quality.dto.js";
import { QualityService } from "./quality.service.js";

/** Legacy `ScmQualityDashboard` / `ScmQualityActivity`. */
@ApiTags("scm-quality")
@Controller("scm/quality")
export class QualityController {
  constructor(private readonly svc: QualityService) {}

  @Get("dashboard")
  @RequirePermission("scm.quality.read")
  dashboard() {
    return this.svc.dashboard();
  }

  @Get("activity")
  @RequirePermission("scm.quality.read")
  activity(@Paginate(QueryActivityDto) query: QueryActivityDto) {
    return this.svc.listActivity(query);
  }
}

/** Legacy `ScmQualityDefects`. */
@ApiTags("scm-quality")
@Controller("scm/quality/defects")
export class QualityDefectsController {
  constructor(private readonly svc: QualityService) {}

  @Get()
  @RequirePermission("scm.quality.read")
  list(@Paginate(QueryDefectDto) query: QueryDefectDto) {
    return this.svc.listDefects(query);
  }

  @Post()
  @RequirePermission("scm.quality.write")
  create(@Body() dto: CreateDefectDto) {
    return this.svc.createDefect(dto);
  }

  @Patch(":id")
  @RequirePermission("scm.quality.write")
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateDefectDto) {
    return this.svc.updateDefect(id, dto);
  }
}

/** Legacy `ScmQualityTemplates`. */
@ApiTags("scm-quality")
@Controller("scm/quality/templates")
export class QualityTemplatesController {
  constructor(private readonly svc: QualityService) {}

  @Get()
  @RequirePermission("scm.quality.read")
  list(@Paginate(QueryTemplateDto) query: QueryTemplateDto) {
    return this.svc.listTemplates(query);
  }

  @Get(":id")
  @RequirePermission("scm.quality.read")
  get(@Param("id", ParseIntPipe) id: number) {
    return this.svc.getTemplate(id);
  }

  @Post()
  @RequirePermission("scm.quality.write")
  create(@Body() dto: CreateTemplateDto) {
    return this.svc.createTemplate(dto);
  }

  @Patch(":id")
  @RequirePermission("scm.quality.write")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateTemplateDto,
  ) {
    return this.svc.updateTemplate(id, dto);
  }
}

/** Legacy `ScmQualityInspections` / `ScmQualityInspectionDetail`. */
@ApiTags("scm-quality")
@Controller("scm/quality/inspections")
export class QualityInspectionsController {
  constructor(private readonly svc: QualityService) {}

  @Get()
  @RequirePermission("scm.quality.read")
  list(@Paginate(QueryInspectionDto) query: QueryInspectionDto) {
    return this.svc.listInspections(query);
  }

  @Get("sources")
  @RequirePermission("scm.quality.read")
  sources(@Query() query: QuerySourcesDto) {
    return this.svc.sources(query.inspectionType);
  }

  @Get(":id")
  @RequirePermission("scm.quality.read")
  get(@Param("id", ParseIntPipe) id: number) {
    return this.svc.getInspection(id);
  }

  @Post()
  @RequirePermission("scm.quality.write")
  create(@Body() dto: CreateInspectionDto) {
    return this.svc.createInspection(dto);
  }

  @Post(":id/start")
  @RequirePermission("scm.quality.write")
  start(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: StartInspectionDto,
  ) {
    return this.svc.startInspection(id, dto.inspectorName);
  }

  @Post(":id/cancel")
  @RequirePermission("scm.quality.write")
  cancel(@Param("id", ParseIntPipe) id: number, @Body() dto: QcReasonDto) {
    return this.svc.cancelInspection(id, dto.reason);
  }

  @Put(":id/items/:itemId")
  @RequirePermission("scm.quality.write")
  record(
    @Param("id", ParseIntPipe) id: number,
    @Param("itemId", ParseIntPipe) itemId: number,
    @Body() dto: RecordItemResultDto,
  ) {
    return this.svc.recordItemResult(id, itemId, dto);
  }

  @Post(":id/complete")
  @RequirePermission("scm.quality.approve")
  complete(@Param("id", ParseIntPipe) id: number) {
    return this.svc.completeInspection(id);
  }
}

/** Legacy `ScmQualityQuarantine`. */
@ApiTags("scm-quality")
@Controller("scm/quality/quarantine")
export class QualityQuarantineController {
  constructor(private readonly svc: QualityService) {}

  @Get()
  @RequirePermission("scm.quality.read")
  list(@Paginate(QueryQuarantineDto) query: QueryQuarantineDto) {
    return this.svc.listQuarantine(query);
  }

  @Post(":id/review")
  @RequirePermission("scm.quality.write")
  review(@Param("id", ParseIntPipe) id: number) {
    return this.svc.reviewQuarantine(id);
  }

  @Post(":id/release")
  @RequirePermission("scm.quality.approve")
  release(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: QuarantineActionDto,
  ) {
    return this.svc.releaseQuarantine(id, dto.notes);
  }

  @Post(":id/reject")
  @RequirePermission("scm.quality.approve")
  reject(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: QuarantineActionDto,
  ) {
    return this.svc.rejectQuarantine(id, dto.notes);
  }
}
