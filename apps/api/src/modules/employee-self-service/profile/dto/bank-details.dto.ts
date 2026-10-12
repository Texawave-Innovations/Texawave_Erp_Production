import {
  ACCOUNT_NUMBER,
  IFSC,
  Pattern,
  OptionalName,
  RequiredName,
} from "./onboarding-rules.js";

export class BankDetailsDto {
  @RequiredName()
  accountHolderName!: string;

  @Pattern(ACCOUNT_NUMBER.regex, ACCOUNT_NUMBER.message)
  accountNumber!: string;

  @Pattern(IFSC.regex, IFSC.message)
  ifsc!: string;

  @RequiredName()
  bankName!: string;

  @OptionalName()
  branchName?: string;
}
