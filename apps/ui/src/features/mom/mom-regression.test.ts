import test from "node:test";
import assert from "node:assert/strict";
import {
  isSamePersonName,
  normalizeAttendee,
  attendanceOf,
  normalizeNoteRow,
  normalizeNoteRows,
  normalizeAgendaItem,
  normalizeAgendaItems,
} from "./utils.js";

test("BUG 1 - isSamePersonName safeguards against undefined and null", () => {
  // Safe comparison with undefined / null (the cause of the Edit Draft crash)
  assert.equal(isSamePersonName(undefined, "John Doe"), false);
  assert.equal(isSamePersonName("John Doe", undefined), false);
  assert.equal(isSamePersonName(null, null), false);
  assert.equal(isSamePersonName(undefined, undefined), false);
  assert.equal(isSamePersonName("", ""), false);
  assert.equal(isSamePersonName("   ", "John Doe"), false);
  assert.equal(isSamePersonName("John Doe", "   "), false);

  // Valid comparisons
  assert.equal(isSamePersonName("John Doe", "John Doe"), true);
  assert.equal(isSamePersonName("john doe", "JOHN DOE"), true);
  assert.equal(isSamePersonName("  Asha Devi  ", "asha devi"), true);
  assert.equal(isSamePersonName("Ravi Kumar", "Ravi K"), false);
});

test("BUG 1 - normalizeAttendee handles legacy and malformed attendee records", () => {
  // Undefined name handled safely without throwing
  const empty = normalizeAttendee({}, "att", 0);
  assert.equal(empty.name, "");
  assert.equal(typeof empty.id, "string");
  assert.ok(empty.id.length > 0);
  assert.equal(empty.attendance, "present");

  // Non-object handled safely
  const nullRaw = normalizeAttendee(null, "att", 1);
  assert.equal(nullRaw.name, "");
  assert.equal(typeof nullRaw.id, "string");

  // Legacy field 'fullName' mapped to 'name'
  const legacyFullName = normalizeAttendee({
    id: "att_leg_1",
    fullName: "Priya Raman",
    designation: "Frontend Engineer",
    company: "TexaWave",
    attendance: "Present",
  });
  assert.equal(legacyFullName.name, "Priya Raman");
  assert.equal(legacyFullName.role, "Frontend Engineer");
  assert.equal(legacyFullName.organization, "TexaWave");
  assert.equal(legacyFullName.attendance, "present");

  // Legacy field 'attendeeName' mapped to 'name'
  const legacyAttendeeName = normalizeAttendee({
    id: "att_leg_2",
    attendeeName: "Kamalesh S",
    attendance: "REMOTE",
  });
  assert.equal(legacyAttendeeName.name, "Kamalesh S");
  assert.equal(legacyAttendeeName.attendance, "remote");

  // Preservation of existing valid attendee
  const valid = normalizeAttendee({
    id: "att_101",
    name: "Asha Devi",
    role: "Project Lead",
    organization: "TexaWave Innovations",
    attendance: "present",
  });
  assert.equal(valid.id, "att_101");
  assert.equal(valid.name, "Asha Devi");
  assert.equal(valid.role, "Project Lead");
  assert.equal(valid.organization, "TexaWave Innovations");
  assert.equal(valid.attendance, "present");
});

test("MoM Attendance - attendanceOf normalizes case and legacy defaults", () => {
  assert.equal(
    attendanceOf({ id: "1", name: "A", attendance: "present" }),
    "present",
  );
  assert.equal(
    attendanceOf({ id: "2", name: "B", attendance: "remote" }),
    "remote",
  );
  assert.equal(
    attendanceOf({ id: "3", name: "C", attendance: "absent" }),
    "absent",
  );
  // Case-insensitive normalization
  assert.equal(
    attendanceOf({
      id: "4",
      name: "D",
      attendance: "Present" as unknown as "present",
    }),
    "present",
  );
  assert.equal(
    attendanceOf({
      id: "5",
      name: "E",
      attendance: "Remote" as unknown as "remote",
    }),
    "remote",
  );
  assert.equal(
    attendanceOf({
      id: "6",
      name: "F",
      attendance: "Absent" as unknown as "absent",
    }),
    "absent",
  );
  // Missing attendance flag defaults to present
  assert.equal(attendanceOf({ id: "7", name: "G" }), "present");
});

test("BUG 2 - normalizeNoteRows ensures stable, unique keys to prevent React key warning", () => {
  // Legacy notes without IDs
  const legacyRows = [
    { order: 1, agendaItem: "Review", discussionPoints: "Points 1" },
    { order: 2, agendaItem: "Sprint Planning", discussionPoints: "Points 2" },
    { order: 3, agendaItem: "Next Steps", discussionPoints: "Points 3" },
  ];
  const normalized = normalizeNoteRows(legacyRows);

  assert.equal(normalized.length, 3);
  assert.ok((normalized[0]?.id || "").length > 0);
  assert.ok((normalized[1]?.id || "").length > 0);
  assert.ok((normalized[2]?.id || "").length > 0);

  // Every sibling ID must be strictly unique
  const ids = new Set(normalized.map((r) => r.id));
  assert.equal(ids.size, 3, "All note row keys must be unique");

  // Duplicate IDs in source data are resolved to distinct unique IDs
  const duplicateIdRows = [
    { id: "nr_1", order: 1, agendaItem: "A" },
    { id: "nr_1", order: 2, agendaItem: "B" },
    { id: "nr_1", order: 3, agendaItem: "C" },
  ];
  const deduplicated = normalizeNoteRows(duplicateIdRows);
  const deduplicatedIds = new Set(deduplicated.map((r) => r.id));
  assert.equal(
    deduplicatedIds.size,
    3,
    "Duplicate IDs must be resolved to unique keys",
  );

  // Preserves existing valid unique IDs
  const validRows = [
    { id: "row_alpha", order: 1, agendaItem: "Alpha" },
    { id: "row_beta", order: 2, agendaItem: "Beta" },
  ];
  const preserved = normalizeNoteRows(validRows);
  assert.equal(preserved[0]?.id, "row_alpha");
  assert.equal(preserved[1]?.id, "row_beta");
});

test("BUG 2 - normalizeAgendaItems ensures stable, unique keys", () => {
  const duplicateAgenda = [
    { id: "ag_1", order: 1, topic: "Topic 1" },
    { id: "ag_1", order: 2, topic: "Topic 2" },
  ];
  const normalized = normalizeAgendaItems(duplicateAgenda);
  const ids = new Set(normalized.map((a) => a.id));
  assert.equal(
    ids.size,
    2,
    "Duplicate agenda IDs must be resolved to unique keys",
  );
});
