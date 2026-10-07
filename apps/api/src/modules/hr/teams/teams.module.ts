import { Module } from "@nestjs/common";
import { TeamsController } from "./teams.controller.js";
import { TeamsRepository } from "./teams.repository.js";

@Module({
  controllers: [TeamsController],
  providers: [TeamsRepository],
})
export class TeamsModule {}
