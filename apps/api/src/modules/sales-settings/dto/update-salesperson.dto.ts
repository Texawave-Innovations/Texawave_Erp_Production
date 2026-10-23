import { PartialType } from "@nestjs/swagger";
import { CreateSalespersonDto } from "./create-salesperson.dto.js";

export class UpdateSalespersonDto extends PartialType(CreateSalespersonDto) {}
