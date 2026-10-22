import { SCM_AI_SUGGESTED_PROMPTS } from "../scmAiPrompts";

interface ScmAiSuggestionsProps {
  onSelect: (prompt: string) => void;
  disabled?: boolean;
}

/** Compact, wrapping suggestion chips shown when the conversation is empty (spec section 4). */
export default function ScmAiSuggestions({
  onSelect,
  disabled,
}: ScmAiSuggestionsProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {SCM_AI_SUGGESTED_PROMPTS.map((prompt) => (
        <button
          key={prompt}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(prompt)}
          className="rounded-full border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-slate-600 outline-none transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 focus-visible:ring-2 focus-visible:ring-brand-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {prompt}
        </button>
      ))}
    </div>
  );
}
