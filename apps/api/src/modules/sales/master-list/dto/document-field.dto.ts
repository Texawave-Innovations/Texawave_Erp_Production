import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import { Trim, UpperTrim } from "../../../../common/dto/transforms.js";
import {
  DOCUMENT_FIELDS,
  DOCUMENT_TYPES,
  type DocumentField,
  type MasterDocumentType,
} from "../document-fields.rules.js";

export class MasterBankDetailsDto {
  @ApiProperty({ example: "HDFC Bank" })
  @Trim()
  @IsString()
  @Length(1, 150)
  bankName!: string;

  @ApiProperty({ example: "235767577457" })
  @Trim()
  @Matches(/^[0-9]{6,20}$/, { message: "accountNumber must be 6-20 digits" })
  accountNumber!: string;

  @ApiPropertyOptional({ example: "Main Branch" })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 150)
  branch?: string | null;

  @ApiProperty({ example: "HDFC0001256" })
  @UpperTrim()
  @IsString()
  ifsc!: string;
}

class OptionFieldsDto {
  @ApiPropertyOptional({
    example: "30 Days",
    description:
      "The text offered. HSN: the description (default the code); bank: default 'Bank - Account (Branch)'",
  })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 200)
  label?: string | null;

  @ApiPropertyOptional({
    example: "8471",
    description: "HSN_CODE only: the 4-8 digit code",
  })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 50)
  value?: string | null;

  @ApiPropertyOptional({
    type: MasterBankDetailsDto,
    description: "BANK_ACCOUNT only",
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => MasterBankDetailsDto)
  bankDetails?: MasterBankDetailsDto | null;

  @ApiPropertyOptional({
    default: false,
    description: "Pre-selected on the form; one per document type and field",
  })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(9999)
  sortOrder?: number;
}

export class CreateDocumentFieldDto extends OptionFieldsDto {
  @ApiProperty({ enum: DOCUMENT_TYPES })
  @IsIn(DOCUMENT_TYPES)
  documentType!: MasterDocumentType;

  @ApiProperty({ enum: DOCUMENT_FIELDS })
  @IsIn(DOCUMENT_FIELDS)
  field!: DocumentField;
}

/** The document type and field of an option never change. */
export class UpdateDocumentFieldDto extends OptionFieldsDto {}

export class QueryDocumentFieldDto {
  @ApiPropertyOptional({ enum: DOCUMENT_TYPES })
  @IsOptional()
  @IsIn(DOCUMENT_TYPES)
  documentType?: MasterDocumentType;

  @ApiPropertyOptional({ enum: DOCUMENT_FIELDS })
  @IsOptional()
  @IsIn(DOCUMENT_FIELDS)
  field?: DocumentField;
}
