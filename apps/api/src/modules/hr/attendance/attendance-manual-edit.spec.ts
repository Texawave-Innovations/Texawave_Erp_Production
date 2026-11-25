import { keepsAutoClose } from "./attendance.repository.js";

/** HR manual edit: which re-sent sessions stay pending regularization. */
const ist = (hhmm: string, sec = "00.000") =>
  new Date(`2026-10-05T${hhmm}:${sec}+05:30`);

describe("keepsAutoClose (manual edit)", () => {
  const pending = {
    checkInAt: ist("09:00"),
    checkOutAt: ist("23:59", "59.999"),
  };

  it("a session re-sent with the technical close time unchanged stays pending", () => {
    // The HR form edits whole minutes: 23:59:59.999 comes back as 23:59.
    expect(
      keepsAutoClose(pending, {
        checkInAt: ist("09:00"),
        checkOutAt: ist("23:59"),
      }),
    ).toBe(true);
  });

  it("a real check-out time entered by HR regularizes it", () => {
    expect(
      keepsAutoClose(pending, {
        checkInAt: ist("09:00"),
        checkOutAt: ist("18:00"),
      }),
    ).toBe(false);
  });

  it("a different session (another check-in) is not the auto-closed one", () => {
    expect(
      keepsAutoClose(pending, {
        checkInAt: ist("14:00"),
        checkOutAt: ist("23:59"),
      }),
    ).toBe(false);
  });

  it("an open session sent back is not flagged (the auto check-out closes it again)", () => {
    expect(
      keepsAutoClose(pending, { checkInAt: ist("09:00"), checkOutAt: null }),
    ).toBe(false);
  });
});
