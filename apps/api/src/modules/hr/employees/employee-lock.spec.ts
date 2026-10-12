import { describe, expect, it, vi } from "vitest";
import { lockEmployee } from "./employee-lock.js";

describe("lockEmployee", () => {
  it("returns true when the org-scoped row exists, locking it FOR UPDATE", async () => {
    const tx = { $queryRaw: vi.fn().mockResolvedValue([{ id: 5 }]) };

    await expect(lockEmployee(tx as never, 1, 5)).resolves.toBe(true);

    const [strings, ...values] = tx.$queryRaw.mock.calls[0]! as [
      TemplateStringsArray,
      ...unknown[],
    ];
    const sql = strings.join("?").replace(/\s+/g, " ");
    expect(sql).toContain("FROM hr.employees");
    expect(sql).toContain("organization_id = ?");
    expect(sql).toContain("deleted_at IS NULL");
    expect(sql).toContain("FOR UPDATE");
    expect(values).toEqual([5, 1]);
  });

  it("returns false for a missing or other-organization employee", async () => {
    const tx = { $queryRaw: vi.fn().mockResolvedValue([]) };
    await expect(lockEmployee(tx as never, 2, 5)).resolves.toBe(false);
  });
});
