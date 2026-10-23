import { Body, Controller, Get, Put } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RequirePermission } from "../../common/decorators/require-permission.decorator.js";
import { AuthorizedSignatoryService } from "./authorized-signatory.service.js";
import { UpsertAuthorizedSignatoryDto } from "./dto/upsert-authorized-signatory.dto.js";

/** Bank & Signatory tab (signatory half) of Sales Settings. */
@ApiTags("sales-settings-authorized-signatory")
@Controller("sales-settings/authorized-signatory")
export class AuthorizedSignatoryController {
  constructor(private readonly signatory: AuthorizedSignatoryService) {}

  @Get()
  @RequirePermission("sales_settings.authorized_signatory.read")
  findOne() {
    return this.signatory.findOne();
  }

  @Put()
  @RequirePermission("sales_settings.authorized_signatory.write")
  @ApiOperation({ summary: "Create or replace the authorized signatory" })
  upsert(@Body() dto: UpsertAuthorizedSignatoryDto) {
    return this.signatory.upsert(dto);
  }
}
