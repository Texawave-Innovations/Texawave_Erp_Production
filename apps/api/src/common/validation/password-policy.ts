import { randomInt } from "node:crypto";
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

const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnpqrstuvwxyz";
const DIGIT = "23456789";
const SPECIAL = "!@#$%^&*";
const ALL = UPPER + LOWER + DIGIT + SPECIAL;

function pick(alphabet: string) {
  return alphabet[randomInt(alphabet.length)];
}

/** A one-time temporary password satisfying {@link IsStrongPassword}, for
 * HR-issued portal logins and admin password resets — shown to the admin
 * once in the API response, never stored or logged in plaintext. */
export function generateTemporaryPassword(length = 12): string {
  const required = [pick(UPPER), pick(LOWER), pick(DIGIT), pick(SPECIAL)];
  const rest = Array.from({ length: length - required.length }, () =>
    pick(ALL),
  );
  const chars = [...required, ...rest];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j] as string, chars[i] as string];
  }
  return chars.join("");
}
