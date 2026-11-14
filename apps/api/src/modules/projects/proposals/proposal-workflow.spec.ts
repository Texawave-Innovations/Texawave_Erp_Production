import { ValidationPipe } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import {
  CreateProposalTemplateDto,
  UpdateProposalTemplateDto,
} from "./dto/template.dto.js";
import { normalizeSections } from "./proposal-templates.service.js";
import {
  applyProposalTransition,
  assertTransitionComment,
  isFollowUpDue,
} from "./proposal-workflow.js";

describe("applyProposalTransition", () => {
  it("moves a draft into review", () => {
    expect(applyProposalTransition("draft", "submit_for_review")).toBe(
      "under_review",
    );
  });

  it("rejects an action not allowed from the current status", () => {
    expect(() => applyProposalTransition("draft", "send_to_client")).toThrow();
  });

  it("rejects an unknown action", () => {
    expect(() => applyProposalTransition("draft", "teleport")).toThrow();
  });
});

describe("assertTransitionComment", () => {
  it("requires a reason when rejecting or requesting changes", () => {
    expect(() =>
      assertTransitionComment("record_rejected", undefined),
    ).toThrow();
    expect(() => assertTransitionComment("request_changes", "   ")).toThrow();
    expect(() =>
      assertTransitionComment("record_rejected", "Budget exceeded"),
    ).not.toThrow();
  });

  it("does not require a comment for other actions", () => {
    expect(() =>
      assertTransitionComment("review_approve", undefined),
    ).not.toThrow();
  });
});

describe("isFollowUpDue", () => {
  const today = new Date("2026-10-24T09:00:00Z");

  it("is due when the date is today or earlier and the proposal is open", () => {
    expect(isFollowUpDue("sent", "2026-10-24", today)).toBe(true);
    expect(isFollowUpDue("draft", "2026-10-01", today)).toBe(true);
  });

  it("is not due for future dates, missing dates or closed proposals", () => {
    expect(isFollowUpDue("sent", "2026-10-25", today)).toBe(false);
    expect(isFollowUpDue("sent", null, today)).toBe(false);
    expect(isFollowUpDue("accepted", "2026-10-01", today)).toBe(false);
    expect(isFollowUpDue("archived", "2026-10-01", today)).toBe(false);
  });
});

describe("Proposal Templates Section Integrity & Validation", () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  });

  it("preserves section objects without converting them into empty arrays", async () => {
    const rawInput = {
      name: "Engineering Proposal",
      title: "Client Technical Proposal",
      schemaJson: [
        {
          id: "sec-1",
          title: "Executive Summary",
          type: "short_text",
          order: 1,
          defaultContent: "Summary text",
        },
        {
          id: "sec-2",
          title: "Scope of Work",
          type: "long_text",
          order: 2,
          defaultContent: "Line 1\nLine 2\nLine 3",
        },
      ],
    };

    const transformed = (await pipe.transform(rawInput, {
      type: "body",
      metatype: CreateProposalTemplateDto,
    })) as CreateProposalTemplateDto;

    expect(transformed.schemaJson).toHaveLength(2);
    expect(transformed.schemaJson?.[0]).toEqual({
      id: "sec-1",
      title: "Executive Summary",
      type: "short_text",
      order: 1,
      defaultContent: "Summary text",
    });
    expect(transformed.schemaJson?.[1]).toEqual({
      id: "sec-2",
      title: "Scope of Work",
      type: "long_text",
      order: 2,
      defaultContent: "Line 1\nLine 2\nLine 3",
    });
  });

  it("preserves schemaJson with table columns, default rows, and key-values on UpdateProposalTemplateDto", async () => {
    const rawUpdate = {
      schemaJson: [
        {
          id: "sec-kv",
          title: "Project Parameters",
          type: "key_value",
          order: 1,
          keyValueFields: [
            {
              id: "budget",
              label: "Total Budget",
              defaultValue: "500000",
              type: "currency",
            },
            {
              id: "duration",
              label: "Timeline",
              defaultValue: "3 Months",
              type: "text",
            },
          ],
        },
        {
          id: "sec-table",
          title: "Deliverables & Pricing",
          type: "table",
          order: 2,
          tableColumns: [
            { id: "col-1", name: "Milestone", type: "text" },
            { id: "col-2", name: "Amount", type: "currency" },
          ],
          defaultRows: [
            { "col-1": "Phase 1 Discovery", "col-2": "100000" },
            { "col-1": "Phase 2 Delivery", "col-2": "400000" },
          ],
        },
      ],
    };

    const transformed = (await pipe.transform(rawUpdate, {
      type: "body",
      metatype: UpdateProposalTemplateDto,
    })) as UpdateProposalTemplateDto;

    expect(transformed.schemaJson).toHaveLength(2);
    expect(transformed.schemaJson?.[0]).toEqual(rawUpdate.schemaJson[0]);
    expect(transformed.schemaJson?.[1]).toEqual(rawUpdate.schemaJson[1]);
  });

  it("normalizes sections, filters empty arrays, and fills defaults", () => {
    const corruptInput = [
      [],
      null,
      {
        id: "valid-1",
        title: "Introduction",
        type: "short_text",
        order: 1,
        defaultContent: "Intro body",
      },
      {},
    ];

    const normalized = normalizeSections(corruptInput);
    expect(normalized).toHaveLength(2);
    expect(normalized[0]).toMatchObject({
      id: "valid-1",
      title: "Introduction",
      type: "short_text",
      order: 1,
      defaultContent: "Intro body",
    });
    expect(normalized[1]).toMatchObject({
      title: "Section 4",
      type: "short_text",
      order: 4,
    });
    expect(normalized[1]!.id).toBeDefined();
  });

  it("preserves newlines in long_text defaultContent and list items", () => {
    const input = [
      {
        id: "sec-long",
        title: "Terms",
        type: "long_text",
        defaultContent: "Clause 1\nClause 2\nClause 3",
      },
      {
        id: "sec-list",
        title: "Deliverables",
        type: "bullet_list",
        defaultItems: ["Design mockups", "Backend API", "Testing"],
      },
    ];

    const normalized = normalizeSections(input);
    expect(normalized[0]!.defaultContent).toBe("Clause 1\nClause 2\nClause 3");
    expect(normalized[1]!.defaultItems).toEqual([
      "Design mockups",
      "Backend API",
      "Testing",
    ]);
  });

  it("sanitizes key_value fields with default values and types", () => {
    const input = [
      {
        id: "sec-kv",
        title: "Commercials",
        type: "key_value",
        keyValueFields: [
          {
            id: "f1",
            label: "Estimated Cost",
            defaultValue: "75000",
            type: "currency",
          },
          { id: "f2", label: "Validity", value: "30 Days", type: "text" },
          null, // corrupted entry
        ],
      },
    ];

    const normalized = normalizeSections(input);
    expect(normalized[0]!.keyValueFields).toHaveLength(2);
    expect(normalized[0]!.keyValueFields).toEqual([
      {
        id: "f1",
        label: "Estimated Cost",
        defaultValue: "75000",
        type: "currency",
      },
      { id: "f2", label: "Validity", defaultValue: "30 Days", type: "text" },
    ]);
  });

  it("sanitizes table columns and default rows", () => {
    const input = [
      {
        id: "sec-table",
        title: "Itemized Quote",
        type: "table",
        tableColumns: [
          { id: "c1", name: "Item", type: "text" },
          { id: "c2", name: "Price", type: "currency" },
        ],
        defaultRows: [
          { c1: "Server Setup", c2: "25000" },
          { c1: "Migration", c2: "50000" },
        ],
      },
    ];

    const normalized = normalizeSections(input);
    expect(normalized[0]!.tableColumns).toHaveLength(2);
    expect(normalized[0]!.defaultRows).toHaveLength(2);
    expect((normalized[0]!.defaultRows as Record<string, string>[])[0]).toEqual(
      {
        c1: "Server Setup",
        c2: "25000",
      },
    );
  });

  it("handles recursive nested section_group hierarchies", () => {
    const input = [
      {
        id: "group-1",
        title: "Parent Group",
        type: "section_group",
        children: [
          {
            id: "child-1",
            title: "Child Summary",
            type: "short_text",
            defaultContent: "Sub content",
          },
        ],
      },
    ];

    const normalized = normalizeSections(input);
    expect(normalized).toHaveLength(1);
    expect(normalized[0]!.children).toHaveLength(1);
    expect(
      (normalized[0]!.children as Record<string, unknown>[])[0],
    ).toMatchObject({
      id: "child-1",
      title: "Child Summary",
      type: "short_text",
      defaultContent: "Sub content",
    });
  });

  it("ensures duplicate section IDs are disambiguated and unique", () => {
    const input = [
      { id: "duplicate-id", title: "Section A", type: "short_text" },
      { id: "duplicate-id", title: "Section B", type: "short_text" },
    ];

    const normalized = normalizeSections(input);
    expect(normalized[0]!.id).toBe("duplicate-id");
    expect(normalized[1]!.id).not.toBe("duplicate-id");
    expect(String(normalized[1]!.id).startsWith("duplicate-id")).toBe(true);
  });

  it("handles checklist sections with unique and duplicate items", () => {
    const input = [
      {
        id: "sec-check",
        title: "Compliance Checklist",
        type: "checklist",
        defaultItems: ["Item A", "sd", "sd", "Item B"],
      },
    ];

    const normalized = normalizeSections(input);
    expect(normalized[0]!.defaultItems).toEqual([
      "Item A",
      "sd",
      "sd",
      "Item B",
    ]);
  });

  it("enforces key-value field types (number, currency, date DD/MM/YYYY)", () => {
    const input = [
      {
        id: "sec-kv-types",
        title: "Specifications",
        type: "key_value",
        keyValueFields: [
          { id: "f1", label: "Quantity", defaultValue: "42", type: "number" },
          {
            id: "f2",
            label: "Invalid Quantity",
            defaultValue: "invalid-abc",
            type: "number",
          },
          {
            id: "f3",
            label: "Rate",
            defaultValue: "1500.50",
            type: "currency",
          },
          {
            id: "f4",
            label: "Invalid Rate",
            defaultValue: "50k",
            type: "currency",
          },
          {
            id: "f5",
            label: "Valid Date",
            defaultValue: "15/08/2026",
            type: "date",
          },
          {
            id: "f6",
            label: "Impossible Date",
            defaultValue: "31/02/2026",
            type: "date",
          },
          {
            id: "f7",
            label: "Email",
            defaultValue: "admin@texawave.com",
            type: "email",
          },
          {
            id: "f8",
            label: "Phone",
            defaultValue: "+91 9444180741",
            type: "phone",
          },
          {
            id: "f9",
            label: "Too Long Phone",
            defaultValue: "9444180741123",
            type: "phone",
          },
          {
            id: "f10",
            label: "Too Short Phone",
            defaultValue: "123456789",
            type: "phone",
          },
          {
            id: "f11",
            label: "Letters Phone",
            defaultValue: "12345abc90",
            type: "phone",
          },
        ],
      },
    ];

    const normalized = normalizeSections(input);
    const fields = normalized[0]!.keyValueFields as Record<string, string>[];
    expect(fields[0]!.defaultValue).toBe("42");
    expect(fields[1]!.defaultValue).toBe(""); // invalid number cleaned
    expect(fields[2]!.defaultValue).toBe("1500.50");
    expect(fields[3]!.defaultValue).toBe(""); // invalid currency cleaned
    expect(fields[4]!.defaultValue).toBe("15/08/2026");
    expect(fields[5]!.defaultValue).toBe(""); // impossible date cleaned
    expect(fields[6]!.defaultValue).toBe("admin@texawave.com");
    expect(fields[7]!.defaultValue).toBe("+91 9444180741");
    expect(fields[8]!.defaultValue).toBe(""); // > 10 digits cleaned
    expect(fields[9]!.defaultValue).toBe(""); // < 10 digits cleaned
    expect(fields[10]!.defaultValue).toBe(""); // letters cleaned
  });

  it("enforces table column types and default row cells", () => {
    const input = [
      {
        id: "sec-table-types",
        title: "Milestone Pricing",
        type: "table",
        tableColumns: [
          { id: "c1", name: "Description", type: "text" },
          { id: "c2", name: "Hours", type: "number" },
          { id: "c3", name: "Fee", type: "currency" },
          { id: "c4", name: "Deadline", type: "date" },
        ],
        defaultRows: [
          {
            c1: "Discovery",
            c2: "40",
            c3: "80000",
            c4: "15/05/2026",
          },
          {
            c1: "Invalid Row",
            c2: "forty", // invalid number
            c3: "expensive", // invalid currency
            c4: "31/02/2026", // impossible date
          },
        ],
      },
    ];

    const normalized = normalizeSections(input);
    const rows = normalized[0]!.defaultRows as Record<string, string>[];
    expect(rows[0]).toEqual({
      c1: "Discovery",
      c2: "40",
      c3: "80000",
      c4: "15/05/2026",
    });
    expect(rows[1]).toEqual({
      c1: "Invalid Row",
      c2: "",
      c3: "",
      c4: "",
    });
  });
});
