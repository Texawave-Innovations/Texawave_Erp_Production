import { Module } from "@nestjs/common";
import { FollowUpsController } from "./follow-ups.controller.js";
import { FollowUpsRepository } from "./follow-ups.repository.js";
import { FollowUpsService } from "./follow-ups.service.js";

@Module({
  controllers: [FollowUpsController],
  providers: [FollowUpsRepository, FollowUpsService],
  exports: [FollowUpsRepository, FollowUpsService],
})
export class FollowUpsModule {}
