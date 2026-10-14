import { applyDecorators } from "@nestjs/common";
import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength, ValidateBy } from "class-validator";

/** One named regex rule. Each needs a distinct `name`: class-validator keys a
 * property's failures by constraint name, so four `Matches()` would all land
 * under "matches" and overwrite each other — leaving only the last message. */
function MatchesRule(name: string, pattern: RegExp, message: string) {
  return ValidateBy({
    name,
    validator: {
      validate: (value: unknown) =>
        typeof value === "string" && pattern.test(value),
      defaultMessage: () => message,
    },
  });
}

/** The single password rule for every flow that sets a password
 * (change-password, reset-password, and later HR-issued temp passwords).
 * Each requirement reports its own message so the body lists exactly what is missing. */
export function IsStrongPassword() {
  return applyDecorators(
    ApiProperty({
      minLength: 8,
      description:
        "At least 8 characters, with an uppercase letter, a lowercase letter, a number and a special character.",
    }),
    IsString(),
    MinLength(8, { message: "Password must be at least 8 characters." }),
    MatchesRule(
      "passwordUppercase",
      /[A-Z]/,
      "Password must include an uppercase letter.",
    ),
    MatchesRule(
      "passwordLowercase",
      /[a-z]/,
      "Password must include a lowercase letter.",
    ),
    MatchesRule("passwordNumber", /\d/, "Password must include a number."),
    MatchesRule(
      "passwordSpecial",
      /[^A-Za-z0-9]/,
      "Password must include a special character.",
    ),
  );
}
