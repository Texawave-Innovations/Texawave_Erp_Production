import { OmitType, PartialType } from "@nestjs/swagger";
import { CreateWorkLocationDto } from "./create-work-location.dto.js";

/** `code` is immutable — other records and integrations refer to it. */
export class UpdateWorkLocationDto extends PartialType(
  OmitType(CreateWorkLocationDto, ["code"] as const),
) {}
