import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import { OpenSessionSweepService } from "./open-session-sweep.service.js";

/** How often the in-process job looks for forgotten timers. Closing is
 * idempotent, so a shorter interval only lowers the lag. */
export const OPEN_SESSION_SWEEP_INTERVAL_MS = 5 * 60_000;

/**
 * One in-process interval, the same shape as the attendance auto-checkout
 * scheduler: one timer per process, runs never overlap, the timer is unref'd and
 * cleared on shutdown, a failed run is logged and retried on the next tick.
 * Several API instances may each run it: closing a session is conditional on it
 * still being open, so only one instance closes a given session.
 */
@Injectable()
export class OpenSessionSweepScheduler
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(OpenSessionSweepScheduler.name);
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(private readonly job: OpenSessionSweepService) {}

  onModuleInit(): void {
    this.timer = setInterval(
      () => void this.tick(),
      OPEN_SESSION_SWEEP_INTERVAL_MS,
    );
    this.timer.unref();
    this.logger.log(
      `open-session sweep scheduled every ${OPEN_SESSION_SWEEP_INTERVAL_MS / 60_000} minutes`,
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
      const r = await this.job.runForAllOrganizations(new Date());
      if (r.closedAtCheckout > 0 || r.closedStale > 0 || r.failed > 0) {
        this.logger.log(
          `open-session sweep: closedAtCheckout=${r.closedAtCheckout} closedStale=${r.closedStale} kept=${r.kept} failed=${r.failed}`,
        );
      }
    } catch (error) {
      this.logger.error(
        "open-session sweep run failed",
        error instanceof Error ? error.stack : undefined,
      );
    } finally {
      this.running = false;
    }
  }
}
