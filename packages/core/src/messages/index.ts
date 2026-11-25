import { ApiError } from "../api/api-error";
import catalogue from "./messages.json";

/**
 * Central user-facing messages (toasts). Wording lives in `messages.json`; a
 * call site names a key, so a typo is a compile error and the same event
 * always reads the same everywhere. Placeholders are `{name}`; pass the
 * values as `params`.
 */
export type MessageKey = keyof typeof catalogue.messages;
export type MessageVariant = "info" | "success" | "warning" | "error";
export type MessageParams = Record<string, string | number | null | undefined>;

export interface ResolvedMessage {
  title: string;
  description?: string;
  variant: MessageVariant;
}

interface MessageEntry {
  variant: MessageVariant;
  title: string;
  description?: string;
}

const MESSAGES: Record<MessageKey, MessageEntry> = catalogue.messages as Record<
  MessageKey,
  MessageEntry
>;

/** API `errorCode` → message key, for failures with a dedicated message. */
const ERROR_CODES: Record<string, MessageKey> = catalogue.errorCodes as Record<
  string,
  MessageKey
>;

function fill(template: string, params: MessageParams): string {
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    String(params[name] ?? ""),
  );
}

export function resolveMessage(
  key: MessageKey,
  params: MessageParams = {},
): ResolvedMessage {
  const entry = MESSAGES[key];
  return {
    variant: entry.variant,
    title: fill(entry.title, params),
    ...(entry.description
      ? { description: fill(entry.description, params) }
      : {}),
  };
}

/** The dedicated message for the API's `errorCode`, when there is one. */
function messageForErrorCode(
  error: unknown,
  params: MessageParams,
): ResolvedMessage | undefined {
  if (!(error instanceof ApiError)) return undefined;
  const keyForCode = ERROR_CODES[error.errorCode];
  return keyForCode ? resolveMessage(keyForCode, params) : undefined;
}

/**
 * The message for a failed action: a dedicated message when the API's
 * `errorCode` has one, else the API's own message, else `fallback`. The API's
 * message is the whole title — use this when it reads well on its own.
 */
export function resolveErrorMessage(
  error: unknown,
  fallback: MessageKey,
  params: MessageParams = {},
): ResolvedMessage {
  const coded = messageForErrorCode(error, params);
  if (coded) return coded;
  if (error instanceof ApiError && error.message) {
    return { variant: "error", title: error.message };
  }
  return resolveMessage(fallback, params);
}

/**
 * A failed action that keeps its own headline: the title (and hint) come from
 * `key`, and the API's message — when it sent one — replaces the hint as the
 * description underneath ("Could not duplicate" / "Name already in use"). A
 * dedicated message for the API's `errorCode` still wins outright.
 */
export function resolveFailureMessage(
  error: unknown,
  key: MessageKey,
  params: MessageParams = {},
): ResolvedMessage {
  const coded = messageForErrorCode(error, params);
  if (coded) return coded;
  const base = resolveMessage(key, params);
  const reason =
    error instanceof ApiError && error.message && error.message !== base.title
      ? error.message
      : undefined;
  const description = reason ?? base.description;
  return {
    variant: base.variant,
    title: base.title,
    ...(description ? { description } : {}),
  };
}

/** The same as `resolveErrorMessage`, as plain text — for inline form errors. */
export function resolveErrorText(
  error: unknown,
  fallback: MessageKey,
  params: MessageParams = {},
): string {
  return resolveErrorMessage(error, fallback, params).title;
}

/** Every key, for tests that check the catalogue itself. */
export const MESSAGE_KEYS = Object.keys(MESSAGES) as MessageKey[];
export const ERROR_CODE_TARGETS = Object.values(ERROR_CODES);
