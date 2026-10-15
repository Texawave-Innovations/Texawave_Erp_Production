"use client";

import type { Account } from "@texawave-erp/api-types";
import {
  type ChangeAccountStatusTagFormValues,
  type CreateAccountFormValues,
} from "@texawave-erp/core";
import { Button, Dialog, StatusBadge, useToast } from "@texawave-erp/ui-kit";
import { useState } from "react";
import { useChangeAccountStatusTag, useUpdateAccount } from "../../hooks";
import { AccountForm } from "../AccountForm";
import { StatusTagDialog } from "../StatusTagDialog";

const STATUS_COLOR: Record<
  string,
  "brand" | "gray" | "success" | "warning" | "error"
> = {
  Interested: "success",
  "Not Interested": "error",
  "Keep in Touch": "brand",
  "Call Back": "warning",
  "Send Info": "gray",
};

function Field({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div>
      <dt className="text-theme-xs text-gray-500 dark:text-gray-400">
        {label}
      </dt>
      <dd className="text-theme-sm text-gray-900 dark:text-white/90">
        {value || "—"}
      </dd>
    </div>
  );
}

/** Overview tab: read all account fields, status-tag badge/change action,
 * and an edit entry point (reuses `AccountForm` in a dialog). */
export function OverviewTab({ account }: { account: Account }) {
  const [editOpen, setEditOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const updateMutation = useUpdateAccount();
  const changeStatusTag = useChangeAccountStatusTag();
  const { toast } = useToast();

  async function handleUpdate(values: CreateAccountFormValues) {
    await updateMutation.mutateAsync({ id: account.id, input: values });
    setEditOpen(false);
    toast({ title: "Account updated", variant: "success" });
  }

  async function handleStatusChange(values: ChangeAccountStatusTagFormValues) {
    await changeStatusTag.mutateAsync({ id: account.id, input: values });
    toast({ title: "Status tag updated", variant: "success" });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {account.statusTag ? (
            <StatusBadge
              label={account.statusTag}
              colorToken={STATUS_COLOR[account.statusTag] ?? "gray"}
            />
          ) : null}
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setStatusOpen(true)}
          >
            Change status
          </Button>
          <Button size="sm" onClick={() => setEditOpen(true)}>
            Edit
          </Button>
        </div>
      </div>

      <section>
        <h3 className="mb-3 text-theme-sm font-semibold text-gray-900 dark:text-white/90">
          Company Info
        </h3>
        <dl className="grid grid-cols-3 gap-4">
          <Field label="Account type" value={account.accountType} />
          <Field label="Owner" value={account.ownerName} />
          <Field label="Industry" value={account.industry} />
          <Field label="Website" value={account.website} />
          <Field
            label="Employees"
            value={account.numberOfEmployees?.toString()}
          />
          <Field label="Annual revenue" value={account.annualRevenue} />
        </dl>
        {account.description ? (
          <p className="mt-3 text-theme-sm text-gray-700 dark:text-gray-300">
            {account.description}
          </p>
        ) : null}
      </section>

      <section>
        <h3 className="mb-3 text-theme-sm font-semibold text-gray-900 dark:text-white/90">
          Contact Details
        </h3>
        <dl className="grid grid-cols-3 gap-4">
          <Field label="Phone" value={account.phone} />
          <Field label="Email" value={account.email} />
          <Field label="LinkedIn" value={account.linkedin} />
          <Field
            label="Registration number"
            value={account.registrationNumber}
          />
        </dl>
      </section>

      <section>
        <h3 className="mb-3 text-theme-sm font-semibold text-gray-900 dark:text-white/90">
          Billing Address
        </h3>
        <dl className="grid grid-cols-3 gap-4">
          <Field label="Street" value={account.billingStreet} />
          <Field label="City" value={account.billingCity} />
          <Field label="State" value={account.billingState} />
          <Field label="Postal code" value={account.billingPostalCode} />
          <Field label="Country" value={account.billingCountry} />
        </dl>
      </section>

      <section>
        <h3 className="mb-3 text-theme-sm font-semibold text-gray-900 dark:text-white/90">
          Shipping Address
        </h3>
        <dl className="grid grid-cols-3 gap-4">
          <Field label="Street" value={account.shippingStreet} />
          <Field label="City" value={account.shippingCity} />
          <Field label="State" value={account.shippingState} />
          <Field label="Postal code" value={account.shippingPostalCode} />
          <Field label="Country" value={account.shippingCountry} />
        </dl>
      </section>

      <section>
        <h3 className="mb-3 text-theme-sm font-semibold text-gray-900 dark:text-white/90">
          Business Profile
        </h3>
        <dl className="grid grid-cols-3 gap-4">
          <Field label="Customer category" value={account.customerCategory} />
          <Field label="Customer class" value={account.customerClass} />
          <Field label="Business type" value={account.businessType} />
          <Field label="Reseller type" value={account.resellerType} />
        </dl>
        {account.tags.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {account.tags.map((tag) => (
              <StatusBadge key={tag} label={tag} colorToken="gray" />
            ))}
          </div>
        ) : null}
      </section>

      <Dialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit account"
      >
        <AccountForm
          initialValues={{
            name: account.name,
            accountType: account.accountType ?? undefined,
            ownerName: account.ownerName ?? undefined,
            industry: account.industry ?? undefined,
            website: account.website ?? undefined,
            phone: account.phone ?? undefined,
            email: account.email ?? undefined,
            linkedin: account.linkedin ?? undefined,
            registrationNumber: account.registrationNumber ?? undefined,
            numberOfEmployees: account.numberOfEmployees ?? undefined,
            annualRevenue: account.annualRevenue
              ? Number(account.annualRevenue)
              : undefined,
            description: account.description ?? undefined,
            billingStreet: account.billingStreet ?? undefined,
            billingCity: account.billingCity ?? undefined,
            billingState: account.billingState ?? undefined,
            billingPostalCode: account.billingPostalCode ?? undefined,
            billingCountry: account.billingCountry ?? undefined,
            shippingStreet: account.shippingStreet ?? undefined,
            shippingCity: account.shippingCity ?? undefined,
            shippingState: account.shippingState ?? undefined,
            shippingPostalCode: account.shippingPostalCode ?? undefined,
            shippingCountry: account.shippingCountry ?? undefined,
            customerCategory: account.customerCategory ?? undefined,
            customerClass: account.customerClass ?? undefined,
            businessType: account.businessType ?? undefined,
            resellerType: account.resellerType ?? undefined,
            tags: account.tags,
          }}
          onSubmit={handleUpdate}
          onCancel={() => setEditOpen(false)}
          submitLabel="Save changes"
        />
      </Dialog>

      <StatusTagDialog
        open={statusOpen}
        onClose={() => setStatusOpen(false)}
        currentStatusTag={account.statusTag}
        onSubmit={handleStatusChange}
      />
    </div>
  );
}
