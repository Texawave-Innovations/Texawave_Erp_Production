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
}
