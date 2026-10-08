import { Logger } from "@nestjs/common";
import { afterEach, describe, expect, it, vi } from "vitest";

// Swap the generated client for an inert base class so the lifecycle hooks
// can be exercised without a database connection.
vi.mock("@texawave-erp/database", () => ({
  PrismaClient: class {
    $connect(): Promise<void> {
      return Promise.resolve();
    }
    $disconnect(): Promise<void> {
      return Promise.resolve();
    }
  },
}));

const { PrismaService } = await import("./prisma.service.js");

describe("PrismaService", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("connects on module init and logs once connected", async () => {
    const log = vi
      .spyOn(Logger.prototype, "log")
      .mockImplementation(() => undefined);
    const service = new PrismaService();
    const order: string[] = [];
    const connect = vi.spyOn(service, "$connect").mockImplementation(() => {
      order.push("connect");
      return Promise.resolve();
    });
    log.mockImplementation(() => {
      order.push("log");
    });

    await service.onModuleInit();

    expect(connect).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith("Prisma connected");
    expect(order).toEqual(["connect", "log"]);
  });

  it("propagates a connection failure and does not log success", async () => {
    const log = vi
      .spyOn(Logger.prototype, "log")
      .mockImplementation(() => undefined);
    const service = new PrismaService();
    vi.spyOn(service, "$connect").mockRejectedValue(new Error("ECONNREFUSED"));

    await expect(service.onModuleInit()).rejects.toThrow("ECONNREFUSED");
    expect(log).not.toHaveBeenCalled();
  });

  it("disconnects on module destroy", async () => {
    const service = new PrismaService();
    const disconnect = vi
      .spyOn(service, "$disconnect")
      .mockResolvedValue(undefined);

    await service.onModuleDestroy();

    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
