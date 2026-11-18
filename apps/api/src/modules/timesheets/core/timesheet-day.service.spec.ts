import { BusinessRuleViolationException } from "../../../common/exceptions/business.exception.js";
import { TimesheetDayService } from "./timesheet-day.service.js";

const input = {
  organizationId: 1,
  employeeId: 7,
  taskId: 42,
  projectId: 3,
  title: "Implement Production Dashboard",
  workDate: "2026-11-16",
  actorUserId: 9,
};

/** A fake transaction: `$queryRaw` answers in call order — the day-level
 * "is any row submitted/approved?" count, then the INSERT, then the SELECT. */
const OPEN_DAY = [{ n: 0 }];
function fakeTx(answers: unknown[][]) {
  const calls: string[] = [];
  const queryRaw = vi.fn(async (strings: TemplateStringsArray) => {
    calls.push(strings.join("?"));
    return answers.shift() ?? [];
  });
  return { tx: { $queryRaw: queryRaw } as never, calls, queryRaw };
}

describe("TimesheetDayService", () => {
  const service = new TimesheetDayService();

  it("creates the row on the first work of the day", async () => {
    const { tx, calls } = fakeTx([
      OPEN_DAY,
      [{ id: 100 }], // INSERT ... RETURNING id
      [{ id: 100, status: "DRAFT", daily_status: "IN_PROGRESS" }],
    ]);
    const ref = await service.ensureTaskRow(tx, input);
    expect(ref).toEqual({
      id: 100,
      status: "DRAFT",
      dailyStatus: "IN_PROGRESS",
      created: true,
    });
    expect(calls[1]).toContain('INSERT INTO "hr"."timesheets"');
    // race-safety comes from the partial unique index, not a read-then-write
    expect(calls[1]).toContain("ON CONFLICT");
    expect(calls[1]).toContain(
      '"task_id" IS NOT NULL AND "deleted_at" IS NULL',
    );
    expect(calls[1]).toContain("DO NOTHING");
  });

  it("reuses the day's row on a later Start/Resume (created = false)", async () => {
    const { tx } = fakeTx([
      OPEN_DAY,
      [], // conflict: nothing inserted
      [{ id: 100, status: "DRAFT", daily_status: "IN_PROGRESS" }],
    ]);
    const ref = await service.ensureTaskRow(tx, input);
    expect(ref.id).toBe(100);
    expect(ref.created).toBe(false);
  });

  it("a REJECTED day stays editable so the employee can correct it", async () => {
    const { tx } = fakeTx([
      OPEN_DAY,
      [],
      [{ id: 100, status: "REJECTED", daily_status: "IN_PROGRESS" }],
    ]);
    await expect(service.ensureTaskRow(tx, input)).resolves.toMatchObject({
      status: "REJECTED",
    });
  });

  it.each(["SUBMITTED", "APPROVED"])(
    "refuses new work on a %s day with a clear error",
    async (status) => {
      const { tx } = fakeTx([
        OPEN_DAY,
        [],
        [{ id: 100, status, daily_status: "IN_PROGRESS" }],
      ]);
      const err = await service
        .ensureTaskRow(tx, input)
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(BusinessRuleViolationException);
      expect((err as Error).message).toMatch(/already (submitted|approved)/);
    },
  );

  it("a day with ANY submitted or approved row takes no new work, and nothing is inserted", async () => {
    // another task's row on the same day is already under review
    const { tx, calls } = fakeTx([[{ n: 1 }]]);
    const err = await service.ensureTaskRow(tx, input).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BusinessRuleViolationException);
    expect((err as Error).message).toMatch(/already submitted or approved/);
    expect((err as { errorCode?: string }).errorCode).toBe("TIMESHEET_LOCKED");
    expect(calls).toHaveLength(1); // only the check ran: no INSERT
    expect(calls[0]).toContain("'SUBMITTED', 'APPROVED'");
  });

  it("closing a timer past midnight skips the day check (a timer must always be stoppable)", async () => {
    const { tx, calls } = fakeTx([
      [{ id: 100 }],
      [{ id: 100, status: "DRAFT", daily_status: "IN_PROGRESS" }],
    ]);
    await service.ensureTaskRow(tx, { ...input, guardDay: false });
    expect(calls[0]).toContain('INSERT INTO "hr"."timesheets"');
  });

  it("takes a transaction-scoped advisory lock keyed by organization and employee", async () => {
    const { tx, calls } = fakeTx([[]]);
    await service.lockEmployee(tx, 1, 7);
    expect(calls[0]).toContain("pg_advisory_xact_lock");
  });
});
