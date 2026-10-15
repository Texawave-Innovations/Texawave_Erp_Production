import { Module } from "@nestjs/common";
import { CodeFormatsController } from "./code-formats.controller.js";
import { CodeFormatsRepository } from "./code-formats.repository.js";
import { CodeFormatsService } from "./code-formats.service.js";

/** Sales master list. Each Sales tab adds its configurable items here. */
@Module({
  controllers: [CodeFormatsController],
  providers: [CodeFormatsRepository, CodeFormatsService],
  // Read by modules that issue codes (getFormat) — the repository stays private.
  exports: [CodeFormatsService],
})
export class SalesMasterListModule {}
