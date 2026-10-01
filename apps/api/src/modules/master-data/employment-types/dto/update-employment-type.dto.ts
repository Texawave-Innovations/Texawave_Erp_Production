import { OmitType, PartialType } from "@nestjs/swagger";
import { CreateEmploymentTypeDto } from "./create-employment-type.dto.js";

/** `code` is immutable — other records and integrations refer to it. */
export class UpdateEmploymentTypeDto extends PartialType(
  OmitType(CreateEmploymentTypeDto, ["code"] as const),
) {}
