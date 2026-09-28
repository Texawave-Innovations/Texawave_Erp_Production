import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../shared/prisma/prisma.service.js";

/**
 * Not `@OrgScoped()` — `PasswordResetToken` has no `organizationId`
 * (Docs/ARCHITECTURE.md tenancy note on packages/database/prisma/schema.prisma:
 * looked up directly by tokenHash, same as Redis refresh-token keys).
 */
@Injectable()
export class PasswordResetTokensRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(userId: number, tokenHash: string, expiresAt: Date) {
    return this.prisma.passwordResetToken.create({
      data: { userId, tokenHash, expiresAt },
    });
  }

  /**
   * There is no index to look a raw token up by directly — only its bcrypt
   * hash was ever stored. The candidate set is unused, unexpired rows
   * (small: TTL-bound and single-use), and the caller `bcrypt.compare()`s
   * the raw token against each one's `tokenHash` to find the match.
   * Includes `user` so the caller has `organizationId`/`isActive` without a
   * second lookup.
   */
  findValidCandidates(now: Date) {
    return this.prisma.passwordResetToken.findMany({
      where: { usedAt: null, expiresAt: { gt: now } },
      include: { user: true },
    });
  }

  markUsed(id: number, usedAt: Date) {
    return this.prisma.passwordResetToken.update({
      where: { id },
      data: { usedAt },
    });
  }
}
