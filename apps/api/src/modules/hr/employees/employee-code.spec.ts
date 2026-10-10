import { describe, expect, it, vi } from "vitest";
import {
  EMPLOYEE_CODE_DOC_TYPE,
  EMPLOYEE_CODE_PADDING,
  EMPLOYEE_CODE_PREFIX,
  formatEmployeeCode,
  issueEmployeeCode,
} from "./employee-code.js";

const sqlOf = (call: unknown[]) =>
  (call[0] as TemplateStringsArray).join("?").replace(/\s+/g, " ");

function makeTx(rows: unknown[]) {
  return {
    $executeRaw: vi.fn().mockResolvedValue(1),
    $queryRaw: vi.fn().mockResolvedValue(rows),
  };
}

describe("formatEmployeeCode", () => {
  it("zero-pads the issued number to the requested width", () => {
    expect(formatEmployeeCode("EMP-", 6, 5)).toBe("EMP-000005");
    expect(formatEmployeeCode("X", 3, 42)).toBe("X042");
  });

  it("never truncates a number wider than the padding", () => {
    expect(formatEmployeeCode("EMP-", 2, 12345)).toBe("EMP-12345");
  });

  it("uses the approved EMP- / 6-digit defaults", () => {
    expect(EMPLOYEE_CODE_PREFIX).toBe("EMP-");
    expect(EMPLOYEE_CODE_PADDING).toBe(6);
    expect(EMPLOYEE_CODE_DOC_TYPE).toBe("employee");
  });
});

describe("issueEmployeeCode", () => {
  it("seeds the org counter, then increments it and formats the issued number", async () => {
    const tx = makeTx([{ prefix: "EMP-", padding: 6, issued: 17 }]);

    await expect(issueEmployeeCode(tx as never, 3)).resolves.toBe("EMP-000017");

    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    const insert = tx.$executeRaw.mock.calls[0]!;
    expect(sqlOf(insert)).toContain("INSERT INTO platform.document_sequences");
    expect(sqlOf(insert)).toContain(
      "ON CONFLICT (organization_id, doc_type) DO NOTHING",
    );
    expect(insert.slice(1)).toEqual([
      3,
      EMPLOYEE_CODE_DOC_TYPE,
      EMPLOYEE_CODE_PREFIX,
      EMPLOYEE_CODE_PADDING,
    ]);

    const update = tx.$queryRaw.mock.calls[0]!;
    expect(sqlOf(update)).toContain("SET next_number = next_number + 1");
    expect(sqlOf(update)).toContain("deleted_at IS NULL");
    expect(update.slice(1)).toEqual([3, EMPLOYEE_CODE_DOC_TYPE]);
  });

  it("seeds before incrementing (the UPDATE must see the row)", async () => {
    const order: string[] = [];
    const tx = {
      $executeRaw: vi.fn(async () => {
        order.push("insert");
        return 1;
      }),
      $queryRaw: vi.fn(async () => {
        order.push("update");
        return [{ prefix: "EMP-", padding: 6, issued: 1 }];
      }),
    };
    await issueEmployeeCode(tx as never, 1);
    expect(order).toEqual(["insert", "update"]);
  });

  it("formats with the stored prefix/padding, not the constants", async () => {
    const tx = makeTx([{ prefix: "TW/", padding: 4, issued: 9 }]);
    await expect(issueEmployeeCode(tx as never, 1)).resolves.toBe("TW/0009");
  });

  it("throws when no active sequence row is updated (e.g. soft-deleted counter)", async () => {
    const tx = makeTx([]);
    await expect(issueEmployeeCode(tx as never, 8)).rejects.toThrow(
      "No active employee-code sequence for organization 8",
    );
  });
});
