"use client";

import {
  useCompanySeals,
  useCreateAuthorizedSignature,
  useCreateCompanySeal,
  useDeleteAuthorizedSignature,
  useDeleteCompanySeal,
  useAuthorizedSignatures,
} from "../hooks";
import { SealSignatureMasterlist } from "./SealSignatureMasterlist";

/** "Seals & Signatures" top-level tab — two masterlist cards. */
export function SealsSignaturesTab() {
  const createSeal = useCreateCompanySeal();
  const deleteSeal = useDeleteCompanySeal();
  const createSignature = useCreateAuthorizedSignature();
  const deleteSignature = useDeleteAuthorizedSignature();

  return (
    <div className="flex flex-col gap-4">
      <SealSignatureMasterlist
        title="Company Seal Masterlist"
        emptyTitle="No seals yet"
        emptyDescription="Upload a company seal to use it on printed sales documents."
        showSignatoryFields={false}
        useList={useCompanySeals}
        onCreate={(values) => createSeal.mutateAsync(values)}
        onDelete={(id) => deleteSeal.mutateAsync(id)}
        deletePending={deleteSeal.isPending}
      />
      <SealSignatureMasterlist
        title="Authorized Signature Masterlist"
        emptyTitle="No signatures yet"
        emptyDescription="Upload an authorized signature to use it on printed sales documents."
        showSignatoryFields={true}
        useList={useAuthorizedSignatures}
        onCreate={(values) => createSignature.mutateAsync(values)}
        onDelete={(id) => deleteSignature.mutateAsync(id)}
        deletePending={deleteSignature.isPending}
      />
    </div>
  );
}
