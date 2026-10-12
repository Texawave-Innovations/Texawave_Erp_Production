import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { IsOptional, IsString, Length } from "class-validator";
import { PaginationDto } from "../../../../common/dto/pagination.dto.js";
import { Trim } from "../../../../common/dto/transforms.js";

/** Minimal CRM Account foundation (Phase 4B) — only the fields legacy
 * Contacts.tsx actually reads off an account (`id`, `name`). The full
 * Account-360 feature set is explicitly out of scope for this phase. */
export class CreateAccountDto {
  @ApiProperty({ example: "Acme Corp" })
  @Trim()
  @IsString()
  @Length(1, 200)
  name!: string;
}

export class UpdateAccountDto extends PartialType(CreateAccountDto) {}

export class QueryAccountDto extends PaginationDto {
  @ApiPropertyOptional({ description: "Name contains (case-insensitive)" })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 100)
  search?: string;
}
