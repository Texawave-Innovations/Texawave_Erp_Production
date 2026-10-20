"use client";

import { Button, PageHeader } from "@texawave-erp/ui-kit";
import { Bot, Trash2 } from "lucide-react";
import { useState } from "react";
import { ChatInput, ChatThread, SuggestionChips } from "../assistant/ChatParts";
import { BOT_NAME, BOT_TAGLINE, useAssistantChat } from "../assistant/chat";

/** SCM Copilot — port of the legacy `ScmAiChatbot`. It is the same kind of
 * assistant the legacy ERP had: a deterministic, scored intent classifier that
 * answers from this organization's live SCM data (no external AI service, no
 * API key), with deep links into the matching screens, always-visible
 * suggestions and a chat history that survives a reload. */
export function AssistantView() {
  const { messages, send, clear, thinking } = useAssistantChat();
  const [confirmingClear, setConfirmingClear] = useState(false);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        variant="banner"
        icon={Bot}
        title={BOT_NAME}
        description={BOT_TAGLINE}
        action={
          <Button
            variant="secondary"
            size="sm"
            className="gap-2"
            onClick={() => setConfirmingClear(true)}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Clear Chat
          </Button>
        }
      />
      <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-dark">
        <ChatThread
          messages={messages}
          thinking={thinking}
          className="max-h-[28rem] min-h-[16rem] rounded-xl bg-gray-50 p-3 dark:bg-gray-900/40"
        />
        {confirmingClear ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-700">
            <span className="text-theme-sm font-medium text-gray-700 dark:text-gray-300">
              Clear this conversation?
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setConfirmingClear(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  clear();
                  setConfirmingClear(false);
                }}
              >
                Clear Chat
              </Button>
            </div>
          </div>
        ) : (
          <SuggestionChips onSelect={(p) => void send(p)} disabled={thinking} />
        )}
        <ChatInput onSend={(t) => void send(t)} disabled={thinking} />
      </div>
    </div>
  );
}
