import { BadRequestException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { detectFileType } from "../../../shared/file-storage/file-storage.service.js";

/** Logos, seals and signatures: PNG or JPEG, 2 MB or smaller. */
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

export interface UploadedImage {
  buffer: Buffer;
  size: number;
  originalname: string;
}

/** Checks an uploaded image by its bytes (never the client's MIME type) and
 * returns a server-generated storage key and the detected type. */
export function acceptImage(
  file: UploadedImage | undefined,
  organizationId: number,
  kind: "logo" | "seal" | "signature",
): { storageKey: string; mimeType: "image/png" | "image/jpeg" } {
  if (!file) throw new BadRequestException("Choose an image to upload.");
  if (file.size > MAX_IMAGE_BYTES) {
    throw new BadRequestException("Image must be 2 MB or smaller.");
  }
  const detected = detectFileType(file.buffer);
  if (!detected || detected.mimeType === "application/pdf") {
    throw new BadRequestException("Only PNG or JPG images are accepted.");
  }
  return {
    storageKey: `sales/${organizationId}/${kind}/${randomUUID()}.${detected.extension}`,
    mimeType: detected.mimeType,
  };
}

/** An image as a data URI, for the server-rendered PDF. */
export function dataUri(mimeType: string, buffer: Buffer): string {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}
