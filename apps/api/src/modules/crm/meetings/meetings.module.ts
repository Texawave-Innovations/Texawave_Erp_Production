import { Module } from "@nestjs/common";
import { MeetingsController } from "./meetings.controller.js";
import { MeetingsRepository } from "./meetings.repository.js";
import { MeetingsService } from "./meetings.service.js";

@Module({
  controllers: [MeetingsController],
  providers: [MeetingsRepository, MeetingsService],
})
export class MeetingsModule {}
