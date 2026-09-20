import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator.js";
import { RawResponse } from "../../common/decorators/raw-response.decorator.js";
import { HealthService, type HealthStatus } from "./health.service.js";

/** Not wrapped in the `{ data, meta }` envelope (`@RawResponse()`) — a load
 * balancer / orchestrator probe expects a plain body, not one it has to
 * unwrap first (Docs/CODING_STANDARDS.md §9). */
@ApiExcludeController()
@Controller("health")
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Public()
  @RawResponse()
  @Get()
  async check(): Promise<HealthStatus> {
    const result = await this.health.check();
    if (result.status === "error") {
      throw new ServiceUnavailableException(result);
    }
    return result;
  }
}
