import { Module } from "@nestjs/common";
import { ShiftAssignmentsController } from "./shift-assignments.controller.js";
import { ShiftAssignmentsRepository } from "./shift-assignments.repository.js";
import { ShiftAssignmentsService } from "./shift-assignments.service.js";
import { ShiftQueryService } from "./shift-query.service.js";

@Module({
  controllers: [ShiftAssignmentsController],
  providers: [
    ShiftAssignmentsRepository,
    ShiftAssignmentsService,
    ShiftQueryService,
  ],
  // Only the public lookup leaves this module — never a repository.
  exports: [ShiftQueryService],
})
export class ShiftAssignmentsModule {}
