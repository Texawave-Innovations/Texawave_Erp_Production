// Local browser persistence for the SCM Copilot's conversation. Deliberately NOT Firebase —
// this is per-browser chat history, not SCM business data, so it has no business living in
// the same store as suppliers/orders/inventory. Every read/write is wrapped so a blocked,
// full, or unavailable `localStorage` (private browsing, storage quota, an old/garbled
// payload) degrades to "start a fresh conversation" instead of throwing.
import type { ScmAiMessage } from "./scmAiTypes";

/** Namespaced so this can never collide with another feature's `localStorage` key. */
export const SCM_AI_HISTORY_KEY = "texa_scm_copilot_history";

/** Hard cap on stored messages — keeps `localStorage` usage bounded for a long-running
 * conversation without needing a rolling cleanup job. */
const MAX_STORED_MESSAGES = 60;

function isValidMessage(value: unknown): value is ScmAiMessage {
  if (!value || typeof value !== "object") return false;
  const m = value as Record<string, unknown>;
  return (
    typeof m.id === "string" &&
    (m.role === "user" || m.role === "bot") &&
    typeof m.text === "string" &&
    typeof m.timestamp === "number"
  );
}

/** Returns the saved conversation, or `null` if none exists / the stored payload is missing,
 * malformed, or from an incompatible older shape — callers fall back to a fresh welcome
 * message in that case, never a crash. */
export function loadScmAiHistory(): ScmAiMessage[] | null {
  try {
    const raw = window.localStorage.getItem(SCM_AI_HISTORY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.messages)
        ? parsed.messages
        : null;
    if (!list) return null;
    const messages = list.filter(isValidMessage);
    return messages.length > 0 ? messages : null;
  } catch {
    return null;
  }
}

export function saveScmAiHistory(messages: ScmAiMessage[]): void {
  try {
    const trimmed = messages.slice(-MAX_STORED_MESSAGES);
    window.localStorage.setItem(SCM_AI_HISTORY_KEY, JSON.stringify(trimmed));
  } catch {
    // Storage full/unavailable (e.g. private browsing) — the conversation still works for
    // this session, it just won't survive a reload. Never break the chat over this.
  }
}

export function clearScmAiHistory(): void {
  try {
    window.localStorage.removeItem(SCM_AI_HISTORY_KEY);
  } catch {
    // Nothing to do if storage itself is unavailable.
  }
}
