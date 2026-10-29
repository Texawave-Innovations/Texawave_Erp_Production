import { JournalVouchersView } from "@/features/finance/journal/components/JournalVouchersView";

export const metadata = {
  title: "Journal Entries | TexaWave ERP",
  description:
    "General ledger journal vouchers, double-entry audit trails, and posting workflows",
};

export default function JournalEntriesPage() {
  return <JournalVouchersView />;
}
