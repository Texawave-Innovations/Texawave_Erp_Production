import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

/**
 * Field-level encryption for data that must never be stored in plain text
 * (currently: bank account numbers — Docs/ARCHITECTURE.md §5.6 HR note).
 * AES-256-GCM: `iv` and the auth tag travel with the ciphertext so decryption
 * fails loudly (not silently) if either is tampered with. The key never
 * changes per record — key rotation is a documented future decision, not
 * built here.
 */
@Injectable()
export class FieldEncryptionService {
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    this.key = Buffer.from(
      config.getOrThrow<string>("FIELD_ENCRYPTION_KEY"),
      "hex",
    );
  }

  /** Returns `iv:authTag:ciphertext`, each hex-encoded. */
  encrypt(plainText: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(plainText, "utf8"),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString("hex")}:${authTag.toString("hex")}:${ciphertext.toString("hex")}`;
  }

  /** Throws if the payload is malformed or the auth tag does not match
   * (wrong key, or the ciphertext was altered). */
  decrypt(payload: string): string {
    const match = /^([0-9a-f]+):([0-9a-f]+):([0-9a-f]+)$/.exec(payload);
    const ivHex = match?.[1];
    const authTagHex = match?.[2];
    const ciphertextHex = match?.[3];
    if (!ivHex || !authTagHex || !ciphertextHex) {
      throw new Error("FieldEncryptionService: malformed ciphertext payload");
    }
    const decipher = createDecipheriv(
      ALGORITHM,
      this.key,
      Buffer.from(ivHex, "hex"),
    );
    decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertextHex, "hex")),
      decipher.final(),
    ]);
    return plaintext.toString("utf8");
  }

  /** Last 4 digits only, for display — never the decrypted value in a
   * general-purpose read. */
  mask(plainText: string): string {
    const last4 = plainText.slice(-4);
    return `${"X".repeat(Math.max(plainText.length - 4, 0))}${last4}`;
  }
}
