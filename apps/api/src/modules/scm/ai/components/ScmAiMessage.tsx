import { useNavigate } from "react-router-dom";
import { Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ScmAiMessage as ScmAiMessageType } from "../scmAiTypes";

interface ScmAiMessageProps {
  message: ScmAiMessageType;
  onNavigate?: () => void;
}

/** One chat bubble. User messages are right-aligned in brand green; bot messages are
 * left-aligned on white with a small Bot avatar, matching the ERP's existing card/border
 * conventions rather than a generic chat-widget look. */
export default function ScmAiMessage({
  message,
  onNavigate,
}: ScmAiMessageProps) {
  const navigate = useNavigate();
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-2", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-white">
          <Bot className="h-3.5 w-3.5" />
        </span>
      )}
      <div
        className={cn(
          "max-w-[80%] space-y-2",
          isUser && "flex flex-col items-end",
        )}
      >
        <div
          className={cn(
            "whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-relaxed shadow-xs",
            isUser
              ? "rounded-tr-sm bg-brand-500 text-white"
              : "rounded-tl-sm border border-slate-200 bg-white text-slate-700",
          )}
        >
          {message.text}
        </div>
        {!isUser && message.navActions && message.navActions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {message.navActions.map((action) => (
              <button
                key={action.path}
                type="button"
                onClick={() => {
                  navigate(action.path);
                  onNavigate?.();
                }}
                className="rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-[12px] font-medium text-brand-700 outline-none transition-colors hover:bg-brand-100 focus-visible:ring-2 focus-visible:ring-brand-300"
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
