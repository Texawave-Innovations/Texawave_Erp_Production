import { OmitType, PartialType } from "@nestjs/swagger";
import { CreateLeaveTypeDto } from "./create-leave-type.dto.js";

/** `code` is immutable — other records and integrations refer to it. */
export class UpdateLeaveTypeDto extends PartialType(
  OmitType(CreateLeaveTypeDto, ["code"] as const),
) {}
