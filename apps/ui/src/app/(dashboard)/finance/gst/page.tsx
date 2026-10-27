import { GstView } from "@/features/finance/gst";

export const metadata = {
  title: "GST Registry & Returns | Finance | TexaWave ERP",
  description:
    "Statutory GSTR-1, Form GSTR-3B netting, tax ledgers, HSN/SAC summary aggregation, and GSTR-2B ITC reconciliation.",
};

export default function GstPage() {
  return <GstView />;
}
