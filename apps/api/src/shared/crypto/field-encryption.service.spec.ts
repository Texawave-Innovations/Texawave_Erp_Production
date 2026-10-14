import { ConfigService } from "@nestjs/config";
import { FieldEncryptionService } from "./field-encryption.service.js";

const KEY_A = "a".repeat(64);
const KEY_B = "b".repeat(64);

function service(key: string): FieldEncryptionService {
  const config = { getOrThrow: () => key } as unknown as ConfigService;
  return new FieldEncryptionService(config);
}

describe("FieldEncryptionService", () => {
  it("round-trips a value", () => {
    const svc = service(KEY_A);
    const ciphertext = svc.encrypt("123456789012");
    expect(svc.decrypt(ciphertext)).toBe("123456789012");
  });

  it("produces a different ciphertext each time (random IV)", () => {
    const svc = service(KEY_A);
    expect(svc.encrypt("123456789012")).not.toBe(svc.encrypt("123456789012"));
  });

  it("fails to decrypt with the wrong key", () => {
    const ciphertext = service(KEY_A).encrypt("123456789012");
    expect(() => service(KEY_B).decrypt(ciphertext)).toThrow();
  });

  it("fails to decrypt a tampered ciphertext", () => {
    const ciphertext = service(KEY_A).encrypt("123456789012");
    const [iv, tag, data] = ciphertext.split(":");
    const tampered = `${iv}:${tag}:${(data ?? "").slice(0, -2)}ff`;
    expect(() => service(KEY_A).decrypt(tampered)).toThrow();
  });

  it("rejects a malformed payload", () => {
    expect(() => service(KEY_A).decrypt("not-a-valid-payload")).toThrow();
  });

  it("masks all but the last 4 characters", () => {
    expect(service(KEY_A).mask("123456789012")).toBe("XXXXXXXX9012");
  });
});
