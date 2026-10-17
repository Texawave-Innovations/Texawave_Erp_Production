import { ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Validate,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from "class-validator";
import { PaginationDto } from "../../../../common/dto/pagination.dto.js";
import { Trim } from "../../../../common/dto/transforms.js";

export const MINING_PRIORITIES = ["High", "Medium", "Low"] as const;

@ValidatorConstraint({ name: "stringRecord", async: false })
class StringRecordConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (value === null || typeof value !== "object" || Array.isArray(value))
      return false;
    return Object.values(value).every((v) => typeof v === "string");
  }
  defaultMessage(): string {
    return "customFields must be an object of string values";
  }
}

/** Optional trimmed free-text column. */
function opt(max: number): PropertyDecorator {
  return (target, key) => {
    ApiPropertyOptional()(target, key);
    IsOptional()(target, key);
    Trim()(target, key);
    IsString()(target, key);
    Length(0, max)(target, key);
  };
}

/** Mirrors legacy `AccountsMiningRow` (AccountsMiningSheet.tsx). Every
 * column is free text and only `companyName` is required. Legacy `date`
 * is `minedDate` here. */
export class CreateCrmMiningRowDto {
  @opt(50) serialNo?: string;
  @opt(40) minedDate?: string;
  @opt(200) domain?: string;

  @Trim()
  @IsString()
  @Length(1, 200)
  companyName!: string;

  @opt(200) hq?: string;
  @opt(300) website?: string;
  @opt(2000) keyDecisionMakers?: string;
  @opt(150) title?: string;
  @opt(100) contactNumber?: string;
  @opt(200) email?: string;
  @opt(100) emailStatus?: string;
  @opt(200) followUpStatus?: string;
  @opt(150) industry?: string;
  @opt(50) numberOfEmployees?: string;
  @opt(100) city?: string;
  @opt(100) state?: string;
  @opt(100) country?: string;
  @opt(300) linkedInProfile?: string;
  @opt(150) assignedTo?: string;

  @ApiPropertyOptional({ enum: MINING_PRIORITIES })
  @IsOptional()
  @IsIn(["", ...MINING_PRIORITIES])
  priority?: string;

  @opt(40) nextFollowUpDate?: string;
  @opt(5000) notes?: string;

  /** Bulk-Import-discovered fields (legacy `customFields`): free-form
   * key to string map, stored as-is. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  @Validate(StringRecordConstraint)
  customFields?: Record<string, string>;
}

export class UpdateCrmMiningRowDto extends PartialType(CreateCrmMiningRowDto) {}

export class QueryCrmMiningRowDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  search?: string;
}
