import { changedFieldNames, normalizeLanguages } from "./profiles.rules.js";

describe("normalizeLanguages", () => {
  it("trims, drops blanks and keeps the original order", () => {
    expect(
      normalizeLanguages(["  Tamil ", "", "English", "   ", "Hindi"]),
    ).toEqual(["Tamil", "English", "Hindi"]);
  });

  it("drops case-insensitive duplicates and keeps the first spelling", () => {
    expect(normalizeLanguages(["Tamil", "tamil", "TAMIL", "English"])).toEqual([
      "Tamil",
      "English",
    ]);
  });

  it("treats null and undefined as an empty list (clearing the field)", () => {
    expect(normalizeLanguages(null)).toEqual([]);
    expect(normalizeLanguages(undefined)).toEqual([]);
    expect(normalizeLanguages([])).toEqual([]);
  });
});

describe("changedFieldNames", () => {
  it("returns the field names only, sorted, never the values", () => {
    expect(
      changedFieldNames({
        panNumber: "ABCDE1234F",
        aadhaarNumber: "123412341234",
      }),
    ).toEqual(["aadhaarNumber", "panNumber"]);
  });

  it("is empty for an empty patch", () => {
    expect(changedFieldNames({})).toEqual([]);
  });
});
