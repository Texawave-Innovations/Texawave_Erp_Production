import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { DocumentNumberingService } from "./document-numbering.service.js";
import type { UpdateDocumentNumberingDto } from "./dto/update-document-numbering.dto.js";
import { SALES_DOCUMENT_TYPES } from "./sales-settings.constants.js";

/** Document numbering has no own table — rows live in the shared
 * `document_sequences` table keyed by `docType`. `findAll()` must always
 * return all 8 `SALES_DOCUMENT_TYPES`, synthesizing a default row for any
 * type the org hasn't configured yet; `upsert()` must reject an unknown
 * `docType` before touching the repository. */

const SCOPE = { organizationId: 1 };
const USER_ID = 42;

function makeService() {
  const repository = {
    findMany: vi.fn(),
    upsert: vi.fn(),
  };
  const tenantContext = {
    getOrgScope: vi.fn().mockReturnValue(SCOPE),
    getUserId: vi.fn().mockReturnValue(USER_ID),
  };

  const service = new DocumentNumberingService(
    repository as never,
    tenantContext as never,
  );
  return { service, repository, tenantContext };
}

describe("DocumentNumberingService", () => {
  describe("findAll()", () => {
    it("passes the tenant scope and all known document types to the repository", async () => {
      const { service, repository } = makeService();
      repository.findMany.mockResolvedValue([]);

      await service.findAll();

      expect(repository.findMany).toHaveBeenCalledWith(
        SCOPE,
        SALES_DOCUMENT_TYPES,
      );
    });

    it("synthesizes a default row (prefix '', padding 6, nextNumber 1) for an unconfigured type", async () => {
      const { service, repository } = makeService();
      repository.findMany.mockResolvedValue([]);

      const rows = await service.findAll();

      expect(rows).toHaveLength(SALES_DOCUMENT_TYPES.length);
      expect(rows).toContainEqual({
        docType: "quotation",
        prefix: "",
        padding: 6,
        nextNumber: 1,
      });
    });

    it("uses the saved row instead of the default when one exists", async () => {
      const { service, repository } = makeService();
      const saved = {
        docType: "invoice",
        prefix: "INV",
        padding: 4,
        nextNumber: 12,
      };
      repository.findMany.mockResolvedValue([saved]);

      const rows = await service.findAll();

      expect(rows).toContainEqual(saved);
      expect(rows.filter((r) => r.docType === "invoice")).toHaveLength(1);
    });
  });

  describe("upsert()", () => {
    it("rejects an unknown docType before calling the repository", () => {
      const { service, repository } = makeService();
      const dto: UpdateDocumentNumberingDto = { prefix: "X" };

      expect(() => service.upsert("not_a_real_doc_type" as never, dto)).toThrow(
        BadRequestException,
      );
      expect(repository.upsert).not.toHaveBeenCalled();
    });

    it("upserts a known docType within the caller's org, recording the caller", async () => {
      const { service, repository } = makeService();
      const updated = {
        docType: "invoice",
        prefix: "INV",
        padding: 4,
        nextNumber: 1,
      };
      repository.upsert.mockResolvedValue(updated);
      const dto: UpdateDocumentNumberingDto = { prefix: "INV", padding: 4 };

      await expect(service.upsert("invoice", dto)).resolves.toBe(updated);
      expect(repository.upsert).toHaveBeenCalledWith(
        SCOPE,
        "invoice",
        dto,
        USER_ID,
      );
    });
  });
});
