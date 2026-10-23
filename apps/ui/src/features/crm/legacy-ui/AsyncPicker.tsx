"use client";

// Search-as-you-type single-select combobox. The parent owns the (debounced)
// server query, so the option list is never capped at the first page the way
// a plain <Select> over `limit: 100` rows is.
import { Button } from "@/components/legacy-ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/legacy-ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/legacy-ui/popover";
import { cn } from "@/components/legacy-ui/utils";
import { useDebouncedValue } from "@/features/hr/employees/hooks";
import { Check, ChevronsUpDown } from "lucide-react";
import { useEffect, useState } from "react";

export interface AsyncPickerOption {
  id: number;
  label: string;
  sublabel?: string | undefined;
}

export function AsyncPicker({
  selectedId,
  selectedLabel,
  placeholder,
  searchPlaceholder = "Type to search…",
  options,
  loading,
  onSearchChange,
  onSelect,
  className,
  invalid,
  disabled,
}: {
  selectedId?: number | undefined;
  selectedLabel?: string | undefined;
  placeholder: string;
  searchPlaceholder?: string;
  options: AsyncPickerOption[];
  loading: boolean;
  onSearchChange: (search: string) => void;
  onSelect: (option: AsyncPickerOption) => void;
  className?: string | undefined;
  invalid?: boolean | undefined;
  disabled?: boolean | undefined;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search.trim(), 250);
  useEffect(() => onSearchChange(debounced), [debounced, onSearchChange]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "h-9 w-full justify-between rounded-xl text-sm font-normal px-3",
            invalid && "border-red-400",
            className,
          )}
        >
          <span className={cn("truncate", !selectedLabel && "text-slate-400")}>
            {selectedLabel || placeholder}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-40 ml-1" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 rounded-xl" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            value={search}
            onValueChange={setSearch}
            placeholder={searchPlaceholder}
            className="text-xs h-9"
          />
          <CommandList>
            <CommandEmpty className="py-6 text-center text-sm text-slate-400">
              {loading ? "Searching…" : "No matches."}
            </CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.id}
                  value={String(o.id)}
                  onSelect={() => {
                    onSelect(o);
                    setOpen(false);
                  }}
                  className="text-xs cursor-pointer rounded-lg"
                >
                  <Check
                    className={cn(
                      "mr-2 h-3.5 w-3.5 shrink-0",
                      selectedId === o.id
                        ? "opacity-100 text-brand-600"
                        : "opacity-0",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-800 truncate">
                      {o.label}
                    </p>
                    {o.sublabel && (
                      <p className="text-sm text-slate-400 truncate">
                        {o.sublabel}
                      </p>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
