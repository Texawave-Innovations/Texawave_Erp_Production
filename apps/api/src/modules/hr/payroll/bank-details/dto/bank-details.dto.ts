import { Transform } from "class-transformer";
import { IsNotEmpty, IsOptional, IsString, Matches } from "class-validator";

const upperTrim = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim().toUpperCase() : value;

export class UpsertBankDetailsDto {
  @IsString()
  @IsNotEmpty()
  bankName!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.replace(/\s+/g, "") : value,
  )
  @IsString()
  @IsNotEmpty()
  @Matches(/^[0-9A-Za-z]{6,20}$/, {
    message: "accountNumber must be 6-20 letters or digits",
  })
  accountNumber!: string;

  @Transform(upperTrim)
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z]{4}0[A-Z0-9]{6}$/, {
    message:
      "ifscCode must be a valid 11-character Indian IFSC code (e.g. HDFC0001234)",
  })
  ifscCode!: string;

  @IsOptional()
  @Transform(upperTrim)
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
