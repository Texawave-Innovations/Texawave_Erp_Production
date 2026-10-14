import { Logger } from "@nestjs/common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AUTO_CHECKOUT_INTERVAL_MS,
  AttendanceAutoCheckoutScheduler,
} from "./attendance-auto-checkout.scheduler.js";

const NOW = new Date("2026-10-05T06:00:00Z");

const summary = (over: Partial<Record<string, number>> = {}) => ({
  closed: 0,
  noTarget: 0,
  notDue: 0,
  failedOrganizations: 0,
  ...over,
});

function makeScheduler(result: unknown = summary()) {
  const job = { runForAllOrganizations: vi.fn().mockResolvedValue(result) };
  const scheduler = new AttendanceAutoCheckoutScheduler(job as never);
  return { scheduler, job };
}

describe("AttendanceAutoCheckoutScheduler (lifecycle and logging)", () => {
  let log: ReturnType<typeof vi.spyOn>;
  let error: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    log = vi.spyOn(Logger.prototype, "log").mockImplementation(() => {});
    error = vi.spyOn(Logger.prototype, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("runs every five minutes once the module starts", async () => {
    const { scheduler, job } = makeScheduler();
    scheduler.onModuleInit();
    expect(AUTO_CHECKOUT_INTERVAL_MS).toBe(300_000);
    expect(log).toHaveBeenCalledWith(
      "attendance auto-checkout scheduled every 5 minutes",
    );
    expect(job.runForAllOrganizations).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(AUTO_CHECKOUT_INTERVAL_MS - 1);
    expect(job.runForAllOrganizations).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(job.runForAllOrganizations).toHaveBeenCalledTimes(1);
    // The run is stamped with the clock at tick time.
    expect(job.runForAllOrganizations).toHaveBeenCalledWith(
      new Date(NOW.getTime() + AUTO_CHECKOUT_INTERVAL_MS),
    );
    await vi.advanceTimersByTimeAsync(AUTO_CHECKOUT_INTERVAL_MS);
    expect(job.runForAllOrganizations).toHaveBeenCalledTimes(2);

    scheduler.onModuleDestroy();
  });

  it("unrefs the timer so it never holds the process open", () => {
    const unref = vi.fn();
    vi.spyOn(globalThis, "setInterval").mockReturnValue({
      unref,
    } as unknown as NodeJS.Timeout);
    const { scheduler } = makeScheduler();
    scheduler.onModuleInit();
    expect(unref).toHaveBeenCalledTimes(1);
  });

  it("stops running after shutdown", async () => {
    const { scheduler, job } = makeScheduler();
    scheduler.onModuleInit();
    scheduler.onModuleDestroy();
    await vi.advanceTimersByTimeAsync(AUTO_CHECKOUT_INTERVAL_MS * 3);
    expect(job.runForAllOrganizations).not.toHaveBeenCalled();
  });

  it("shutdown without a start is a no-op", () => {
    const clear = vi.spyOn(globalThis, "clearInterval");
    const { scheduler } = makeScheduler();
    expect(() => scheduler.onModuleDestroy()).not.toThrow();
    expect(clear).not.toHaveBeenCalled();
  });

  it("stays quiet when a run closed nothing and nothing failed", async () => {
    const { scheduler } = makeScheduler(summary({ noTarget: 2, notDue: 5 }));
    await scheduler.tick();
    expect(log).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it("logs the counts when a run closed sessions", async () => {
    const { scheduler } = makeScheduler(
      summary({ closed: 3, noTarget: 1, notDue: 2 }),
    );
    await scheduler.tick();
    expect(log).toHaveBeenCalledWith(
      "attendance auto-checkout: closed=3 noTarget=1 notDue=2 failedOrganizations=0",
    );
  });

  it("logs the counts when an organization failed even if nothing closed", async () => {
    const { scheduler } = makeScheduler(summary({ failedOrganizations: 1 }));
    await scheduler.tick();
    expect(log).toHaveBeenCalledWith(
      "attendance auto-checkout: closed=0 noTarget=0 notDue=0 failedOrganizations=1",
    );
  });

  it("logs a failed run with its stack, and a non-Error failure without one", async () => {
    const { scheduler, job } = makeScheduler();
    const boom = new Error("db down");
    job.runForAllOrganizations
      .mockRejectedValueOnce(boom)
      .mockRejectedValueOnce("string failure");
    await scheduler.tick();
    await scheduler.tick();
    expect(error).toHaveBeenNthCalledWith(
      1,
      "attendance auto-checkout run failed",
      boom.stack,
    );
    expect(error).toHaveBeenNthCalledWith(
      2,
      "attendance auto-checkout run failed",
      undefined,
    );
    // The guard is released after each failure.
    await scheduler.tick();
    expect(job.runForAllOrganizations).toHaveBeenCalledTimes(3);
  });
});
