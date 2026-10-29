import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ProjectExpenseStatus } from "@texawave-erp/database";
import { Type } from "class-transformer";
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from "class-validator";

export class CreateExpenseDto {
  @ApiProperty({ example: 8500 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @ApiProperty({ example: "2026-08-10" })
  @IsDateString()
  expenseDate!: string;

  @ApiPropertyOptional({ example: "Software" })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional({ example: "Microcontroller World" })
  @IsOptional()
  @IsString()
  vendor?: string;

  @ApiPropertyOptional({
    example: 3,
    description:
      "SCM supplier (scm.suppliers) this expense was paid to. When set, `vendor` is filled from the supplier's company name.",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  supplierId?: number;

  @ApiPropertyOptional({ example: "INV-MC-902" })
  @IsOptional()
  @IsString()
  referenceNo?: string;

  @ApiPropertyOptional({
    enum: ProjectExpenseStatus,
    default: ProjectExpenseStatus.unpaid,
  })
  @IsOptional()
  @IsEnum(ProjectExpenseStatus)
  status?: ProjectExpenseStatus;

  @ApiPropertyOptional({ example: "PCB prototype boards" })
  @IsOptional()
  @IsString()
  notes?: string;
}
