import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import { describe, expect, it } from "vitest";
import { IsStrongPassword } from "./password-policy.js";

class PasswordDto {
  @IsStrongPassword()
  password!: unknown;
}

function messagesFor(password: unknown): string[] {
  const errors = validateSync(plainToInstance(PasswordDto, { password }));
  return errors.flatMap((e) => Object.values(e.constraints ?? {}));
}

describe("@IsStrongPassword()", () => {
  it.each(["Abcdef1!", "Str0ng#Passw0rd", "Zz9_zzzz"])("accepts %s", (pw) => {
    expect(messagesFor(pw)).toEqual([]);
  });

  it("reports a too-short password", () => {
    expect(messagesFor("Ab1!")).toEqual([
      "Password must be at least 8 characters.",
    ]);
  });

  it.each([
    ["abcdef1!", "Password must include an uppercase letter."],
    ["ABCDEF1!", "Password must include a lowercase letter."],
    ["Abcdefg!", "Password must include a number."],
    ["Abcdefg1", "Password must include a special character."],
  ])("rejects %s with exactly the missing rule", (pw, message) => {
    expect(messagesFor(pw)).toEqual([message]);
  });

  it("lists every missing requirement, not just one", () => {
    expect(messagesFor("abc").sort()).toEqual(
      [
        "Password must be at least 8 characters.",
        "Password must include an uppercase letter.",
        "Password must include a number.",
        "Password must include a special character.",
      ].sort(),
    );
  });

  it("rejects a non-string value", () => {
    expect(messagesFor(12345678)).toContain("password must be a string");
  });
});
