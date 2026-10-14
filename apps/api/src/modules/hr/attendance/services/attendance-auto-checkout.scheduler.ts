import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import { AttendanceAutoCheckoutService } from "./attendance-auto-checkout.service.js";

/** How often the in-process job checks for due sessions. Closing is idempotent,
 * so a shorter interval only lowers the lag between "due" and "closed". */
export const AUTO_CHECKOUT_INTERVAL_MS = 5 * 60_000;

/**
 * The ERP's ONE scheduler for attendance auto-checkout: a single in-process
 * interval inside the API process (the API is a long-running Nest server, so
 * neither Vercel cron nor a Firebase scheduled function can run here).
 *
 * - One timer per process. Several API instances may each run it. That is
 *   safe: the write is conditional on `check_out_at IS NULL`, so only one
 *   instance closes a given session, and only that one writes its audit row.
 * - Runs never overlap within a process (`running` guard).
 * - The timer is unref'd and cleared on shutdown, so it never holds the process open.
 * - A failed run is logged and retried on the next tick.
 */
@Injectable()
export class AttendanceAutoCheckoutScheduler
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(AttendanceAutoCheckoutScheduler.name);
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(private readonly job: AttendanceAutoCheckoutService) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.tick(), AUTO_CHECKOUT_INTERVAL_MS);
    this.timer.unref();
    this.logger.log(
      `attendance auto-checkout scheduled every ${AUTO_CHECKOUT_INTERVAL_MS / 60_000} minutes`,
    );
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  /** One run. Exposed so tests and operators can trigger it without waiting. */
  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const result = await this.job.runForAllOrganizations(new Date());
      if (result.closed > 0 || result.failedOrganizations > 0) {
        this.logger.log(
          `attendance auto-checkout: closed=${result.closed} noTarget=${result.noTarget} notDue=${result.notDue} failedOrganizations=${result.failedOrganizations}`,
        );
      }
    } catch (error) {
      this.logger.error(
        "attendance auto-checkout run failed",
        error instanceof Error ? error.stack : undefined,
      );
    } finally {
      this.running = false;
    }
  }
}
