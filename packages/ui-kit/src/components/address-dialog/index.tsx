"use client";

import { useState } from "react";
import { Button } from "../button/index";
import { Checkbox } from "../checkbox/index";
import { Dialog } from "../dialog/index";
import { FormField } from "../form-field/index";
import { Input } from "../input/index";
import { Select } from "../select/index";
import { SpringGlideSegmentedControl } from "../segmented-control/index";
import { Textarea } from "../textarea/index";

export type AddressKind = "BILLING" | "SHIPPING";

export interface AddressDialogValue {
  addressType: AddressKind;
  label: string;
  street: string;
  area?: string | undefined;
  city: string;
  stateCode: string;
  pincode: string;
  country: string;
  isDefault: boolean;
}

export interface AddressDialogProps {
  open: boolean;
  onClose: () => void;
  mode: "add" | "edit";
  /** The starting values; read each time the dialog opens. */
  value: AddressDialogValue;
  states: readonly { code: string; name: string }[];
  /** Field name → message. Return `{}` when the address is valid. */
  validate?: (value: AddressDialogValue) => Record<string, string>;
  onSave: (value: AddressDialogValue) => void;
}

const KIND_LABEL: Record<AddressKind, string> = {
  BILLING: "Billing",
  SHIPPING: "Shipping",
};

function Body({
  mode,
  value,
  states,
  validate,
  onSave,
  onClose,
}: Omit<AddressDialogProps, "open">) {
  const [draft, setDraft] = useState(value);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const kind = KIND_LABEL[draft.addressType].toLowerCase();

  function patch(next: Partial<AddressDialogValue>) {
    setDraft((d) => ({ ...d, ...next }));
    setErrors((e) => {
      const copy = { ...e };
      for (const k of Object.keys(next)) delete copy[k];
      return copy;
    });
  }

  function save() {
    const found = validate?.(draft) ?? {};
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }
    onSave(draft);
  }

  const text = (
    key: "label" | "area" | "city" | "pincode" | "country",
    label: string,
    opts: {
      required?: boolean;
      inputMode?: "numeric";
      maxLength?: number;
    } = {},
  ) => (
    <FormField
      label={label}
      required={opts.required ?? false}
      error={errors[key]}
    >
      {(f) => (
        <Input
          {...f}
          inputMode={opts.inputMode}
          maxLength={opts.maxLength}
          value={draft[key] ?? ""}
          onChange={(e) => patch({ [key]: e.target.value })}
        />
      )}
    </FormField>
  );

  return (
    // Not a <form>: the dialog sits inside the page's own form. Enter in a
    // text field saves the address instead of submitting that form.
    <div
      className="flex flex-col gap-4"
      onKeyDown={(e) => {
        if (
          e.key === "Enter" &&
          (e.target as HTMLElement).tagName === "INPUT"
        ) {
          e.preventDefault();
          save();
        }
      }}
    >
      <SpringGlideSegmentedControl<AddressKind>
        ariaLabel="Address type"
        size="md"
        className="w-full"
        value={draft.addressType}
        onChange={(addressType) => patch({ addressType, isDefault: false })}
        options={[
          { id: "BILLING", label: "Billing" },
          { id: "SHIPPING", label: "Shipping" },
        ]}
      />
      {text("label", "Label / name", { required: true })}
      <FormField label="Street / building no." required error={errors.street}>
        {(f) => (
          <Textarea
            {...f}
            rows={2}
            value={draft.street}
            onChange={(e) => patch({ street: e.target.value })}
          />
        )}
      </FormField>
      {text("area", "Area / locality")}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {text("city", "City", { required: true })}
        <FormField label="State" required error={errors.stateCode}>
          {(f) => (
            <Select
              {...f}
              value={draft.stateCode}
              onChange={(e) => patch({ stateCode: e.target.value })}
            >
              <option value="">Choose a state</option>
              {states.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        {text("pincode", "Pincode", {
          required: true,
          inputMode: "numeric",
          maxLength: 6,
        })}
        {text("country", "Country", { required: true })}
      </div>
      <label className="flex items-center gap-2 text-theme-sm text-gray-700 dark:text-gray-300">
        <Checkbox
          checked={draft.isDefault}
          onChange={(e) => patch({ isDefault: e.target.checked })}
        />
        Set as default {kind} address
      </label>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" onClick={save}>
          {mode === "add" ? "Add address" : "Save address"}
        </Button>
      </div>
    </div>
  );
}

/**
 * Add/edit one billing or shipping address. Presentational: it validates
 * through the `validate` prop and hands the result to `onSave`; the caller
 * owns the list and the one-default-per-type rule.
 */
export function AddressDialog(props: AddressDialogProps) {
  const { open, onClose, mode, value } = props;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="2xl"
      title={`${mode === "add" ? "Add" : "Edit"} ${KIND_LABEL[value.addressType]} address`}
    >
      {/* Mounted only while open, so the draft restarts from `value`. */}
      {open ? <Body {...props} /> : null}
    </Dialog>
  );
}
