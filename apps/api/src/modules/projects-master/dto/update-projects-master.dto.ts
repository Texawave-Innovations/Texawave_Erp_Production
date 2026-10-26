import { PartialType } from "@nestjs/swagger";
import { CreateProjectsMasterDto } from "./create-projects-master.dto.js";

export class UpdateProjectsMasterDto extends PartialType(
  CreateProjectsMasterDto,
) {}
