import test from "node:test";
import assert from "node:assert/strict";
import {
  ApiError,
  ERROR_CODE_TARGETS,
  MESSAGE_KEYS,
  resolveErrorMessage,
  resolveErrorText,
  resolveFailureMessage,
  resolveMessage,
} from "@texawave-erp/core";

test("fills placeholders and keeps the variant", () => {
  assert.deepEqual(
    resolveMessage("sales.document.deleted", { number: "Q-1" }),
    {
      variant: "success",
      title: "Q-1 deleted",
    },
  );
});

test("includes the description when the entry has one", () => {
  const m = resolveMessage("sales.quotation.converted", {
    label: "Tax invoice",
    number: "TI-9",
    quotation: "Q-1",
  });
  assert.equal(m.title, "Tax invoice TI-9 created");
  assert.equal(m.description, "Q-1 is now locked.");
});

test("a missing placeholder becomes empty, never a literal {name}", () => {
  assert.equal(resolveMessage("sales.customer.saved").title, " saved");
});

// Every placeholder gets a value, so a title made of only a placeholder is still non-empty.
const anyParams = new Proxy({}, { get: () => "x" }) as Record<string, string>;

test("every message has a title and a valid variant, no stray braces", () => {
  for (const key of MESSAGE_KEYS) {
    const m = resolveMessage(key, anyParams);
    assert.ok(m.title.length > 0, key);
    assert.ok(["info", "success", "warning", "error"].includes(m.variant), key);
    assert.ok(!/[{}]/.test(m.title + (m.description ?? "")), key);
  }
});

test("every errorCode points at a real message", () => {
  for (const key of ERROR_CODE_TARGETS)
    assert.ok(MESSAGE_KEYS.includes(key), key);
});

const api = (errorCode: string, message: string) =>
  new ApiError({
    statusCode: 409,
    error: errorCode,
    message,
    path: "/x",
    timestamp: "2026-11-25T00:00:00Z",
  });

test("error: a mapped errorCode wins over the API message", () => {
  const m = resolveErrorMessage(
    api("CUSTOMER_HAS_DOCUMENTS", "raw"),
    "sales.customer.deleteFailed",
    { name: "Acme" },
  );
  assert.equal(m.title, "Acme has documents and cannot be deleted");
});

test("error: an unmapped ApiError shows the API message", () => {
  const m = resolveErrorMessage(
    api("OTHER", "Nope"),
    "sales.document.deleteFailed",
  );
  assert.deepEqual(m, { variant: "error", title: "Nope" });
});

test("error: a non-API error falls back to the key", () => {
  const m = resolveErrorMessage(
    new Error("boom"),
    "sales.document.deleteFailed",
  );
  assert.equal(m.title, "Could not delete");
});

test("error: the attendance punch codes have their own messages", () => {
  const key = "selfService.punch.failed";
  assert.equal(
    resolveErrorMessage(api("ALREADY_CHECKED_IN", "raw"), key).title,
    "You are already checked in.",
  );
  assert.equal(
    resolveErrorMessage(api("NOT_CHECKED_IN", "raw"), key).title,
    "You are not checked in.",
  );
  // any other API error keeps its own message; a non-API error uses the key
  assert.equal(
    resolveErrorMessage(api("OTHER", "Shift has ended"), key).title,
    "Shift has ended",
  );
  assert.equal(
    resolveErrorMessage(new Error("boom"), key).title,
    "Failed to save attendance. Please try again.",
  );
});

test("a {reason} description left empty comes out empty (the toast hides it)", () => {
  assert.equal(resolveMessage("users.updateFailed").description, "");
  assert.equal(
    resolveMessage("users.updateFailed", { reason: "Locked" }).description,
    "Locked",
  );
});

test("failure: keeps the key's title and shows the API message underneath", () => {
  const m = resolveFailureMessage(
    api("OTHER", "Name is already in use"),
    "proposals.duplicateFailed",
  );
  assert.deepEqual(m, {
    variant: "error",
    title: "Could not duplicate",
    description: "Name is already in use",
  });
});

test("failure: without an API message the key's hint is the description", () => {
  const m = resolveFailureMessage(new Error("boom"), "proposals.createFailed");
  assert.deepEqual(m, {
    variant: "error",
    title: "Could not create the proposal",
    description: "Your entries are kept — try again.",
  });
});

test("failure: no hint and no API message means the title alone", () => {
  const m = resolveFailureMessage(
    new Error("boom"),
    "proposals.duplicateFailed",
  );
  assert.deepEqual(m, { variant: "error", title: "Could not duplicate" });
});

test("failure: the API message replaces the hint, it is not added to it", () => {
  const m = resolveFailureMessage(
    api("OTHER", "Title already used"),
    "proposals.createFailed",
  );
  assert.equal(m.description, "Title already used");
});

test("failure: a mapped errorCode still wins over the key", () => {
  const m = resolveFailureMessage(
    api("CUSTOMER_HAS_DOCUMENTS", "raw"),
    "proposals.duplicateFailed",
    { name: "Acme" },
  );
  assert.equal(m.title, "Acme has documents and cannot be deleted");
  assert.equal(m.description, undefined);
});

test("failure: an API message identical to the title is not repeated", () => {
  const m = resolveFailureMessage(
    api("OTHER", "Could not duplicate"),
    "proposals.duplicateFailed",
  );
  assert.deepEqual(m, { variant: "error", title: "Could not duplicate" });
});

test("inline error text: API message, else the catalogue wording", () => {
  assert.equal(
    resolveErrorText(
      api("OTHER", "Amount too high"),
      "sales.payment.saveFailed",
    ),
    "Amount too high",
  );
  assert.equal(
    resolveErrorText(new Error("x"), "sales.payment.saveFailed"),
    "Could not save the payment.",
  );
});
