import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import { PrismaClient } from "@texawave-erp/database";

/**
 * The only place a raw `PrismaClient` connection lives — an injectable infra
 * provider (Docs/CODING_STANDARDS.md §3). Repositories inject this; nothing
 * else should. Controllers/services never see it directly (enforced by
 * ESLint, apps/api/eslint.config.cjs).
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log("Prisma connected");
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
