import { TaxCalculatorView } from "@/features/finance/tax-calculator";

export const metadata = {
  title: "Income Tax Calculator | Finance | TexaWave ERP",
  description:
    "Statutory Income Tax simulation and comparison between New (Section 115BAC) and Old tax regimes for Indian taxpayers.",
};

export default function TaxCalculatorPage() {
  return <TaxCalculatorView />;
}
