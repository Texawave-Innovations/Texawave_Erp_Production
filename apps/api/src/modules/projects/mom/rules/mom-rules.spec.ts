import { describe, expect, it } from "vitest";
import { validateMomFinalize, type MomFinalizeInput } from "./mom-rules.js";

function complete(overrides: Partial<MomFinalizeInput> = {}): MomFinalizeInput {
  return {
    projectId: 1,
    meetingTitle: "Weekly Review",
    meetingDate: "2026-10-20",
    startTime: "10:00",
    endTime: "11:00",
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
