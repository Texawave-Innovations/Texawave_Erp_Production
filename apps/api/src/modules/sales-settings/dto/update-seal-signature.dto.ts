import { PartialType } from "@nestjs/swagger";
import { CreateSealSignatureDto } from "./create-seal-signature.dto.js";

export class UpdateSealSignatureDto extends PartialType(
  CreateSealSignatureDto,
) {}
