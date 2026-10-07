import { Module } from "@nestjs/common";
import { ProfilesController } from "./profiles.controller.js";
import { ProfilesRepository } from "./profiles.repository.js";
import { ProfilesService } from "./profiles.service.js";

@Module({
  controllers: [ProfilesController],
  providers: [ProfilesRepository, ProfilesService],
})
export class ProfilesModule {}
