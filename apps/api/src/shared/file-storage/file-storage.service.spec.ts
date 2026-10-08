import type { ConfigService } from "@nestjs/config";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  detectFileType,
  FileStorageService,
  MAX_UPLOAD_BYTES,
} from "./file-storage.service.js";

describe("detectFileType", () => {
  it("detects a PDF from its %PDF- header", () => {
    expect(detectFileType(Buffer.from("%PDF-1.7\n..."))).toEqual({
      extension: "pdf",
      mimeType: "application/pdf",
    });
  });

  it("detects a JPEG from FF D8 FF", () => {
    expect(detectFileType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0]))).toEqual({
      extension: "jpg",
      mimeType: "image/jpeg",
    });
  });

  it("detects a PNG from its 8-byte signature", () => {
    const png = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
    ]);
    expect(detectFileType(png)).toEqual({
      extension: "png",
      mimeType: "image/png",
    });
  });

  it.each([
    ["empty", Buffer.alloc(0)],
    ["truncated PDF header", Buffer.from("%PDF")],
    ["truncated JPEG header", Buffer.from([0xff, 0xd8])],
    ["truncated PNG header", Buffer.from([0x89, 0x50, 0x4e, 0x47])],
    [
      "a PNG signature with one wrong byte",
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0b]),
    ],
    ["an executable (MZ)", Buffer.from("MZ\x90\x00\x03\x00\x00\x00")],
    ["HTML disguised by name", Buffer.from("<html><script>")],
  ])("returns null for %s", (_label, buf) => {
    expect(detectFileType(buf)).toBeNull();
  });

  it("caps uploads at 5 MiB", () => {
    expect(MAX_UPLOAD_BYTES).toBe(5 * 1024 * 1024);
  });
});

describe("FileStorageService", () => {
  let root: string;
  let service: FileStorageService;
  let getOrThrow: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "file-storage-spec-"));
    getOrThrow = vi.fn(() => root);
    service = new FileStorageService({
      getOrThrow,
    } as unknown as ConfigService);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("reads UPLOAD_DIR from config", () => {
    expect(getOrThrow).toHaveBeenCalledWith("UPLOAD_DIR");
  });

  it("saves into nested folders under the root and reads it back", async () => {
    const data = Buffer.from("hello");
    await service.save("employees/7/doc.pdf", data);

    expect(
      await readFile(path.join(root, "employees", "7", "doc.pdf")),
    ).toEqual(data);
    expect(await service.read("employees/7/doc.pdf")).toEqual(data);
  });

  it("refuses to overwrite an existing key", async () => {
    await service.save("a.pdf", Buffer.from("first"));
    await expect(service.save("a.pdf", Buffer.from("second"))).rejects.toThrow(
      /EEXIST/,
    );
    expect((await service.read("a.pdf")).toString()).toBe("first");
  });

  it("removes a file, and removing a missing key is a no-op", async () => {
    await writeFile(path.join(root, "gone.png"), "x");
    await service.remove("gone.png");
    await expect(stat(path.join(root, "gone.png"))).rejects.toThrow(/ENOENT/);
    await expect(service.remove("never-existed.png")).resolves.toBeUndefined();
  });

  it("rejects reading a missing key", async () => {
    await expect(service.read("missing.pdf")).rejects.toThrow(/ENOENT/);
  });

  it.each([
    "../escape.pdf",
    "a/../../escape.pdf",
    "",
    ".",
    path.join(os.tmpdir(), "outside.pdf"),
  ])("rejects a key that escapes the upload root: %j", async (key) => {
    await expect(service.save(key, Buffer.from("x"))).rejects.toThrow(
      "FileStorageService: key escapes the upload root",
    );
    expect(() => service.read(key)).toThrow(/escapes the upload root/);
    await expect(service.remove(key)).rejects.toThrow(
      /escapes the upload root/,
    );
  });

  it("rejects a sibling directory that merely shares the root's prefix", async () => {
    const sibling = `../${path.basename(root)}-evil/x.pdf`;
    await expect(service.save(sibling, Buffer.from("x"))).rejects.toThrow(
      /escapes the upload root/,
    );
  });
});
