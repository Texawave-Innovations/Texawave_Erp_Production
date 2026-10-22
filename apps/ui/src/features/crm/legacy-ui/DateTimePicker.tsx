"use client";

// Themed replacement for the native `<input type="datetime-local">` — the browser's own
// datetime-local popup can't be restyled (it's an OS-native control), so this composes the
// app's already brand-green-themed `Calendar` with a labeled time field inside a Popover.
import { useState } from "react";
import { addYears, subYears } from "date-fns";
import { CalendarIcon, ChevronUp, ChevronDown, X } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/legacy-ui/popover";
import { Calendar } from "@/components/legacy-ui/calendar";
import { Input } from "@/components/legacy-ui/input";
import { Label } from "@/components/legacy-ui/label";
import { Button } from "@/components/legacy-ui/button";
import { cn } from "@/components/legacy-ui/utils";
import {
  formatDisplayDate,
  pad,
  toIsoDate,
  parseIsoDate,
  BRAND_CALENDAR_CLASSNAMES,
} from "./dateFormat";

function toValue(date: Date | undefined, time: string): string {
  if (!date) return "";
  const [h, m] = (time || "00:00").split(":");
  const d = new Date(date);
  d.setHours(Number(h) || 0, Number(m) || 0, 0, 0);
  return `${toIsoDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Parses the combined `yyyy-MM-ddTHH:mm` value into its date and time parts, reusing the same
 *  (and same NaN-safe) date parsing DatePicker.tsx uses for its own value — a blank or malformed
 *  date portion resolves to `undefined` instead of an Invalid Date reaching the Calendar. */
function parseValue(value: string): { date: Date | undefined; time: string } {
  if (!value) return { date: undefined, time: "" };
  const [datePart, timePart] = value.split("T");
  return { date: parseIsoDate(datePart), time: timePart || "00:00" };
}

export function DateTimePicker({
  value,
  onChange,
  className,
  min,
  max,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  /** 'yyyy-MM-dd' — the date the picker's day is not allowed before/after (time is unrestricted). */
  min?: string;
  max?: string;
}) {
  const [open, setOpen] = useState(false);
  const { date, time } = parseValue(value);
  const dateDisplay = formatDisplayDate(date);
  const display = dateDisplay ? `${dateDisplay}${time ? ` ${time}` : ""}` : "";
  const minDate = parseIsoDate(min);
  const maxDate = parseIsoDate(max);

  // See DatePicker.tsx — same self-managed "current month" state purely to drive the year
  // up/down buttons below, re-synced to the selected/current date each time the popover opens.
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
          <span className="flex-1">{display || "dd-mm-yyyy --:--"}</span>
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
            onSelect={(d) => d && onChange(toValue(d, time || "00:00"))}
            initialFocus
          />
        </div>
        <div className="border-t border-brand-100 p-3 space-y-1.5">
          <Label className="text-xs font-bold text-slate-600">Time</Label>
          <Input
            type="time"
            value={time}
            onChange={(e) =>
              onChange(toValue(date || new Date(), e.target.value))
            }
            className="rounded-xl"
          />
        </div>
        <div className="border-t border-brand-100 p-2 flex gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="flex-1 rounded-lg text-xs text-brand-700 hover:bg-brand-50 hover:text-brand-800"
            onClick={() => onChange(toValue(new Date(), time || "00:00"))}
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
              Clear
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
