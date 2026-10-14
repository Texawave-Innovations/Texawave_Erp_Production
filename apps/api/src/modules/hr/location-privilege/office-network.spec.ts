import { isOnOfficeNetwork, normalizeIp } from "./office-network.js";

describe("normalizeIp", () => {
  it("strips the IPv4-mapped IPv6 prefix a dual-stack socket reports", () => {
    expect(normalizeIp("::ffff:115.96.5.24")).toBe("115.96.5.24");
  });

  it("lower-cases and trims IPv6 literals", () => {
    expect(normalizeIp("  2001:DB8::1 ")).toBe("2001:db8::1");
  });

  it("leaves a plain IPv4 address unchanged", () => {
    expect(normalizeIp("115.96.5.24")).toBe("115.96.5.24");
  });
});

describe("isOnOfficeNetwork", () => {
  const OFFICE = ["115.96.5.24", "2001:db8::10"];

  it("matches an allowlisted address exactly", () => {
    expect(isOnOfficeNetwork("115.96.5.24", OFFICE)).toBe(true);
  });

  it("matches the mapped form of an allowlisted IPv4 address", () => {
    expect(isOnOfficeNetwork("::ffff:115.96.5.24", OFFICE)).toBe(true);
  });

  it("matches an IPv6 address regardless of case", () => {
    expect(isOnOfficeNetwork("2001:DB8::10", OFFICE)).toBe(true);
  });

  it("rejects a different address, including one that only shares a prefix", () => {
    expect(isOnOfficeNetwork("115.96.5.2", OFFICE)).toBe(false);
    expect(isOnOfficeNetwork("115.96.5.240", OFFICE)).toBe(false);
  });

  it("fails closed when the client address is missing", () => {
    expect(isOnOfficeNetwork(undefined, OFFICE)).toBe(false);
    expect(isOnOfficeNetwork(null, OFFICE)).toBe(false);
    expect(isOnOfficeNetwork("", OFFICE)).toBe(false);
  });

  it("fails closed when the office list is empty", () => {
    expect(isOnOfficeNetwork("115.96.5.24", [])).toBe(false);
  });
});
