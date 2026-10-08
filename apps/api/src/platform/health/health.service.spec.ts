import { describe, expect, it, vi } from "vitest";
import { HealthService } from "./health.service.js";

function makeService(dbOk: boolean, redisOk: boolean) {
  const repository = {
    pingDb: vi.fn().mockResolvedValue(dbOk),
    pingRedis: vi.fn().mockResolvedValue(redisOk),
  };
  return { service: new HealthService(repository as never), repository };
}

describe("HealthService.check", () => {
  it.each([
    [true, true, { status: "ok", db: "ok", redis: "ok" }],
    [false, true, { status: "error", db: "unreachable", redis: "ok" }],
    [true, false, { status: "error", db: "ok", redis: "unreachable" }],
    [
      false,
      false,
      { status: "error", db: "unreachable", redis: "unreachable" },
    ],
  ])("db=%s redis=%s -> %o", async (dbOk, redisOk, expected) => {
    const { service, repository } = makeService(dbOk, redisOk);
    await expect(service.check()).resolves.toEqual(expected);
    expect(repository.pingDb).toHaveBeenCalledTimes(1);
    expect(repository.pingRedis).toHaveBeenCalledTimes(1);
  });

  it("pings db and redis concurrently rather than sequentially", async () => {
    const started: string[] = [];
    let releaseDb: (v: boolean) => void = () => undefined;
    const repository = {
      pingDb: vi.fn(
        () =>
          new Promise<boolean>((resolve) => {
            started.push("db");
            releaseDb = resolve;
          }),
      ),
      pingRedis: vi.fn(() => {
        started.push("redis");
        return Promise.resolve(true);
      }),
    };
    const pending = new HealthService(repository as never).check();
    // Redis was pinged while the DB ping was still pending.
    expect(started).toEqual(["db", "redis"]);
    releaseDb(true);
    await expect(pending).resolves.toEqual({
      status: "ok",
      db: "ok",
      redis: "ok",
    });
  });
});
