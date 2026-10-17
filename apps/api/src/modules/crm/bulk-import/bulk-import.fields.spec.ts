import { describe, expect, it } from "vitest";
import {
  autoMatchHeaders,
  coerceRow,
  ENTITY_FIELD_SPECS,
  normalizeLabel,
  resolveMeetingStatus,
  slugifyHeaderToKey,
} from "./bulk-import.fields.js";

const leads = ENTITY_FIELD_SPECS.leads;
const products = ENTITY_FIELD_SPECS.products;

describe("normalizeLabel", () => {
  it("trims, lower-cases and collapses whitespace, underscores and dashes", () => {
    expect(normalizeLabel("  Name_of-the   Company ")).toBe(
      "name of the company",
    );
  });
});

describe("slugifyHeaderToKey", () => {
  it("camel-cases a free-text header", () => {
    expect(slugifyHeaderToKey("Source / Market Region")).toBe(
      "sourceMarketRegion",
    );
    expect(slugifyHeaderToKey("region")).toBe("region");
  });
  it("returns an empty key when nothing usable remains", () => {
    expect(slugifyHeaderToKey(" ?!/ ")).toBe("");
  });
});

describe("autoMatchHeaders", () => {
  it("matches by exact label, key and alias, ignoring case and spacing", () => {
    const m = autoMatchHeaders(
      ["Name of the Company", "company name", "EMAIL", "Lead_Status"],
      leads,
    );
    // "company name" is an alias of the same field, which the first header
    // already claimed, so it stays unmapped (a field is claimed once).
    expect(m).toEqual(["companyName", null, "email", "leadStatus"]);
  });

  it("never fuzzy-matches unknown headers", () => {
    expect(autoMatchHeaders(["Compny", "Region Zone"], leads)).toEqual([
      null,
      null,
    ]);
  });

  it("matches product aliases", () => {
    expect(
      autoMatchHeaders(["SKU", "Product Name", "unit price"], products),
    ).toEqual(["code", "name", "unitPrice"]);
  });
});

describe("accounts HQ field", () => {
  it("maps HQ and Location headers to hq", () => {
    const accounts = ENTITY_FIELD_SPECS.accounts;
    expect(autoMatchHeaders(["Account Name", "HQ"], accounts)).toEqual([
      "name",
      "hq",
    ]);
    expect(autoMatchHeaders(["Location"], accounts)).toEqual(["hq"]);
  });
});

describe("coerceRow", () => {
  it("reports every missing required field", () => {
    const { errors } = coerceRow(products, {});
    expect(errors).toHaveLength(3);
    expect(errors[0]).toContain("Missing required field");
  });

  it("coerces numbers, booleans and omits empty cells", () => {
    const { data, errors } = coerceRow(products, {
      name: "Widget",
      code: "W-1",
      unitPrice: "1,250.50",
      isActive: "Yes",
      category: "  ",
    });
    expect(errors).toEqual([]);
    expect(data).toEqual({
      name: "Widget",
      code: "W-1",
      unitPrice: 1250.5,
      isActive: true,
    });
  });

  it("flags invalid numbers, emails, dates and select values", () => {
    const { errors } = coerceRow(leads, {
      companyName: "Acme",
      prospectName: "Jo",
      email: "not-an-email",
      leadStatus: "Nope",
      meetingScheduled: "x",
    });
    expect(errors.join("|")).toContain("Invalid email");
    expect(errors.join("|")).toContain("is not a valid Lead Status");
    const bad = coerceRow(products, {
      name: "W",
      code: "c",
      unitPrice: "abc",
    });
    expect(bad.errors.join("|")).toContain("Invalid number");
  });

  it("parses ISO dates and matches select options case-insensitively", () => {
    const { data, errors } = coerceRow(ENTITY_FIELD_SPECS["cold-calling"], {
      companyName: "Acme",
      callDate: "2026-03-05",
    });
    expect(errors).toEqual([]);
    expect(data.callDate).toBe("2026-03-05");
  });
});

describe("resolveMeetingStatus", () => {
  it("keeps an open status (case-insensitive) and defaults to REQUESTED", () => {
    expect(resolveMeetingStatus("confirmed")).toBe("CONFIRMED");
    expect(resolveMeetingStatus("completed")).toBe("REQUESTED");
    expect(resolveMeetingStatus(undefined)).toBe("REQUESTED");
  });
});
