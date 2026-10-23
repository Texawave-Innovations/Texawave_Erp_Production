import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bot, Loader2, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useScmAiContext, type ScmAiContext } from "../scmAiContext";
import { detectIntent } from "../scmAiIntent";
import { answerIntent } from "../scmAiService";
import {
  loadScmAiHistory,
  saveScmAiHistory,
  clearScmAiHistory,
} from "../scmAiHistory";
import {
  SCM_AI_BOT_NAME,
  SCM_AI_HEADER_SUBTITLE,
  SCM_AI_WELCOME_MESSAGE,
} from "../scmAiPrompts";
import type { ScmAiMessage as ScmAiMessageType } from "../scmAiTypes";
import ScmAiMessage from "./ScmAiMessage";
import ScmAiSuggestions from "./ScmAiSuggestions";
import ScmAiInput from "./ScmAiInput";

let msgSeq = 0;
const nextId = () => `scm-ai-${Date.now()}-${msgSeq++}`;

const welcomeMessage = (): ScmAiMessageType => ({
  id: nextId(),
  role: "bot",
  text: SCM_AI_WELCOME_MESSAGE,
  timestamp: Date.now(),
});

/**
 * Mounted only once the panel actually needs live SCM numbers (the user's first question, not
 * merely opening the panel — see `ScmAiPanel`). Reports the (reference-stable, see
 * `scmAiContext.ts`) context up to the parent on every real change, so the parent can hold plain
 * state instead of every consumer re-implementing the data hook.
 */
function ScmAiDataBridge({
  onUpdate,
}: {
  onUpdate: (ctx: ScmAiContext) => void;
}) {
  const ctx = useScmAiContext();
  useEffect(() => {
    onUpdate(ctx);
  }, [ctx, onUpdate]);
  return null;
}

function ScmAiPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [messages, setMessages] = useState<ScmAiMessageType[]>(
    () => loadScmAiHistory() ?? [welcomeMessage()],
  );
  const [needsData, setNeedsData] = useState(false);
  const [liveCtx, setLiveCtx] = useState<ScmAiContext | null>(null);
  const [pendingQuestions, setPendingQuestions] = useState<string[]>([]);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Persist on every change — cheap for a chat-sized list, and guarantees the conversation
  // survives a close/reopen or a full page reload (spec: chat history).
  useEffect(() => {
    saveScmAiHistory(messages);
  }, [messages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, confirmingClear]);

  const respondTo = (text: string, ctx: ScmAiContext) => {
    const intent = detectIntent(text);
    const { text: answerText, navActions } = answerIntent(intent, ctx);
    setMessages((prev) => [
      ...prev,
      {
        id: nextId(),
        role: "bot",
        text: answerText,
        navActions,
        timestamp: Date.now(),
      },
    ]);
  };

  // Once the data bridge (mounted below on the user's first question) reports a ready,
  // non-loading context, answer every question that had to wait on it, in order.
  useEffect(() => {
    if (!liveCtx || liveCtx.loading || pendingQuestions.length === 0) return;
    const queue = pendingQuestions;
    setPendingQuestions([]);
    queue.forEach((q) => respondTo(q, liveCtx));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveCtx, pendingQuestions]);

  const handleSend = (text: string) => {
    setMessages((prev) => [
      ...prev,
      { id: nextId(), role: "user", text, timestamp: Date.now() },
    ]);
    setConfirmingClear(false);

    if (liveCtx && !liveCtx.loading) {
      respondTo(text, liveCtx);
      return;
    }
    // Data hasn't been fetched yet — it only starts now, on the first real question, never
    // merely because the panel was opened (spec section 3/13).
    setNeedsData(true);
    setPendingQuestions((prev) => [...prev, text]);
  };

  const handleClearConfirmed = () => {
    clearScmAiHistory();
    setMessages([welcomeMessage()]);
    setPendingQuestions([]);
    setConfirmingClear(false);
  };

  const isCheckingData = pendingQuestions.length > 0;

  return (
    <div
      className={cn(
        "fixed bottom-24 right-4 z-40 flex w-[380px] max-w-[92vw] flex-col overflow-hidden rounded-3xl border border-brand-200/50 bg-white shadow-2xl",
        "transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
        "max-h-[min(600px,calc(100vh-140px))] sm:right-6",
        open
          ? "translate-y-0 scale-100 opacity-100"
          : "pointer-events-none translate-y-4 scale-95 opacity-0",
      )}
      role="dialog"
      aria-label={SCM_AI_BOT_NAME}
      aria-hidden={!open}
    >
      {/* Header — same gradient family as the SCM module header, scaled down. */}
      <div className="relative flex shrink-0 items-center justify-between gap-2 overflow-hidden bg-gradient-to-br from-brand-500 to-brand-600 px-4 py-3 text-white">
        <span
          aria-hidden
          className="pointer-events-none absolute -left-8 -top-10 h-24 w-24 rounded-full bg-white/10 blur-2xl"
        />
        <div className="relative flex min-w-0 items-center gap-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white/15">
            <Bot className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold leading-tight">
              {SCM_AI_BOT_NAME}
            </p>
            <p className="truncate text-[11.5px] leading-tight text-white/80">
              {SCM_AI_HEADER_SUBTITLE}
            </p>
          </div>
        </div>
        <div className="relative flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setConfirmingClear(true)}
            aria-label="Clear chat"
            title="Clear chat"
            className="grid h-7 w-7 place-items-center rounded-lg text-white/90 outline-none transition-colors hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close chat"
            className="grid h-7 w-7 place-items-center rounded-lg text-white/90 outline-none transition-colors hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Conversation */}
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-50/60 p-3"
      >
        {messages.map((m) => (
          <ScmAiMessage key={m.id} message={m} onNavigate={onClose} />
        ))}
        {isCheckingData && (
          <div className="flex items-center gap-2 pl-8 text-[12px] text-slate-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking the latest
            SCM data…
          </div>
        )}
      </div>

      {/* Persistent suggestions — always available, not just on an empty conversation (spec
          section 2). Swapped out for an inline "Clear this conversation?" confirmation instead
          of a separate modal, so no new overlay pattern is introduced. */}
      {confirmingClear ? (
        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-slate-200 bg-white px-3 py-2.5">
          <span className="text-[12.5px] font-medium text-slate-600">
            Clear this conversation?
          </span>
          <div className="flex shrink-0 gap-1.5">
            <button
              type="button"
              onClick={() => setConfirmingClear(false)}
              className="rounded-full border border-slate-200 px-2.5 py-1 text-[12px] font-medium text-slate-600 outline-none transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-brand-300"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleClearConfirmed}
              className="rounded-full bg-rose-600 px-2.5 py-1 text-[12px] font-medium text-white outline-none transition-colors hover:bg-rose-700 focus-visible:ring-2 focus-visible:ring-rose-300"
            >
              Clear Chat
            </button>
          </div>
        </div>
      ) : (
        <div className="max-h-20 shrink-0 overflow-y-auto border-t border-slate-200 bg-white px-3 py-2">
          <ScmAiSuggestions onSelect={handleSend} />
        </div>
      )}

      <ScmAiInput onSend={handleSend} placeholder="Ask about SCM…" />

      {needsData && <ScmAiDataBridge onUpdate={setLiveCtx} />}
    </div>
  );
}

/** Floating AI button + panel for the SCM module (spec: additive-only widget, no existing SCM
 * business logic touched). Mounted once from `SCMLayout`, so it's present — and permission
 * scoped, since `SCMLayout` itself sits behind `ProtectedRoute module="scm"` — on every SCM page. */
export default function ScmAiChatbot() {
  const [open, setOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);

  const toggle = () => {
    setOpen((prev) => !prev);
    setHasOpened(true);
  };

  // Portaled to `document.body`, same as `SCMLayout`'s mobile nav drawer and
  // `ScmSidebarDesktop`'s flyout: keeps this positioned against the true viewport regardless of
  // any ancestor's CSS, rather than relying on none of them ever picking up a `transform`.
  return createPortal(
    <>
      <button
        type="button"
        onClick={toggle}
        aria-label={open ? "Close Texa SCM Copilot" : "Open Texa SCM Copilot"}
        aria-expanded={open}
        className={cn(
          "fixed bottom-4 right-4 z-40 grid h-14 w-14 place-items-center rounded-full text-white shadow-lg shadow-brand-500/30 outline-none",
          "bg-gradient-to-br from-brand-400 to-brand-600 transition-transform duration-200 ease-smooth hover:scale-105 focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-2 active:scale-95",
          "sm:bottom-6 sm:right-6",
        )}
      >
        {open ? <X className="h-6 w-6" /> : <Bot className="h-6 w-6" />}
      </button>

      {hasOpened && <ScmAiPanel open={open} onClose={() => setOpen(false)} />}
    </>,
    document.body,
  );
}
