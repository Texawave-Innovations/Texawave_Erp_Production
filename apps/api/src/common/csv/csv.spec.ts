import { describe, expect, it } from "vitest";
import { CsvParseError, parseCsv, toCsv } from "./csv.js";

describe("toCsv", () => {
  it("writes a BOM, CRLF lines and quotes fields that need it", () => {
    const out = toCsv(
      ["a", "b"],
      [
        ["x,y", 'say "hi"'],
        [null, 3],
      ],
    );
    expect(out).toBe('\uFEFFa,b\r\n"x,y","say ""hi"""\r\n,3\r\n');
  });

  it("neutralises values a spreadsheet would run as a formula", () => {
    const out = toCsv(["v"], [["=HYPERLINK(1)"], ["+1"], ["-2"], ["@SUM(A1)"]]);
    expect(out.split("\r\n").slice(1, 5)).toEqual([
      "'=HYPERLINK(1)",
      "'+1",
      "'-2",
      "'@SUM(A1)",
    ]);
  });
});

describe("parseCsv", () => {
  it("parses quoted fields with commas, quotes and line breaks", () => {
    expect(parseCsv('a,b\r\n"x,y","he said ""no""\nok"\r\n')).toEqual([
      ["a", "b"],
      ["x,y", 'he said "no"\nok'],
    ]);
  });

  it("strips a BOM, accepts LF endings and skips blank lines", () => {
    expect(parseCsv("\uFEFFa,b\n\n1,2\n,\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("keeps a trailing empty field and a last line without a newline", () => {
    expect(parseCsv("a,b,\n1,2,")).toEqual([
      ["a", "b", ""],
      ["1", "2", ""],
    ]);
  });

  it("round-trips what toCsv writes", () => {
    const rows = [["Asha, V", 'x"y', "line\nbreak"]];
    expect(parseCsv(toCsv(["h1", "h2", "h3"], rows))).toEqual([
      ["h1", "h2", "h3"],
      ...rows,
    ]);
  });

  it("rejects malformed quoting", () => {
    expect(() => parseCsv('a"b,c')).toThrow(CsvParseError);
    expect(() => parseCsv('"abc')).toThrow(CsvParseError);
  });
});
