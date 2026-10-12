import { ProductList } from "@/features/crm/products/components/ProductList";

// `app/` stays thin — routing only. All real logic/markup lives in
// `features/crm/products/` (Docs/CODING_STANDARDS.md §4).
export default function CrmProductsPage() {
  return <ProductList />;
}
