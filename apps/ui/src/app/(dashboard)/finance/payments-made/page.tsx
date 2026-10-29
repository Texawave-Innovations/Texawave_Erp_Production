import { PaymentsMadeView } from "@/features/finance/payments-made/components/PaymentsMadeView";

export const metadata = {
  title: "Payments Made | Finance | TexaWave ERP",
  description:
    "Manage and track vendor disbursements, banking outflows, and General Ledger vouchers.",
};

export default function PaymentsMadePage() {
  return <PaymentsMadeView />;
}
