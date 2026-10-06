import { IsNotEmpty, IsOptional, IsString, Matches } from "class-validator";

export class UpsertBankDetailsDto {
  @IsString()
  @IsNotEmpty()
  bankName!: string;

  @IsString()
  @IsNotEmpty()
  accountNumber!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z]{4}0[A-Z0-9]{6}$/, {
    message:
      "ifscCode must be a valid 11-character Indian IFSC code (e.g. HDFC0001234)",
  })
  ifscCode!: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, {
    message: "panNumber must be a valid 10-character PAN (e.g. ABCDE1234F)",
  })
  panNumber?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{12}$/, {
    message: "aadhaarNumber must be a 12-digit number",
  })
  aadhaarNumber?: string;
}
