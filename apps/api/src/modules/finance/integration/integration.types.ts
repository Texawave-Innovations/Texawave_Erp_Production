export interface SalesPurchasesPostingResult {
  success: boolean;
  alreadyPosted?: boolean;
  alreadyCancelled?: boolean;
  documentReference: string;
  journalEntryId: number | null;
  journalEntryNumber: string | null;
  gstEntryId: number | null;
  reversalJournalEntryId?: number | null;
  message: string;
}

export interface DocumentIntegrationStatus {
  documentReference: string;
  isJournalPosted: boolean;
  journalEntry: {
    id: number;
    entryNumber: string;
    entryDate: string;
    status: string;
    totalDebit: number;
    totalCredit: number;
  } | null;
  isGstRecorded: boolean;
  gstEntry: {
    id: number;
    gstin: string;
    period: string;
    entryType: string;
    taxableAmount: number;
    totalTaxAmount: number;
    status: string;
  } | null;
}
