import { Module } from "@nestjs/common";
import { InterviewsController } from "./interviews.controller.js";
import { InterviewsRepository } from "./interviews.repository.js";
import { InterviewsService } from "./interviews.service.js";

@Module({
  controllers: [InterviewsController],
  providers: [InterviewsRepository, InterviewsService],
})
export class InterviewsModule {}
