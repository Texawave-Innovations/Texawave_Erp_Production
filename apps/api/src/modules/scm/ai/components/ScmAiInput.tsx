import { useState, type KeyboardEvent } from "react";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScmAiInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function ScmAiInput({
  onSend,
  disabled,
  placeholder,
}: ScmAiInputProps) {
  const [value, setValue] = useState("");

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="flex items-center gap-2 border-t border-slate-200 bg-white p-3">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder ?? "Ask about SCM…"}
        className="h-9 flex-1 rounded-full border border-slate-200 bg-slate-50 px-3.5 text-[13.5px] text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-brand-300 focus:bg-white focus:ring-2 focus:ring-brand-300 disabled:cursor-not-allowed disabled:opacity-60"
      />
      <button
        type="button"
        onClick={submit}
        disabled={disabled || !value.trim()}
        aria-label="Send"
        className={cn(
          "grid h-9 w-9 shrink-0 place-items-center rounded-full text-white outline-none transition-all focus-visible:ring-2 focus-visible:ring-brand-300",
          disabled || !value.trim()
            ? "bg-slate-300"
            : "bg-brand-500 hover:bg-brand-600 active:scale-95",
        )}
      >
        <Send className="h-4 w-4" />
      </button>
    </div>
  );
}
