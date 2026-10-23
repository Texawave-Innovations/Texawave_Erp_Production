"use client";

import { Bot, Trash2, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { usePermission } from "@/hooks/usePermission";
import { ChatInput, ChatThread, SuggestionChips } from "./ChatParts";
import { BOT_NAME, useAssistantChat } from "./chat";

function Panel({ onClose }: { onClose: () => void }) {
  const { messages, send, clear, thinking } = useAssistantChat();
  const [confirmingClear, setConfirmingClear] = useState(false);
  return (
    <div
      role="dialog"
      aria-label={BOT_NAME}
      className="fixed bottom-40 right-4 z-40 flex max-h-[min(600px,calc(100vh-200px))] w-[380px] max-w-[92vw] flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl sm:right-6 dark:border-gray-700 dark:bg-gray-900"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 bg-brand-600 px-4 py-3 text-white">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white/15">
            <Bot className="h-[18px] w-[18px]" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-theme-sm font-semibold leading-tight">
              {BOT_NAME}
            </p>
            <p className="truncate text-theme-xs leading-tight text-white/80">
              SCM Assistant
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setConfirmingClear(true)}
            aria-label="Clear chat"
            title="Clear chat"
            className="grid h-7 w-7 place-items-center rounded-lg text-white/90 outline-none hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close chat"
            className="grid h-7 w-7 place-items-center rounded-lg text-white/90 outline-none hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <ChatThread
        messages={messages}
        thinking={thinking}
        onNavigate={onClose}
        className="min-h-0 flex-1 bg-gray-50 p-3 dark:bg-gray-950"
      />
      {confirmingClear ? (
        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-gray-200 px-3 py-2.5 dark:border-gray-700">
          <span className="text-theme-xs font-medium text-gray-600 dark:text-gray-300">
            Clear this conversation?
          </span>
          <div className="flex shrink-0 gap-1.5">
            <button
              type="button"
              onClick={() => setConfirmingClear(false)}
              className="rounded-full border border-gray-200 px-2.5 py-1 text-theme-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                clear();
                setConfirmingClear(false);
              }}
              className="rounded-full bg-error-600 px-2.5 py-1 text-theme-xs font-medium text-white hover:bg-error-700"
            >
              Clear Chat
            </button>
          </div>
        </div>
      ) : (
        <div className="max-h-20 shrink-0 overflow-y-auto border-t border-gray-200 px-3 py-2 dark:border-gray-700">
          <SuggestionChips onSelect={(p) => void send(p)} disabled={thinking} />
        </div>
      )}
      <div className="shrink-0 border-t border-gray-200 p-3 dark:border-gray-700">
        <ChatInput onSend={(t) => void send(t)} disabled={thinking} />
      </div>
    </div>
  );
}

/** Floating Copilot launcher shown on every SCM screen (legacy
 * `ScmAiChatbot`). Hidden on the Assistant page itself, where the same chat
 * is already the page, and for users without `scm.overview.read`. The panel
 * (and so its data requests) only mounts once it is opened. */
export function AssistantWidget() {
  const pathname = usePathname();
  const allowed = usePermission("scm.overview.read");
  const [open, setOpen] = useState(false);
  const [everOpened, setEverOpened] = useState(false);

  if (
    !allowed ||
    !pathname.startsWith("/scm") ||
    pathname.startsWith("/scm/assistant")
  ) {
    return null;
  }
  return (
    <>
      <div
        className={`fixed bottom-20 right-4 z-40 grid h-16 w-16 place-items-center sm:bottom-20 sm:right-6 ${open ? "" : "scm-copilot-bob"}`}
      >
        {open ? null : (
          <>
            <span
              aria-hidden="true"
              className="scm-copilot-aura pointer-events-none absolute inset-1 rounded-full bg-brand-500"
            />
            <span
              aria-hidden="true"
              className="scm-copilot-spin-ring pointer-events-none absolute inset-0 rounded-full p-[2.5px] [mask:radial-gradient(farthest-side,transparent_calc(100%-2.5px),#000_calc(100%-2.5px))]"
            />
            <span
              aria-hidden="true"
              className="scm-copilot-satellite pointer-events-none absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-300 shadow-[0_0_6px_2px_rgba(147,197,253,0.8)]"
            />
            <span
              aria-hidden="true"
              className="scm-copilot-twinkle pointer-events-none absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-white shadow-[0_0_6px_1px_rgba(255,255,255,0.9)]"
            />
            <span
              aria-hidden="true"
              className="scm-copilot-twinkle-delay pointer-events-none absolute -bottom-0.5 -left-0.5 h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_5px_1px_rgba(255,255,255,0.9)]"
            />
          </>
        )}
        <button
          type="button"
          onClick={() => {
            setOpen((o) => !o);
            setEverOpened(true);
          }}
          aria-label={open ? `Close ${BOT_NAME}` : `Open ${BOT_NAME}`}
          aria-expanded={open}
          className={`relative grid h-14 w-14 place-items-center rounded-full text-white outline-none transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-2 active:scale-95 ${
            open
              ? "bg-brand-600 shadow-lg hover:bg-brand-700"
              : "scm-copilot-orb shadow-lg shadow-brand-900/20 bg-gradient-to-br from-brand-400 via-blue-600 to-brand-700"
          }`}
        >
          {open ? <X className="h-6 w-6" /> : <Bot className="h-6 w-6" />}
        </button>
      </div>
      {everOpened && open ? <Panel onClose={() => setOpen(false)} /> : null}
    </>
  );
}
