// Phase 12b — the one reusable master-data autocomplete used across SCM forms (Barcode
// Generator's entity picker today; any future SCM form that needs to pick a product/vendor/
// customer/warehouse/location/batch/serial/carrier should use this instead of free text).
// Options are always an already-loaded, client-side array (the SCM convention throughout this
// codebase — Realtime Database has no server-side search) — this component only renders,
// filters and debounces the *keystroke*, it never fetches. See `masterData/useScmMasterData.ts`
// for the shared, cached data source these options are built from.
import { useDeferredValue, useMemo, useState } from "react";
import { Check, ChevronsUpDown, Loader2, X } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/modules/scm/shared/components/ScmButton";
import { cn } from "@/lib/utils";

export interface ScmAutocompleteOption<T = unknown> {
  value: string;
  label: string;
  sublabel?: string;
  data: T;
}

export interface ScmAutocompleteProps<T = unknown> {
  options: ScmAutocompleteOption<T>[];
  value: string | null;
  onSelect: (option: ScmAutocompleteOption<T> | null) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  loading?: boolean;
  error?: string | null;
  emptyText?: string;
  disabled?: boolean;
  maxResults?: number;
  className?: string;
}

export default function ScmAutocomplete<T = unknown>({
  options,
  value,
  onSelect,
  placeholder = "Search...",
  searchPlaceholder = "Type to search...",
  loading = false,
  error = null,
  emptyText = "No results found.",
  disabled = false,
  maxResults = 50,
  className,
}: ScmAutocompleteProps<T>) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const selected = options.find((o) => o.value === value) || null;

  const filtered = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    const list = !q
      ? options
      : options.filter(
          (o) =>
            o.label.toLowerCase().includes(q) ||
            o.sublabel?.toLowerCase().includes(q),
        );
    return list.slice(0, maxResults);
  }, [options, deferredSearch, maxResults]);

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between font-normal", className)}
        >
          <span
            className={cn(
              "truncate text-left",
              !selected && "text-muted-foreground",
            )}
          >
            {selected ? selected.label : placeholder}
          </span>
          <span className="flex items-center gap-1 shrink-0 ml-1">
            {selected && !disabled && (
              <X
                className="h-3.5 w-3.5 opacity-50 hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(null);
                }}
              />
            )}
            <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
      >
        <Command shouldFilter={false}>
          <CommandInput
            value={search}
            onValueChange={setSearch}
            placeholder={searchPlaceholder}
          />
          <CommandList>
            {loading ? (
              <div className="py-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading...
              </div>
            ) : error ? (
              <div className="py-6 text-center text-sm text-red-600">
                {error}
              </div>
            ) : (
              <>
                <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
                  {emptyText}
                </CommandEmpty>
                <CommandGroup>
                  {filtered.map((opt) => (
                    <CommandItem
                      key={opt.value}
                      value={opt.value}
                      onSelect={() => {
                        onSelect(opt);
                        setOpen(false);
                        setSearch("");
                      }}
                      className="cursor-pointer"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-3.5 w-3.5 shrink-0",
                          value === opt.value
                            ? "opacity-100 text-brand-600"
                            : "opacity-0",
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate">{opt.label}</div>
                        {opt.sublabel && (
                          <div className="text-xs text-muted-foreground truncate">
                            {opt.sublabel}
                          </div>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
