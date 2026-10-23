import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class AddProjectMemberDto {
  @ApiProperty({ example: 2 })
  @IsInt()
  employeeId!: number;

  @ApiPropertyOptional({ example: "Lead Engineer", default: "Contributor" })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional({ example: 80, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  estimatedHours?: number;

  @ApiPropertyOptional({ example: 50, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  hourlyRate?: number;
}
