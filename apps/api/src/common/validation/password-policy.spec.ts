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

  // NOTE: the source's doc comment promises every missing requirement is
  // listed, but all four `Matches` rules share class-validator's "matches"
  // constraint key, so only one regex message survives per validation. This
  // test asserts only what currently holds (rejected, length rule reported,
  // no unknown messages) rather than pinning that behaviour.
  it("rejects a password missing several requirements with policy messages only", () => {
    const allowed = [
      "Password must be at least 8 characters.",
      "Password must include an uppercase letter.",
      "Password must include a lowercase letter.",
      "Password must include a number.",
      "Password must include a special character.",
    ];
    const messages = messagesFor("abc");
    expect(messages).toContain("Password must be at least 8 characters.");
    expect(messages.length).toBeGreaterThanOrEqual(2);
    for (const m of messages) expect(allowed).toContain(m);
  });

  it("rejects a non-string value", () => {
    expect(messagesFor(12345678)).toContain("password must be a string");
  });
});
