import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from "class-validator";
import { Trim } from "../../../common/dto/transforms.js";

export class CreateBankAccountDto {
  @ApiProperty()
  @Trim()
  @IsString()
  @Length(1, 200)
  bankName!: string;

  @ApiProperty()
  @Trim()
  @IsString()
  @Length(1, 200)
  accountHolderName!: string;

  @ApiProperty()
  @Trim()
  @IsString()
  @Length(1, 30)
  accountNumber!: string;

  @ApiProperty()
  @Trim()
  @IsString()
  @Length(1, 20)
  ifscCode!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(200)
  branchName?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @ApiPropertyOptional({
    description: "Arbitrary extra fields, not queried/filtered/joined",
  })
  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;
}
