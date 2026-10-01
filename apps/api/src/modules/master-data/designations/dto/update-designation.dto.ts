import { OmitType, PartialType } from "@nestjs/swagger";
import { CreateDesignationDto } from "./create-designation.dto.js";

/** `code` is immutable — other records and integrations refer to it. */
export class UpdateDesignationDto extends PartialType(
  OmitType(CreateDesignationDto, ["code"] as const),
) {}
