import { Type } from "class-transformer";
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
} from "class-validator";
import { PaginationDto } from "../../../../../common/dto/pagination.dto.js";

export class CreatePaymentBatchDto {
  @Type(() => Number)
  @IsInt()
  payrollPeriodId!: number;

  @IsOptional()
  @IsString()
  @IsIn(["BANK_TRANSFER", "CASH", "CHEQUE"])
  paymentMethod?: string;
}

export class QueryPaymentBatchDto extends PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  payrollPeriodId?: number;

  @IsOptional()
  @IsString()
  @IsIn(["PENDING", "PROCESSING", "PROCESSED", "CANCELLED"])
  status?: string;
}

export class UpdatePaymentDto {
  @IsOptional()
  @IsString()
  @IsIn(["PENDING", "PAID", "FAILED", "CANCELLED"])
  status?: string;

  @IsOptional()
  @IsString()
  bankReference?: string;

  @IsOptional()
  @IsDateString()
  creditedAt?: string;
}
