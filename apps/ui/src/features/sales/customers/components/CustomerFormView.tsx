"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  ErrorState,
  PageHeader,
  Skeleton,
  useToast,
} from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
import { SALES_PERMISSIONS } from "../../permissions";
import { useCreateCustomer, useCustomer, useUpdateCustomer } from "../hooks";
import {
  customerSchema,
  customerToForm,
  EMPTY_CUSTOMER_FORM,
  formToBody,
  type CustomerFormValues,
} from "../schema";
import { CustomerForm } from "./CustomerForm";

function NoWriteAccess() {
  return (
    <Alert variant="warning" title="You don't have access to change customers">
      Ask an administrator for the <code>sales.customer.write</code> permission.
    </Alert>
  );
}

/** The banner's leading tile: a back arrow instead of a decorative icon. */
export function BackArrow({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="flex h-full w-full items-center justify-center rounded-2xl transition-colors hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:hover:bg-white/10"
    >
      <ArrowLeft className="h-6 w-6" aria-hidden="true" />
    </Link>
  );
}

export function CustomerCreateView() {
  const router = useRouter();
  const { toast } = useToast();
  const canWrite = usePermission(SALES_PERMISSIONS.customerWrite);
  const create = useCreateCustomer();

  if (!canWrite) return <NoWriteAccess />;

  async function handleSubmit(values: CustomerFormValues) {
    const body = formToBody(customerSchema.parse(values), {
      keepBankAccount: false,
    });
    const created = await create.mutateAsync(body);
    toast({
      title: `${created.companyName} added as ${created.customerCode}`,
      variant: "success",
    });
    router.push(`/sales/customers/${created.id}`);
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        variant="banner"
        title="New customer"
        description="Company, tax, bank and address details."
        icon={<BackArrow href="/sales/customers" label="Back to customers" />}
      />
      <CustomerForm
        mode="create"
        initialValues={EMPTY_CUSTOMER_FORM}
        onSubmit={handleSubmit}
        onCancel={() => router.push("/sales/customers")}
      />
    </div>
  );
}

export function CustomerEditView({ id }: { id: number }) {
  const router = useRouter();
  const { toast } = useToast();
  const canWrite = usePermission(SALES_PERMISSIONS.customerWrite);
  const query = useCustomer(id);
  const update = useUpdateCustomer();

  if (!canWrite) return <NoWriteAccess />;

  if (query.isPending) {
    return <Skeleton className="h-96 w-full" />;
  }
  if (query.isError) {
    return query.error instanceof ApiError && query.error.isNotFound ? (
      <Alert variant="warning" title="Customer not found">
        It may have been deleted. <Link href="/sales/customers">Back</Link>
      </Alert>
    ) : (
      <ErrorState onRetry={() => void query.refetch()} />
    );
  }
  const customer = query.data;

  async function handleSubmit(values: CustomerFormValues) {
    const body = formToBody(customerSchema.parse(values), {
      keepBankAccount: true,
    });
    await update.mutateAsync({ id, body });
    toast({ title: `${customer.companyName} saved`, variant: "success" });
    router.push(`/sales/customers/${id}`);
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        variant="banner"
        title={`Edit ${customer.companyName}`}
        description={customer.customerCode}
        icon={
          <BackArrow href={`/sales/customers/${id}`} label="Back to customer" />
        }
      />
      <CustomerForm
        // Re-mount with fresh values when the stored customer changes.
        key={customer.updatedAt}
        mode="edit"
        customerCode={customer.customerCode}
        maskedAccount={customer.bankAccountNumberMasked}
        initialValues={customerToForm(customer)}
        onSubmit={handleSubmit}
        onCancel={() => router.push(`/sales/customers/${id}`)}
      />
    </div>
  );
}
