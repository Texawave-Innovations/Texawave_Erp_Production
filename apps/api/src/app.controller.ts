import { Controller, Get } from "@nestjs/common";
import { Public } from "./common/decorators/public.decorator.js";
import { AppService } from "./app.service.js";

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  // Kept public — this predates the global JwtAuthGuard added in this
  // foundation work, and marking it @Public() is the minimal change to keep
  // its existing behavior rather than requiring auth on the root route.
  @Public()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
