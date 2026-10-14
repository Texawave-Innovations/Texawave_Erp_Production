import { describe, expect, it, vi } from "vitest";
import { PasswordResetTokensRepository } from "./password-reset-tokens.repository.js";

function makeRepository() {
  const passwordResetToken = {
    create: vi.fn().mockResolvedValue({ id: 1 }),
    findMany: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockResolvedValue({ id: 1 }),
  };
  const prisma = { passwordResetToken };
  const repository = new PasswordResetTokensRepository(prisma as never);
  return { repository, passwordResetToken };
}

describe("PasswordResetTokensRepository", () => {
  it("create() stores the hash (never a raw token) with its expiry", async () => {
    const { repository, passwordResetToken } = makeRepository();
    const expiresAt = new Date("2026-01-01T00:30:00Z");

    await repository.create(7, "$2b$10$hash", expiresAt);

    expect(passwordResetToken.create).toHaveBeenCalledWith({
      data: { userId: 7, tokenHash: "$2b$10$hash", expiresAt },
    });
  });

  it("findValidCandidates() only returns unused, unexpired tokens and includes the user", async () => {
    const { repository, passwordResetToken } = makeRepository();
    const now = new Date("2026-01-01T00:00:00Z");

    await repository.findValidCandidates(now);

    expect(passwordResetToken.findMany).toHaveBeenCalledWith({
      where: { usedAt: null, expiresAt: { gt: now } },
      include: { user: true },
    });
  });

  it("markUsed() sets usedAt on exactly the matched token", async () => {
    const { repository, passwordResetToken } = makeRepository();
    const usedAt = new Date("2026-01-01T00:05:00Z");

    await repository.markUsed(55, usedAt);

    expect(passwordResetToken.update).toHaveBeenCalledWith({
      where: { id: 55 },
      data: { usedAt },
    });
  });
});
