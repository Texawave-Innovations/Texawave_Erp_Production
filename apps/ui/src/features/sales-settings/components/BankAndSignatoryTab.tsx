"use client";

import { AuthorizedSignatoryForm } from "./AuthorizedSignatoryForm";
import { BankAccountsPanel } from "./BankAccountsPanel";

/** Bank & Signatory sub-tab — bank accounts list + authorized signatory form. */
export function BankAndSignatoryTab() {
  return (
    <div className="flex flex-col gap-4">
      <BankAccountsPanel />
      <AuthorizedSignatoryForm />
    </div>
  );
}
