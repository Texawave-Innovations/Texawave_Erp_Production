import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import { AttendanceAlertsService } from "./attendance-alerts.service.js";

/** How often the in-process job looks for due alerts. Sending is idempotent
 * (dedup key per kind, employee and date), so a shorter interval only lowers
 * the lag between "due" and "sent". */
export const ATTENDANCE_ALERTS_INTERVAL_MS = 5 * 60_000;

/**
 * The single scheduler for missing check-in / check-out alerts, built the
 * same way as AttendanceAutoCheckoutScheduler: one unref'd interval per API
 * process, no overlapping runs, a failed run is logged and retried on the
 * next tick. Several API instances may each run it safely: the notifications
 * unique index stores each alert once.
 */
@Injectable()
export class AttendanceAlertsScheduler
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(AttendanceAlertsScheduler.name);
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(private readonly job: AttendanceAlertsService) {}

  onModuleInit(): void {
    this.timer = setInterval(
      () => void this.tick(),
      ATTENDANCE_ALERTS_INTERVAL_MS,
    );
    this.timer.unref();
    this.logger.log(
      `attendance alerts scheduled every ${ATTENDANCE_ALERTS_INTERVAL_MS / 60_000} minutes`,
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
      if (result.notified > 0 || result.failedOrganizations > 0) {
        this.logger.log(
          `attendance alerts: alerts=${result.alerts} notified=${result.notified} failedOrganizations=${result.failedOrganizations}`,
        );
      }
    } catch (error) {
      this.logger.error(
        "attendance alerts run failed",
        error instanceof Error ? error.stack : undefined,
      );
    } finally {
      this.running = false;
    }
  }
}
