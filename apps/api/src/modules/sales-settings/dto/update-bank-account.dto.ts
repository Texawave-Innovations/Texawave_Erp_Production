import { PartialType } from "@nestjs/swagger";
import { CreateBankAccountDto } from "./create-bank-account.dto.js";

export class UpdateBankAccountDto extends PartialType(CreateBankAccountDto) {}
