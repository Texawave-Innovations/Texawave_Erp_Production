import { registerDecorator, type ValidationOptions } from "class-validator";
import {
  detectFileType,
  MAX_UPLOAD_BYTES,
} from "../../shared/file-storage/file-storage.service.js";

const DATA_URI_PATTERN = /^data:([a-z0-9.+-]+\/[a-z0-9.+-]+);base64,(.+)$/i;

/** Validates an inline base64 data URI image upload (the sales-settings
 * masterlist pattern — no FileStorageService/Multer involved, see
 * Docs/SALES_SETTINGS_FOUNDATION.md design decision #1): size and type are
 * checked against the decoded bytes' own magic numbers, exactly like
 * FileStorageService.detectFileType, never the claimed data: URI mime type
 * or file extension, which the client controls. JPG/PNG only — PDF isn't a
 * valid seal/signature/logo image. */
export function IsImageDataUri(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: "isImageDataUri",
      target: object.constructor,
      propertyName,
      options: {
        message: "must be a PNG or JPG image no larger than 5 MB",
        ...validationOptions,
      },
      validator: {
        validate(value: unknown) {
          if (typeof value !== "string") return false;
          if (value === "") return true; // optional field, no image chosen
          const match = DATA_URI_PATTERN.exec(value);
          const payload = match?.[2];
          if (!payload) return false;
          let buffer: Buffer;
          try {
            buffer = Buffer.from(payload, "base64");
          } catch {
            return false;
          }
          if (buffer.length === 0 || buffer.length > MAX_UPLOAD_BYTES) {
            return false;
          }
          const detected = detectFileType(buffer);
          return detected?.extension === "jpg" || detected?.extension === "png";
        },
      },
    });
  };
}
