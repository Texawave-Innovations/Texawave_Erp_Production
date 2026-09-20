import { Body, Controller, Post } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator.js";
import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import type { AuthenticatedUser } from "./authenticated-user.js";
import { AuthService, type AuthTokens } from "./auth.service.js";
import { LoginDto } from "./dto/login.dto.js";
import { RefreshDto } from "./dto/refresh.dto.js";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post("login")
  @ApiOperation({
    summary: "Exchange organization + email + password for a token pair",
  })
  @ApiOkResponse({ description: "Access + refresh token pair" })
  login(@Body() dto: LoginDto): Promise<AuthTokens> {
    return this.auth.login(dto.organizationSlug, dto.email, dto.password);
  }

  @Public()
  @Post("refresh")
  @ApiOperation({
    summary: "Exchange a refresh token for a new token pair (rotates it)",
  })
  refresh(@Body() dto: RefreshDto): Promise<AuthTokens> {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post("logout")
  @ApiOperation({ summary: "Revoke all of the current user's refresh tokens" })
  async logout(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ loggedOut: true }> {
    await this.auth.logout(user.userId);
    return { loggedOut: true };
  }
}
