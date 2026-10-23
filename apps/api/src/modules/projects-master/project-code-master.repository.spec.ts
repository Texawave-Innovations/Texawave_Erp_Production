import { describe, expect, it, vi } from "vitest";
import { ResourceConflictException } from "../../common/exceptions/business.exception.js";
import { ProjectCodeMasterRepository } from "./project-code-master.repository.js";

const SCOPE = { organizationId: 1 };
const USER_ID = 42;

const prismaError = (code: string, meta: object) => {
  const error = new Error("x") as Error & { code: string; meta: object };
  error.code = code;
  error.meta = meta;
  return error;
};

function makeRepository() {
  const upsert = vi.fn();
  const prisma = { projectCodeMaster: { upsert } };
  const repository = new ProjectCodeMasterRepository(prisma as never);
  return { repository, upsert };
}

describe("ProjectCodeMasterRepository", () => {
  describe("upsert()", () => {
    it("issues a single atomic Prisma upsert keyed on organizationId", async () => {
      const { repository, upsert } = makeRepository();
      const row = { id: 1, organizationId: 1, companyPrefix: "TXW" };
      upsert.mockResolvedValue(row);

      const result = await repository.upsert(
        SCOPE,
        { companyPrefix: "TXW" } as never,
        USER_ID,
      );

      expect(result).toBe(row);
      expect(upsert).toHaveBeenCalledWith({
        where: { organizationId: 1 },
        create: { companyPrefix: "TXW", organizationId: 1, updatedBy: USER_ID },
        update: { companyPrefix: "TXW", updatedBy: USER_ID },
      });
    });

    it("maps a concurrent first-save race (P2002 on organization_id) to ResourceConflictException", async () => {
      const { repository, upsert } = makeRepository();
      upsert.mockRejectedValue(
        prismaError("P2002", { target: ["organization_id"] }),
      );

      await expect(
        repository.upsert(SCOPE, {} as never, USER_ID),
      ).rejects.toBeInstanceOf(ResourceConflictException);
    });

    it("rethrows an unrelated database error unchanged", async () => {
      const { repository, upsert } = makeRepository();
      const other = new Error("connection reset");
      upsert.mockRejectedValue(other);

      await expect(repository.upsert(SCOPE, {} as never, USER_ID)).rejects.toBe(
        other,
      );
    });
  });
});
