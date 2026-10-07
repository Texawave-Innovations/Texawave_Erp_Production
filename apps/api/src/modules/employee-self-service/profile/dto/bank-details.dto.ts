import {
  ACCOUNT_NUMBER,
  IFSC,
  Pattern,
  OptionalText,
  RequiredText,
} from "./onboarding-rules.js";

export class BankDetailsDto {
  @RequiredText()
  accountHolderName!: string;

  @Pattern(ACCOUNT_NUMBER.regex, ACCOUNT_NUMBER.message)
  accountNumber!: string;

  @Pattern(IFSC.regex, IFSC.message)
  ifsc!: string;

  @RequiredText()
  bankName!: string;

  @OptionalText()
  branchName?: string;
}
