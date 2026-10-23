import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from "class-validator";
import { Trim } from "../../../../common/dto/transforms.js";

/** Migrated from the LIVE legacy TexaWave_ERP/src/modules/crm/domain/
 * pipelineStagesService.ts `createPipelineStage`. `order` defaults to
 * "end of the list" when omitted (resolved in the service, not here,
 * since it needs to know the current count). `isWon`/`isLost`/`isOnHold`
 * are not settable through this DTO — those three flags are fixed by the
 * legacy seed (`won`/`lost`/`on_hold`) and a custom stage is always a
 * plain mid-pipeline stage, matching legacy's create dialog (no
 * won/lost/on-hold checkboxes exist there). */
export class CreatePipelineStageDto {
  @ApiProperty({ example: "Technical Evaluation" })
  @Trim()
  @IsString()
  @Length(1, 100)
  label!: string;

  @ApiPropertyOptional({ description: "Defaults to the end of the list" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  order?: number;

  @ApiPropertyOptional({ default: 7 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  slaDays?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  probability?: number;
}

export class UpdatePipelineStageDto extends PartialType(
  CreatePipelineStageDto,
) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ReorderPipelineStagesDto {
  @ApiProperty({
    type: [Number],
    description:
      "Every active stage id for this organization, in the new order",
  })
  @IsArray()
  @ArrayMinSize(1)
  @Type(() => Number)
  @IsInt({ each: true })
  orderedIds!: number[];
}
