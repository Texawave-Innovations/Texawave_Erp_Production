import { PaymentsReceivedView } from "@/features/finance/payments-received/components/PaymentsReceivedView";

export const metadata = {
  title: "Payments Received | Finance | TexaWave ERP",
  description:
    "Record and track customer payment entries, multi-invoice allocations, and official receipts.",
};

export default function PaymentsReceivedPage() {
  return <PaymentsReceivedView />;
}
