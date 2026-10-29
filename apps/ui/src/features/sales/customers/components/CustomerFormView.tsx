"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";
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

function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="text-theme-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
    >
      ← {label}
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
      <BackLink href="/sales/customers" label="Back to customers" />
      <PageHeader
        variant="banner"
        title="New customer"
        description="Company, tax, bank and address details."
        icon={Building2}
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
      <BackLink href={`/sales/customers/${id}`} label="Back to customer" />
      <PageHeader
        variant="banner"
        title={`Edit ${customer.companyName}`}
        description={customer.customerCode}
        icon={Building2}
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
