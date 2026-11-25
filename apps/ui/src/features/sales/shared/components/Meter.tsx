/** A labelled 0–100 progress bar (role="meter"). */
export function Meter({ label, percent }: { label: string; percent: number }) {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between text-theme-sm">
        <span className="text-gray-600 dark:text-gray-300">{label}</span>
        <span className="font-semibold text-gray-900 dark:text-white/90">
          {percent}%
        </span>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={clamped}
        className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"
      >
        <div
          className="h-full rounded-full bg-brand-500"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
