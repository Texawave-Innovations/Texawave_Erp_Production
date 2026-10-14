import { Module } from "@nestjs/common";
import { RevisionLettersController } from "./revision-letters.controller.js";
import { RevisionLettersRepository } from "./revision-letters.repository.js";
import { RevisionLettersService } from "./revision-letters.service.js";

@Module({
  controllers: [RevisionLettersController],
  providers: [RevisionLettersRepository, RevisionLettersService],
})
export class RevisionLettersModule {}
