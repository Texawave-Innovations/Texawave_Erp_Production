import { applyDecorators } from "@nestjs/common";
import { ApiProperty } from "@nestjs/swagger";
import { IsString, Matches, MinLength } from "class-validator";

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
    Matches(/[A-Z]/, {
      message: "Password must include an uppercase letter.",
    }),
    Matches(/[a-z]/, {
      message: "Password must include a lowercase letter.",
    }),
    Matches(/\d/, { message: "Password must include a number." }),
    Matches(/[^A-Za-z0-9]/, {
      message: "Password must include a special character.",
    }),
  );
}
