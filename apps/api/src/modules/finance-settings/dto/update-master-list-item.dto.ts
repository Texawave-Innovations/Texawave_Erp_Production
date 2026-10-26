import { OmitType, PartialType } from "@nestjs/swagger";
import { CreateMasterListItemDto } from "./create-master-list-item.dto.js";

/** `category` is immutable — move the value by deleting and re-creating it
 * under the right category instead. */
export class UpdateMasterListItemDto extends PartialType(
  OmitType(CreateMasterListItemDto, ["category"] as const),
) {}
