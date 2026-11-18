import { describe, expect, it } from "vitest";
import { ensureUniqueSectionIds } from "./section-ids.js";

describe("ensureUniqueSectionIds", () => {
  it("keeps unique ids untouched", () => {
    const input = [{ id: "a" }, { id: "b" }];
    expect(ensureUniqueSectionIds(input)).toEqual(input);
  });

  it("renames duplicates and fills blanks, first occurrence wins", () => {
    const out = ensureUniqueSectionIds([
      { id: "a", t: 1 },
      { id: "a", t: 2 },
      { t: 3 },
      { id: "  ", t: 4 },
    ]) as Array<{ id: string; t: number }>;
    expect(out.map((s) => s.id)).toEqual(["a", "a_2", "sec_3", "sec_4"]);
    expect(new Set(out.map((s) => s.id)).size).toBe(4);
  });

  it("shares one id space with nested children", () => {
    const out = ensureUniqueSectionIds([
      { id: "g", children: [{ id: "g" }, { id: "x" }] },
      { id: "x" },
    ]) as Array<{ id: string; children?: Array<{ id: string }> }>;
    expect(out[0]?.children?.map((c) => c.id)).toEqual(["g_2", "x"]);
    expect(out[1]?.id).toBe("x_2");
  });
});
