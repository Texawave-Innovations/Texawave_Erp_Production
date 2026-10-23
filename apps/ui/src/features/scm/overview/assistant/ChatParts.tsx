"use client";

import { Button } from "@texawave-erp/ui-kit";
import { Bot, Loader2, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SUGGESTED_PROMPTS, type ChatMessage } from "./chat";

function MessageBubble({
  message,
  onNavigate,
}: {
  message: ChatMessage;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const isUser = message.role === "user";
  return (
    <div className={`flex gap-2 ${isUser ? "justify-end" : "justify-start"}`}>
      {isUser ? null : (
        <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-600 text-white">
          <Bot className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      )}
      <div
        className={`flex max-w-[85%] flex-col gap-2 ${isUser ? "items-end" : "items-start"}`}
      >
        <div
          className={`whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-theme-sm leading-relaxed ${
            isUser
              ? "rounded-tr-sm bg-brand-600 text-white"
              : "rounded-tl-sm border border-gray-200 bg-white text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
          }`}
        >
          {message.text}
        </div>
        {!isUser && message.navActions && message.navActions.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {message.navActions.map((action) => (
              <button
                key={action.path}
                type="button"
                onClick={() => {
                  router.push(action.path);
                  onNavigate?.();
                }}
                className="rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-theme-xs font-medium text-brand-700 outline-none transition-colors hover:bg-brand-100 focus-visible:ring-2 focus-visible:ring-brand-300 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300"
              >
                {action.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** The scrolling conversation, pinned to the newest message. */
export function ChatThread({
  messages,
  thinking,
  className = "",
  onNavigate,
}: {
  messages: ChatMessage[];
  thinking: boolean;
  className?: string;
  onNavigate?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({
      top: ref.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, thinking]);
  return (
    <div
      ref={ref}
      role="log"
      aria-live="polite"
      aria-label="Conversation"
      className={`flex flex-col gap-3 overflow-y-auto ${className}`}
    >
      {messages.map((m) => (
        <MessageBubble
          key={m.id}
          message={m}
          {...(onNavigate ? { onNavigate } : {})}
        />
      ))}
      {thinking ? (
        <div className="flex items-center gap-2 pl-8 text-theme-xs text-gray-500 dark:text-gray-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          Checking the latest SCM data…
        </div>
      ) : null}
    </div>
  );
}

export function SuggestionChips({
  onSelect,
  disabled,
}: {
  onSelect: (prompt: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {SUGGESTED_PROMPTS.map((prompt) => (
        <button
          key={prompt}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(prompt)}
          className="rounded-full border border-gray-200 bg-white px-2.5 py-1.5 text-theme-xs font-medium text-gray-600 outline-none transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 focus-visible:ring-2 focus-visible:ring-brand-300 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          {prompt}
        </button>
      ))}
    </div>
  );
}

export function ChatInput({
  onSend,
  disabled,
  placeholder = "Ask about SCM…",
}: {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [value, setValue] = useState("");
  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue("");
  }
  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <input
        aria-label="Question"
        value={value}
        maxLength={500}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="h-10 min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 text-theme-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
      />
      <Button
        type="submit"
        disabled={disabled || !value.trim()}
        className="gap-2"
      >
        <Send className="h-4 w-4" aria-hidden="true" />
        Send
      </Button>
    </form>
  );
}
