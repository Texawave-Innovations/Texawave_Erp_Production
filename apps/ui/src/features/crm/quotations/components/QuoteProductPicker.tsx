"use client";

// Port of legacy domain/QuoteProductPicker.tsx — single-select product combobox
// that sits inline in the Quote Items table cell. Searches the server as you
// type (name / code / category / vendor), so it is not limited to the first
// page of products.
import type { Product } from "@texawave-erp/api-types";
import { useState } from "react";
import { useProducts } from "../../products/hooks";
import { AsyncPicker } from "@/features/crm/legacy-ui/AsyncPicker";

export function QuoteProductPicker({
  value,
  selectedLabel,
  onSelect,
  currencySymbol,
}: {
  value?: number | undefined;
  selectedLabel?: string | undefined;
  onSelect: (product: Product) => void;
  currencySymbol: string;
}) {
  const [search, setSearch] = useState("");
  const query = useProducts({
    limit: 20,
    order: "asc",
    ...(search ? { q: search } : {}),
  });
  const products = (query.data?.data ?? []).filter((p) => p.isActive);

  return (
    <AsyncPicker
      selectedId={value}
      selectedLabel={selectedLabel}
      placeholder="Search product…"
      searchPlaceholder="Search by name or code…"
      className="h-8 rounded-lg text-xs px-2.5"
      loading={query.isFetching}
      onSearchChange={setSearch}
      options={products.map((p) => ({
        id: p.id,
        label: p.name,
        sublabel: `${p.code} · ${currencySymbol}${Number(p.unitPrice).toLocaleString("en-IN")}${
          p.taxPercent && Number(p.taxPercent) ? ` · ${p.taxPercent}% tax` : ""
        }`,
      }))}
      onSelect={(o) => {
        const p = products.find((x) => x.id === o.id);
        if (p) onSelect(p);
      }}
    />
  );
}
