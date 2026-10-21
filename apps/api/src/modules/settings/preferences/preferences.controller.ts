import { Body, Controller, Get, Patch, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { UpdateUserPreferencesDto } from "./dto/update-user-preferences.dto.js";
import { PreferencesService } from "./preferences.service.js";

@ApiTags("settings-preferences")
@Controller("settings/preferences")
export class PreferencesController {
  constructor(private readonly service: PreferencesService) {}

  @Get()
  @ApiOperation({
    summary:
      "Get current user's preferences, effective preferences with org fallback, and org defaults",
  })
  getPreferences() {
    return this.service.getPreferences();
  }

  @Patch()
  @ApiOperation({
    summary: "Update current user's personal preferences",
  })
  updatePreferences(@Body() dto: UpdateUserPreferencesDto) {
    return this.service.updatePreferences(dto);
  }

  @Post("reset")
  @ApiOperation({
    summary: "Reset current user's preferences to organization defaults",
  })
  resetPreferences() {
    return this.service.resetPreferences();
  }
}
