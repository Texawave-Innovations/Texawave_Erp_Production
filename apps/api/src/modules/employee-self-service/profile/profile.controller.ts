import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator.js";
import { ProfileService } from "./profile.service.js";

/** Its own permission namespace, so an employee's role never needs `hr.*`. */
@ApiTags("employee-self-service")
@Controller("self-service/profile")
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

  @Get()
  @RequirePermission("employee_self_service.profile.read")
  @ApiOperation({ summary: "The authenticated user's own employee record" })
  getMine() {
    return this.profile.getMyProfile();
  }
}
