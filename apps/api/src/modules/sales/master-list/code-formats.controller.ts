import { Body, Controller, Get, Param, Patch } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator.js";
import { CodeFormatsService } from "./code-formats.service.js";
import { UpdateCodeFormatDto } from "./dto/code-format.dto.js";

const READ = "sales.master.read";
const WRITE = "sales.master.write";

/** Sales master list → code formats (customer codes and document numbers). */
@ApiTags("sales-master-list")
@Controller("sales/master/code-formats")
export class CodeFormatsController {
  constructor(private readonly formats: CodeFormatsService) {}

  @Get()
  @RequirePermission(READ)
  @ApiOperation({
    summary: "Every code format, with defaults for unedited ones",
  })
  findAll() {
    return this.formats.findAll();
  }

  @Get(":codeType")
  @RequirePermission(READ)
  findOne(@Param("codeType") codeType: string) {
    return this.formats.findOne(codeType);
  }

  @Patch(":codeType")
  @RequirePermission(WRITE)
  @ApiOperation({
    summary: "Change a prefix or width; only codes issued afterwards change",
  })
  update(
    @Param("codeType") codeType: string,
    @Body() dto: UpdateCodeFormatDto,
  ) {
    return this.formats.update(codeType, dto);
  }
}
