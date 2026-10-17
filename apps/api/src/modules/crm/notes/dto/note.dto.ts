import { IsInt, IsString, Length, Min } from "class-validator";
import { PaginationDto } from "../../../../common/dto/pagination.dto.js";

/** Legacy `CrmNote` (intelligence/notesService.ts) is scoped only to an
 * Account — never polymorphic `relatedType`/`relatedId` like Meeting/
 * FollowUp/Activity/CrmTask/CrmDocument — and has no update capability
 * (add/delete only). Reproduced the same way. */
export class CreateCrmNoteDto {
  @IsInt()
  @Min(1)
  accountId!: number;

  @IsString()
  @Length(1, 10000)
  content!: string;
}

export class QueryCrmNoteDto extends PaginationDto {}
