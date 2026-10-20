"use client";

import type { AssistantNavAction } from "@texawave-erp/api-types";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { errorText } from "../../shared/use-list-controls";
import { useAssistantAsk } from "../hooks";

export interface ChatMessage {
  id: string;
  role: "user" | "bot";
  text: string;
  navActions?: AssistantNavAction[];
  timestamp: number;
}

export const BOT_NAME = "Texa SCM Copilot";
export const BOT_TAGLINE = "Your AI assistant for Supply Chain Management";

export const WELCOME_MESSAGE =
  "Hi! I'm Texa SCM Copilot. I can help you understand suppliers, procurement, inventory, warehouse operations, fulfillment, logistics, returns, quality, supplier bills and SCM reports.";

/** Always-visible suggestion chips, so nobody has to remember a working phrase.
 * Every one of these resolves to a real intent (covered by an API unit test). */
export const SUGGESTED_PROMPTS = [
  "Show SCM summary",
  "Which suppliers do we have?",
  "Show pending purchase orders",
  "Which products are low in stock?",
  "Show inventory status",
  "Show warehouse status",
  "Show pending/backordered orders",
  "Show shipment status",
  "Show returns",
  "Show quality issues",
  "Show supplier performance",
  "Show overdue supplier bills",
  "Open Control Tower",
] as const;

const MAX_STORED = 60;
let seq = 0;
const nextId = () => `scm-ai-${Date.now()}-${seq++}`;

const welcome = (): ChatMessage => ({
  id: nextId(),
  role: "bot",
  text: WELCOME_MESSAGE,
  timestamp: Date.now(),
});

function isValid(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") return false;
  const m = value as Record<string, unknown>;
  return (
    typeof m.id === "string" &&
    (m.role === "user" || m.role === "bot") &&
    typeof m.text === "string" &&
    typeof m.timestamp === "number"
  );
}

// Per-browser, per-organization chat history. It is conversation scratch
// space, not business data, so it lives in localStorage — and every access is
// wrapped so a blocked/full store degrades to "fresh conversation".
const storageKey = (organizationId: number | null) =>
  `texa_scm_copilot_history:${organizationId ?? 0}`;

function load(key: string): ChatMessage[] | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const list = parsed.filter(isValid);
    return list.length > 0 ? list : null;
  } catch {
    return null;
  }
}

function save(key: string, messages: ChatMessage[]): void {
  try {
    window.localStorage.setItem(
      key,
      JSON.stringify(messages.slice(-MAX_STORED)),
    );
  } catch {
    // Storage unavailable — the chat still works for this session.
  }
}

function clearStored(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Nothing to do.
  }
}

/** Conversation state shared by the full page and the floating widget. */
export function useAssistantChat() {
  const organizationId = useAuthStore((s) => s.organizationId);
  const key = storageKey(organizationId);
  const ask = useAssistantAsk();
  const [messages, setMessages] = useState<ChatMessage[]>(() => [welcome()]);
  const hydrated = useRef(false);

  // localStorage is only readable in the browser, so restore after mount
  // (avoids a server/client markup mismatch on the first paint).
  useEffect(() => {
    const stored = load(key);
    if (stored) setMessages(stored);
    hydrated.current = true;
  }, [key]);

  useEffect(() => {
    if (hydrated.current) save(key, messages);
  }, [key, messages]);

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text) return;
      setMessages((m) => [
        ...m,
        { id: nextId(), role: "user", text, timestamp: Date.now() },
      ]);
      try {
        const reply = await ask.mutateAsync(text);
        setMessages((m) => [
          ...m,
          {
            id: nextId(),
            role: "bot",
            text: reply.answer,
            navActions: reply.navActions,
            timestamp: Date.now(),
          },
        ]);
      } catch (err) {
        setMessages((m) => [
          ...m,
          {
            id: nextId(),
            role: "bot",
            text: errorText(err, "Something went wrong. Please try again."),
            timestamp: Date.now(),
          },
        ]);
      }
    },
    [ask],
  );

  const clear = useCallback(() => {
    clearStored(key);
    setMessages([welcome()]);
  }, [key]);

  return { messages, send, clear, thinking: ask.isPending };
}
