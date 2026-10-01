import { AuditWriter } from "./audit-writer.js";

function makeWriter(cls: Record<string, unknown> | null) {
  const create = vi.fn().mockResolvedValue({});
  const tx = { auditLog: { create } };
  const clsService = {
    isActive: () => cls !== null,
    get: (key: string) => (cls ?? {})[key],
  };
  return {
    writer: new AuditWriter(clsService as never),
    tx: tx as never,
    create,
  };
}

const REQUEST = {
  organizationId: 3,
  userId: 42,
  ip: "10.0.0.9",
  correlationId: "corr-1",
};

describe("AuditWriter", () => {
  it("takes organization, actor, ip and correlation id from the request context", async () => {
    const { writer, tx, create } = makeWriter(REQUEST);
    await writer.write(tx, {
      entityType: "employee",
      entityId: 7,
      action: "update",
      before: { fullName: "A" },
      after: { fullName: "B" },
      reason: "typo",
    });
    expect(create).toHaveBeenCalledWith({
      data: {
        organizationId: 3,
        actorUserId: 42,
        actorType: "user",
        entityType: "employee",
        entityId: 7n,
        action: "update",
        before: { fullName: "A" },
        after: { fullName: "B" },
        reason: "typo",
        ip: "10.0.0.9",
        correlationId: "corr-1",
      },
    });
  });

  it("has no parameter through which a caller could name the actor", async () => {
    const { writer, tx, create } = makeWriter(REQUEST);
    // Extra, forged fields are simply ignored: the actor is the JWT's.
    await writer.write(tx, {
      entityType: "employee",
      entityId: 1,
      action: "create",
      ...({ actorUserId: 999, organizationId: 999 } as object),
    });
    const data = (
      create.mock.calls[0]?.[0] as { data: Record<string, unknown> }
    ).data;
    expect(data.actorUserId).toBe(42);
    expect(data.organizationId).toBe(3);
  });

  it("never stores a secret from a snapshot", async () => {
    const { writer, tx, create } = makeWriter(REQUEST);
    await writer.write(tx, {
      entityType: "employee",
      entityId: 1,
      action: "link_user",
      after: { userId: 5, passwordHash: "hash", activationToken: "raw" },
    });
    const data = (create.mock.calls[0]?.[0] as { data: { after: unknown } })
      .data;
    expect(JSON.stringify(data.after)).not.toMatch(/"hash"|"raw"/);
  });

  it("omits before/after when not given", async () => {
    const { writer, tx, create } = makeWriter(REQUEST);
    await writer.write(tx, {
      entityType: "employee",
      entityId: 1,
      action: "read",
    });
    const data = (
      create.mock.calls[0]?.[0] as { data: Record<string, unknown> }
    ).data;
    expect("before" in data).toBe(false);
    expect("after" in data).toBe(false);
  });

  it("refuses to write with no authenticated user (a job must say so)", async () => {
    const { writer, tx, create } = makeWriter({});
    await expect(
      writer.write(tx, {
        entityType: "employee",
        entityId: 1,
        action: "update",
      }),
    ).rejects.toThrow(/no authenticated user/);
    expect(create).not.toHaveBeenCalled();
  });

  it("refuses to write outside any request context", async () => {
    const { writer, tx } = makeWriter(null);
    await expect(
      writer.write(tx, {
        entityType: "employee",
        entityId: 1,
        action: "update",
      }),
    ).rejects.toThrow(/no authenticated user/);
  });

  it("records a system actor for a background job, with no user id", async () => {
    const { writer, tx, create } = makeWriter(null);
    await writer.write(tx, {
      entityType: "attendance_session",
      entityId: 9,
      action: "auto_close",
      system: { organizationId: 3, label: "auto-checkout" },
    });
    const { data } = create.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(data).toMatchObject({
      organizationId: 3,
      actorUserId: null,
      actorType: "system",
      reason: "system job: auto-checkout",
      ip: null,
    });
  });

  it.each([
    ["Employee", "update"],
    ["employee", "Update"],
    ["employee-x", "update"],
    ["employee", "status change"],
    ["", "update"],
  ])(
    "rejects malformed entityType/action %j/%j",
    async (entityType, action) => {
      const { writer, tx, create } = makeWriter(REQUEST);
      await expect(
        writer.write(tx, { entityType, entityId: 1, action }),
      ).rejects.toThrow(/lower_snake/);
      expect(create).not.toHaveBeenCalled();
    },
  );

  it("propagates a database failure so the caller's transaction rolls back", async () => {
    const { writer, create } = makeWriter(REQUEST);
    create.mockRejectedValue(new Error("db down"));
    const tx = { auditLog: { create } } as never;
    await expect(
      writer.write(tx, {
        entityType: "employee",
        entityId: 1,
        action: "update",
      }),
    ).rejects.toThrow("db down");
  });
});
