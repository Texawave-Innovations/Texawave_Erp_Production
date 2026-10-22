"use client";

// Themed replacement for the native `<input type="date">` across the CRM module — the browser's
// own date popup can't be restyled (it's an OS-native control), so this uses the app's
// already brand-green-themed `Calendar` component inside a Popover instead.
import { useState } from "react";
import { addYears, subYears } from "date-fns";
import { CalendarIcon, ChevronUp, ChevronDown, X } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/legacy-ui/popover";
import { Calendar } from "@/components/legacy-ui/calendar";
import { Button } from "@/components/legacy-ui/button";
import { cn } from "@/components/legacy-ui/utils";
import {
  formatDisplayDate,
  toIsoDate as toValue,
  parseIsoDate as parseValue,
  BRAND_CALENDAR_CLASSNAMES,
} from "./dateFormat";

export function DatePicker({
  value,
  onChange,
  className,
  placeholder = "dd-mm-yyyy",
  min,
  max,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  /** 'yyyy-MM-dd' — same format as `value`. Dates before/after these are not selectable. */
  min?: string;
  max?: string;
}) {
  const [open, setOpen] = useState(false);
  const date = parseValue(value);
  const display = formatDisplayDate(date);
  const minDate = parseValue(min);
  const maxDate = parseValue(max);

  // The month/year the calendar grid is currently showing — kept in our own state (rather than
  // react-day-picker's own `defaultMonth`) purely so the "jump a year" buttons below have
  // something to drive; re-synced to the selected/current date each time the popover opens.
  const [month, setMonth] = useState(date || new Date());
  // Re-sync only on the closed -> open transition (adjust-state-during-render, not an effect).
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) setMonth(date || new Date());
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-10 w-full items-center gap-2 rounded-xl border border-input bg-background px-3 py-2 text-sm text-left",
            !display && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="h-4 w-4 text-slate-400 shrink-0" />
          <span className="flex-1">{display || placeholder}</span>
          {display && (
            <X
              className="h-3.5 w-3.5 text-slate-400 hover:text-slate-700 shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
            />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0 rounded-2xl overflow-hidden"
        align="start"
      >
        <div className="bg-gradient-to-br from-brand-50 to-white">
          <div className="flex items-center justify-end gap-1 px-3 pt-2.5">
            <span className="text-xs font-semibold text-brand-700 mr-auto">
              Jump a year
            </span>
            <button
              type="button"
              aria-label="Previous year"
              onClick={() => setMonth((m) => subYears(m, 1))}
              className="h-6 w-6 flex items-center justify-center rounded-md text-brand-600 hover:bg-brand-100 hover:text-brand-700 transition-colors"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              aria-label="Next year"
              onClick={() => setMonth((m) => addYears(m, 1))}
              className="h-6 w-6 flex items-center justify-center rounded-md text-brand-600 hover:bg-brand-100 hover:text-brand-700 transition-colors"
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </button>
          </div>
          <Calendar
            mode="single"
            selected={date}
            month={month}
            onMonthChange={setMonth}
            classNames={BRAND_CALENDAR_CLASSNAMES}
            disabled={[
              ...(minDate ? [{ before: minDate }] : []),
              ...(maxDate ? [{ after: maxDate }] : []),
            ]}
            onSelect={(d) => {
              onChange(toValue(d));
              setOpen(false);
            }}
            initialFocus
          />
        </div>
        <div className="border-t border-brand-100 p-2 flex gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="flex-1 rounded-lg text-xs text-brand-700 hover:bg-brand-50 hover:text-brand-800"
            onClick={() => {
              onChange(toValue(new Date()));
              setOpen(false);
            }}
          >
            Today
          </Button>
          {display && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="flex-1 rounded-lg text-xs text-slate-500 hover:bg-slate-100"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              Clear date
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
