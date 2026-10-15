import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Min,
  ValidateNested,
} from "class-validator";
import { IsDateOnly } from "../../../../common/dates/date-only.js";
import { Trim } from "../../../../common/dto/transforms.js";
import {
  DispatchLineDto,
  DocumentQueryDto,
  MAX_LINES,
} from "./document-parts.dto.js";

export const DC_STATUSES = ["DRAFT", "DISPATCHED"] as const;
export type DcStatus = (typeof DC_STATUSES)[number];

export class CreateDeliveryChallanDto {
  @ApiProperty({ example: 1, description: "Consignee" })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  customerId!: number;

  @ApiProperty({ example: "2026-10-15" })
  @IsDateOnly()
  dcDate!: string;

  @ApiProperty({ type: [DispatchLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_LINES)
  @ValidateNested({ each: true })
  @Type(() => DispatchLineDto)
  lines!: DispatchLineDto[];

  @ApiPropertyOptional({ enum: DC_STATUSES, default: "DRAFT" })
  @IsOptional()
  @IsIn(DC_STATUSES)
  status?: DcStatus;

  @ApiPropertyOptional({ example: "Texawave Official Corporate Seal" })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 150)
  sealName?: string | null;

  @ApiPropertyOptional({ example: "Managing Director Signature" })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 150)
  signatureName?: string | null;

  @ApiPropertyOptional({ example: "Rafic" })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 150)
  preparedBy?: string | null;

  @ApiPropertyOptional({
    example:
      "Goods dispatched via this Delivery Challan are for delivery/transit purposes only and carry no commercial sale value.",
  })
  @IsOptional()
  @IsString()
  @Length(0, 2000)
  notes?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;
}

/** `lines`, when sent, replace every line. */
export class UpdateDeliveryChallanDto extends PartialType(
  CreateDeliveryChallanDto,
) {}

export class QueryDeliveryChallanDto extends DocumentQueryDto {
  @ApiPropertyOptional({ enum: DC_STATUSES })
  @IsOptional()
  @IsIn(DC_STATUSES)
  status?: DcStatus;
}
