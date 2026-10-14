import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export interface DetectedFileType {
  extension: "pdf" | "jpg" | "png";
  mimeType: "application/pdf" | "image/jpeg" | "image/png";
}

/** Decides the type from the file's own bytes (magic numbers), never from the
 * file name or the browser's claimed type, which the client controls. */
export function detectFileType(buffer: Buffer): DetectedFileType | null {
  if (
    buffer.length >= 5 &&
    buffer.subarray(0, 5).toString("latin1") === "%PDF-"
  ) {
    return { extension: "pdf", mimeType: "application/pdf" };
  }
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return { extension: "jpg", mimeType: "image/jpeg" };
  }
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (buffer.length >= 8 && png.every((byte, i) => buffer[i] === byte)) {
    return { extension: "png", mimeType: "image/png" };
  }
  return null;
}

/**
 * Local-disk file storage (decided for the single-office deployment; see
 * Docs/ARCHITECTURE.md §7a). Keys are generated server-side and always
 * resolved inside the upload root — a key can never point outside it.
 */
@Injectable()
export class FileStorageService {
  private readonly root: string;

  constructor(config: ConfigService) {
    this.root = path.resolve(config.getOrThrow<string>("UPLOAD_DIR"));
  }

  private resolveKey(key: string): string {
    const full = path.resolve(this.root, key);
    if (!full.startsWith(this.root + path.sep)) {
      throw new Error("FileStorageService: key escapes the upload root");
    }
    return full;
  }

  async save(key: string, buffer: Buffer): Promise<void> {
    const full = this.resolveKey(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, buffer, { flag: "wx" });
  }

  read(key: string): Promise<Buffer> {
    return readFile(this.resolveKey(key));
  }

  async remove(key: string): Promise<void> {
    await rm(this.resolveKey(key), { force: true });
  }
}
