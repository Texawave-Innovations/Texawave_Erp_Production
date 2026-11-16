import test from "node:test";
import assert from "node:assert/strict";
import { describeDnd, DND_OFF_REQUEST, dndRequestFor } from "./dnd";

const NOW = new Date(2026, 10, 16, 10, 0, 0); // 16 Nov 2026, 10:00 local

test("timed presets end the right number of minutes from now", () => {
  for (const [id, minutes] of [
    ["30m", 30],
    ["1h", 60],
    ["2h", 120],
  ] as const) {
    const req = dndRequestFor(id, NOW);
    assert.equal(
      new Date(req.until as string).getTime() - NOW.getTime(),
      minutes * 60_000,
    );
    assert.equal(req.indefinite, undefined);
  }
});

test("'until tomorrow' is 09:00 the next local day", () => {
  const until = new Date(dndRequestFor("tomorrow", NOW).until as string);
  assert.equal(until.getDate(), 17);
  assert.equal(until.getHours(), 9);
  assert.equal(until.getMinutes(), 0);
});

test("'until tomorrow' stays within the 7-day server limit", () => {
  const until = new Date(dndRequestFor("tomorrow", NOW).until as string);
  assert.ok(until.getTime() - NOW.getTime() <= 7 * 24 * 60 * 60_000);
});

test("indefinite sends no end time; turning off sends neither", () => {
  assert.deepEqual(dndRequestFor("indefinite", NOW), { indefinite: true });
  assert.deepEqual(DND_OFF_REQUEST, { until: null, indefinite: false });
});

test("describeDnd words each state", () => {
  assert.equal(
    describeDnd({ active: false, until: null, indefinite: false }, NOW),
    "",
  );
  assert.equal(
    describeDnd({ active: true, until: null, indefinite: true }, NOW),
    "Do not disturb until you turn it off",
  );
  const sameDay = new Date(2026, 10, 16, 17, 30).toISOString();
  assert.match(
    describeDnd({ active: true, until: sameDay, indefinite: false }, NOW),
    /^Do not disturb until 5:30\s?PM$/,
  );
  const nextDay = new Date(2026, 10, 17, 9, 0).toISOString();
  assert.match(
    describeDnd({ active: true, until: nextDay, indefinite: false }, NOW),
    /^Do not disturb until Tue, Nov 17, 9:00\s?AM$/,
  );
});
