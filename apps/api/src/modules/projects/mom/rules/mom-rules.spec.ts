import { describe, expect, it } from "vitest";
import { validateMomFinalize, type MomFinalizeInput } from "./mom-rules.js";

function complete(overrides: Partial<MomFinalizeInput> = {}): MomFinalizeInput {
  return {
    projectId: 1,
    meetingTitle: "Weekly Review",
    meetingDate: "2026-10-20",
    startTime: "10:00",
    endTime: "11:00",
    location: "Conference Room A",
    attendeesJson: [{ id: "a1", name: "Asha", attendance: "present" }],
    meetingNotesJson: [
      {
        id: "n1",
        order: 1,
        agendaItem: "Status",
        discussionPoints: "On track",
      },
    ],
    ...overrides,
  };
}

describe("validateMomFinalize", () => {
  it("accepts a complete record", () => {
    expect(validateMomFinalize(complete())).toEqual([]);
  });

  it("requires a linked project, title, date and times", () => {
    const errors = validateMomFinalize(
      complete({
        projectId: null,
        meetingTitle: "  ",
        meetingDate: null,
        startTime: null,
        endTime: "",
      }),
    );
    expect(errors).toEqual(
      expect.arrayContaining([
        "A linked project must be selected.",
        "Meeting title is required.",
        "Meeting date is required to finalize.",
        "Meeting start time is required to finalize.",
        "Meeting end time is required to finalize.",
      ]),
    );
  });

  it("rejects an end time that is not after the start time", () => {
    expect(
      validateMomFinalize(complete({ startTime: "11:00", endTime: "10:30" })),
    ).toContain("Meeting end time must be after the start time.");
  });

  it("requires at least one present or remote attendee", () => {
    expect(
      validateMomFinalize(
        complete({
          attendeesJson: [{ id: "a1", name: "Asha", attendance: "absent" }],
        }),
      ),
    ).toContain("At least one attendee must be marked as present or remote.");

    expect(
      validateMomFinalize(
        complete({
          attendeesJson: [{ id: "a1", name: "Ravi", attendance: "remote" }],
        }),
      ),
    ).toEqual([]);
  });

  it("treats attendees saved without an attendance flag as present", () => {
    expect(
      validateMomFinalize(
        complete({ attendeesJson: [{ id: "a1", name: "Asha" }] }),
      ),
    ).toEqual([]);
  });

  it("requires at least one non-empty notes row", () => {
    expect(
      validateMomFinalize(
        complete({
          meetingNotesJson: [
            { id: "n1", order: 1, agendaItem: "", discussionPoints: " " },
          ],
        }),
      ),
    ).toContain(
      "At least one meeting notes row with discussion points or action items is required.",
    );
  });

  it("tolerates malformed JSON columns", () => {
    const errors = validateMomFinalize(
      complete({ attendeesJson: null, meetingNotesJson: "oops" }),
    );
    expect(errors).toHaveLength(2);
  });
});

// ─── BUG 5: MoM Regression Tests ────────────────────────────────────────────────────────────────────────────

describe("BUG 5 — MoM attendee creation and attendance status", () => {
  // Test A: Attendee with Present status satisfies quorum
  it("Test A: attendee added as Present satisfies quorum validation", () => {
    const errors = validateMomFinalize(
      complete({
        attendeesJson: [
          { id: "att_1", name: "KAMALESH S", attendance: "present" },
        ],
      }),
    );
    expect(errors).toEqual([]);
  });

  // Test B: Remote attendance satisfies quorum
  it("Test B: attendee marked Remote satisfies quorum validation", () => {
    const errors = validateMomFinalize(
      complete({
        attendeesJson: [{ id: "att_2", name: "Priya R", attendance: "remote" }],
      }),
    );
    expect(errors).toEqual([]);
  });

  // Test C: No qualifying attendees blocks finalization
  it("Test C: empty attendee list blocks finalization with a clear error", () => {
    const errors = validateMomFinalize(complete({ attendeesJson: [] }));
    expect(errors).toContain(
      "At least one attendee must be marked as present or remote.",
    );
    expect(errors.length).toBeGreaterThan(0);
  });

  it("Test C: all-absent attendee list blocks finalization", () => {
    const errors = validateMomFinalize(
      complete({
        attendeesJson: [
          { id: "att_a", name: "Ravi K", attendance: "absent" },
          { id: "att_b", name: "Meena S", attendance: "absent" },
        ],
      }),
    );
    expect(errors).toContain(
      "At least one attendee must be marked as present or remote.",
    );
  });

  // Test D: Valid quorum — at least one Present/Remote — passes
  it("parses stringified attendeesJson gracefully", () => {
    const errors = validateMomFinalize(
      complete({
        attendeesJson: JSON.stringify([
          { id: "att_1", name: "KAMALESH S", attendance: "present" },
        ]),
      }),
    );
    expect(errors).toEqual([]);
  });

  it("Test D: one Present and one Absent attendee passes quorum", () => {
    const errors = validateMomFinalize(
      complete({
        attendeesJson: [
          { id: "att_1", name: "KAMALESH S", attendance: "present" },
          { id: "att_2", name: "Ravi K", attendance: "absent" },
        ],
      }),
    );
    expect(errors).toEqual([]);
  });

  it("Test D: mixed Remote + Absent attendees passes quorum", () => {
    const errors = validateMomFinalize(
      complete({
        attendeesJson: [
          { id: "att_1", name: "Priya R", attendance: "remote" },
          { id: "att_2", name: "Ravi K", attendance: "absent" },
        ],
      }),
    );
    expect(errors).toEqual([]);
  });

  // Test E: Location / Meeting Link is REQUIRED on finalization per TC-09.
  it("Test E: requires meeting location or virtual link to finalize", () => {
    expect(validateMomFinalize(complete({ location: null }))).toContain(
      "Meeting location or virtual link is required to finalize.",
    );
    expect(validateMomFinalize(complete({ location: "   " }))).toContain(
      "Meeting location or virtual link is required to finalize.",
    );
    expect(
      validateMomFinalize(
        complete({ location: "https://meet.google.com/xyz" }),
      ),
    ).toEqual([]);
  });

  // Test F: Duplicate notification prevention — a single validation failure
  // produces exactly one error message per rule (not duplicated).
  it("Test F: one failed validation produces exactly one error message per rule", () => {
    const errors = validateMomFinalize(complete({ attendeesJson: [] }));
    const quorumErrors = errors.filter((e) =>
      e.includes("At least one attendee"),
    );
    expect(quorumErrors).toHaveLength(1);
  });

  // Test G: Successful finalization with a complete, valid MoM
  it("Test G: a fully complete MoM passes all finalization checks", () => {
    const errors = validateMomFinalize(
      complete({
        attendeesJson: [
          { id: "att_1", name: "KAMALESH S", attendance: "present" },
        ],
        meetingNotesJson: [
          {
            id: "n1",
            order: 1,
            agendaItem: "Project Status",
            discussionPoints: "All milestones on track",
            actionItems: "Confirm next review date",
          },
        ],
      }),
    );
    expect(errors).toEqual([]);
  });
});
