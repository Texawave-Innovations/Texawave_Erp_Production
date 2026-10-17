// CRM Core Domain — searchable product picker for a single Quote line item. Reuses the CRM
// Products catalog (`crm/products`) only; never writes a new product record. Distinct from
// `AddDealProductsDialog` (multi-select, bulk-add-to-deal) — this is a single-select combobox
// meant to sit inline in the Quote Items table cell.
import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CrmProduct } from "./types";

export function QuoteProductPicker({
  products,
  value,
  onSelect,
  currencySymbol,
}: {
  products: CrmProduct[];
  value?: string;
  onSelect: (product: CrmProduct) => void;
  currencySymbol: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = products.find((p) => p.id === value);
  const active = products.filter((p) => p.active);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-8 w-full justify-between rounded-lg text-xs font-normal px-2.5"
        >
          <span className={cn("truncate", !selected && "text-slate-400")}>
            {selected ? selected.name : "Search product…"}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-40 ml-1" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 rounded-xl" align="start">
        <Command
          filter={(value, search) =>
            value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
          }
        >
          <CommandInput
            placeholder="Search by name or code…"
            className="text-xs h-9"
          />
          <CommandList>
            <CommandEmpty className="py-6 text-center text-sm text-slate-400">
              No active products found.
            </CommandEmpty>
            <CommandGroup>
              {active.map((p) => (
                <CommandItem
                  key={p.id}
                  value={`${p.name} ${p.code}`}
                  onSelect={() => {
                    onSelect(p);
                    setOpen(false);
                  }}
                  className="text-xs cursor-pointer rounded-lg"
                >
                  <Check
                    className={cn(
                      "mr-2 h-3.5 w-3.5 shrink-0",
                      value === p.id
                        ? "opacity-100 text-brand-600"
                        : "opacity-0",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-800 truncate">
                      {p.name}
                    </p>
                    <p className="text-sm text-slate-400 truncate">
                      {p.code} · {currencySymbol}
                      {p.unitPrice.toLocaleString("en-IN")}
                      {p.taxPercent ? ` · ${p.taxPercent}% tax` : ""}
                    </p>
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
