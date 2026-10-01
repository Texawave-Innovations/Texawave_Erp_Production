import { OmitType, PartialType } from "@nestjs/swagger";
import { CreateShiftDto } from "./create-shift.dto.js";

/** `code` is immutable — other records and integrations refer to it. */
export class UpdateShiftDto extends PartialType(
  OmitType(CreateShiftDto, ["code"] as const),
) {}
