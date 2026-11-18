import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BusinessRuleViolationException } from "../../common/exceptions/business.exception.js";
import type { CustomActivityValues } from "./custom-activities.repository.js";
import { CustomActivitiesService } from "./custom-activities.service.js";
import type {
  CreateCustomActivityDto,
  UpdateCustomActivityDto,
} from "./dto/custom-activity.dto.js";
import { CUSTOM_ACTIVITY_CATEGORIES } from "./timesheets.rules.js";

// Fixed clock: 16 Nov 2026, 15:30 IST (10:00 UTC), so "today" and "future" are
// deterministic whatever time the suite really runs.
const NOW = new Date("2026-11-16T10:00:00.000Z");
const TODAY = "2026-11-16";

const row = (over: Record<string, unknown> = {}) => ({
  id: 1,
  category: "INTERNAL_MEETING",
  title: "Team sync",
  description: null,
  notes: null,
  projectId: null,
  workDate: new Date(`${TODAY}T00:00:00.000Z`),
  startedAt: new Date("2026-11-16T04:30:00.000Z"), // 10:00 IST
  endedAt: new Date("2026-11-16T05:30:00.000Z"), // 11:00 IST
  durationMinutes: 60,
  isBackdated: false,
  lateEntryReason: null,
  dailyStatus: "COMPLETED",
  status: "DRAFT",
  ...over,
});

function makeService() {
  const repository = {
    create: vi.fn(
      async (
        _scope: unknown,
        _employeeId: number,
        _userId: number,
        values: CustomActivityValues,
      ) =>
        row({
          ...values,
          workDate: new Date(`${values.workDate}T00:00:00.000Z`),
        }),
    ),
    // calls the service's merge callback with a stored row, like the real one
    update: vi.fn(
      async (
        _scope: unknown,
        _employeeId: number,
        _userId: number,
        _id: number,
        next: (current: CustomActivityValues) => CustomActivityValues,
      ) =>
        row(
          (() => {
            const v = next({
              category: "INTERNAL_MEETING",
              title: "Team sync",
              description: "old description",
              notes: null,
              projectId: 7,
              workDate: TODAY,
              startedAt: new Date("2026-11-16T04:30:00.000Z"),
              endedAt: new Date("2026-11-16T05:30:00.000Z"),
              durationMinutes: 60,
              isBackdated: false,
              lateEntryReason: null,
            });
            return { ...v, workDate: new Date(`${v.workDate}T00:00:00.000Z`) };
          })(),
        ),
    ),
    remove: vi.fn().mockResolvedValue({ success: true }),
  };
  const tenantContext = {
    getOrgScope: vi.fn().mockReturnValue({ organizationId: 1 }),
    getUserId: vi.fn().mockReturnValue(10),
  };
  const employeeQuery = {
    findCurrentEmployeeOrNull: vi.fn().mockResolvedValue({ id: 5 }),
  };
  const projects = {
    findLinkableProjects: vi.fn().mockResolvedValue([{ id: 7 }, { id: 8 }]),
  };
  const service = new CustomActivitiesService(
    repository as never,
    tenantContext as never,
    employeeQuery as never,
    projects as never,
  );
  return { service, repository, employeeQuery, projects };
}

const dto = (
  over: Partial<CreateCustomActivityDto> = {},
): CreateCustomActivityDto => ({
  category: "INTERNAL_MEETING",
  title: "Internal team discussion",
  workDate: TODAY,
  startTime: "10:00",
  endTime: "11:00",
  ...over,
});

describe("CustomActivitiesService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  describe("create", () => {
    it("builds real instants from the IST times and calculates the duration itself", async () => {
      const { service, repository } = makeService();
      await service.create(
        dto({
          startTime: "14:00",
          endTime: "15:00",
          workDate: "2026-11-13",
          lateEntryReason: "Forgot",
        }),
      );
      const values = repository.create.mock.calls[0]![3];
      expect(values.startedAt.toISOString()).toBe("2026-11-13T08:30:00.000Z"); // 14:00 IST
      expect(values.endedAt.toISOString()).toBe("2026-11-13T09:30:00.000Z"); // 15:00 IST
      expect(values.durationMinutes).toBe(60);
      expect(values.category).toBe("INTERNAL_MEETING");
    });

    it("trims text and stores blanks as null", async () => {
      const { service, repository } = makeService();
      await service.create(
        dto({ title: "  Padded title  ", description: "   ", notes: "" }),
      );
      const values = repository.create.mock.calls[0]![3];
      expect(values).toMatchObject({
        title: "Padded title",
        description: null,
        notes: null,
      });
    });

    it("an activity for today is not a late entry and keeps no reason", async () => {
      const { service, repository } = makeService();
      await service.create(dto({ lateEntryReason: "ignored" }));
      const values = repository.create.mock.calls[0]![3];
      expect(values).toMatchObject({
        isBackdated: false,
        lateEntryReason: null,
      });
    });

    it("a past date is a late entry: it needs a reason, and the reason is kept", async () => {
      const { service, repository } = makeService();
      await expect(
        service.create(dto({ workDate: "2026-11-10" })),
      ).rejects.toThrow(/reason is required/);
      expect(repository.create).not.toHaveBeenCalled();

      await service.create(
        dto({ workDate: "2026-11-10", lateEntryReason: "Forgot to log it" }),
      );
      expect(repository.create.mock.calls[0]![3]).toMatchObject({
        isBackdated: true,
        lateEntryReason: "Forgot to log it",
      });
    });

    it.each([
      [
        "end before start",
        { startTime: "15:00", endTime: "14:00" },
        /after the start/,
      ],
      [
        "zero length",
        { startTime: "10:00", endTime: "10:00" },
        /after the start/,
      ],
      [
        "ending in the future",
        { startTime: "15:00", endTime: "16:00" },
        /future/,
      ], // now is 15:30 IST
      ["a blank title", { title: "   " }, /title is required/],
    ])("refuses %s (422) and writes nothing", async (_name, over, message) => {
      const { service, repository } = makeService();
      const err = await service.create(dto(over)).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(BusinessRuleViolationException);
      expect((err as Error).message).toMatch(message);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it("an activity may not be recorded for a TASK category (it must be a custom one)", async () => {
      const { service } = makeService();
      await expect(
        service.create(dto({ category: "TASK" as never })),
      ).rejects.toThrow(/valid activity category/);
    });

    it("links only a project the employee belongs to", async () => {
      const { service, repository, projects } = makeService();
      await service.create(dto({ projectId: 7 }));
      expect(repository.create.mock.calls[0]![3].projectId).toBe(7);
      expect(projects.findLinkableProjects).toHaveBeenCalledWith(5);

      repository.create.mockClear();
      await expect(service.create(dto({ projectId: 99 }))).rejects.toThrow(
        /member of or hold a task in/,
      );
      expect(repository.create).not.toHaveBeenCalled();
    });

    it("uses the employee from the signed-in user, never from the request", async () => {
      const { service, repository } = makeService();
      await service.create(dto());
      expect(repository.create.mock.calls[0]![1]).toBe(5);
      expect(repository.create.mock.calls[0]![2]).toBe(10);
    });

    it("refuses a user with no employee profile", async () => {
      const { service, employeeQuery, repository } = makeService();
      employeeQuery.findCurrentEmployeeOrNull.mockResolvedValue(null);
      await expect(service.create(dto())).rejects.toThrow(
        /no associated employee/,
      );
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe("update", () => {
    const patch = (
      over: Omit<Partial<UpdateCustomActivityDto>, "projectId"> & {
        projectId?: number | null;
      },
    ) => over as UpdateCustomActivityDto;

    it("changes only what was sent; the rest of the stored activity is kept", async () => {
      const { service, repository } = makeService();
      await service.update(1, patch({ endTime: "12:30" }));
      const merged = (await repository.update.mock.results[0]!
        .value) as ReturnType<typeof row>;
      expect(merged.title).toBe("Team sync");
      expect(merged.description).toBe("old description");
      expect(merged.projectId).toBe(7); // untouched
      expect(merged.durationMinutes).toBe(150); // 10:00 -> 12:30, recalculated
    });

    it("projectId: null removes the link; sending nothing keeps it", async () => {
      const { service, repository } = makeService();
      await service.update(1, patch({ projectId: null }));
      const cleared = (await repository.update.mock.results[0]!
        .value) as ReturnType<typeof row>;
      expect(cleared.projectId).toBeNull();

      repository.update.mockClear();
      await service.update(1, patch({ title: "Renamed" }));
      const kept = (await repository.update.mock.results[0]!
        .value) as ReturnType<typeof row>;
      expect(kept.projectId).toBe(7);
    });

    it("an edit is validated like a create", async () => {
      const { service } = makeService();
      await expect(
        service.update(1, patch({ endTime: "09:00" })),
      ).rejects.toThrow(/after the start/);
    });

    it("refuses to link a project the employee does not belong to", async () => {
      const { service, repository } = makeService();
      await expect(service.update(1, patch({ projectId: 99 }))).rejects.toThrow(
        /member of or hold a task in/,
      );
      expect(repository.update).not.toHaveBeenCalled();
    });
  });

  it("remove delegates with the signed-in employee and user", async () => {
    const { service, repository } = makeService();
    await expect(service.remove(3)).resolves.toEqual({ success: true });
    expect(repository.remove).toHaveBeenCalledWith(
      { organizationId: 1 },
      5,
      10,
      3,
    );
  });

  it("categories come from the rules file: every custom category, never TASK, each labelled", () => {
    const { service } = makeService();
    const list = service.categories();
    expect(list.map((c) => c.code)).toEqual([...CUSTOM_ACTIVITY_CATEGORIES]);
    expect(list.some((c) => (c.code as string) === "TASK")).toBe(false);
    expect(list.every((c) => c.label.length > 0)).toBe(true);
  });
});
