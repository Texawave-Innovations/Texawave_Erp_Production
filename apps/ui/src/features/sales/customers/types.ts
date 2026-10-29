/** Mirrors apps/api/src/modules/sales/customers (customers.repository.ts
 * toView, dto/customer.dto.ts). Money and rates arrive as decimal strings. */

export type CustomerStatus = "ACTIVE" | "INACTIVE";
export type AddressType = "BILLING" | "SHIPPING";

export interface CustomerAddress {
  id: number;
  addressType: AddressType;
  label: string;
  street: string;
  area: string | null;
  city: string;
  stateCode: string;
  stateName: string | null;
  pincode: string;
  country: string;
  isDefault: boolean;
}

export interface Customer {
  id: number;
  customerCode: string;
  companyName: string;
  contactPerson: string;
  email: string;
  mobileCountryCode: string;
  mobileNumber: string;
  gstin: string | null;
  stateCode: string | null;
  stateName: string | null;
  cgstRate: string | null;
  sgstRate: string | null;
  igstRate: string | null;
  pan: string | null;
  cin: string | null;
  bankName: string | null;
  /** Masked ("XXXXXXXX7890"); the full number needs the reveal permission. */
  bankAccountNumberMasked: string | null;
  bankIfsc: string | null;
  bankBranch: string | null;
  paymentNotes: string | null;
  status: CustomerStatus;
  addresses: CustomerAddress[];
  defaultAddress: CustomerAddress | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerAddressBody {
  addressType: AddressType;
  label: string;
  street: string;
  area?: string;
  city: string;
  stateCode: string;
  pincode: string;
  country?: string;
  isDefault?: boolean;
}

export interface CustomerBody {
  companyName: string;
  contactPerson: string;
  email: string;
  mobileCountryCode: string;
  mobileNumber: string;
  gstin: string | null;
  stateCode: string | null;
  cgstRate: number | null;
  sgstRate: number | null;
  igstRate: number | null;
  pan: string | null;
  cin: string | null;
  bankName: string | null;
  /** Omitted on update = keep the stored number. */
  bankAccountNumber?: string | null;
  bankIfsc: string | null;
  bankBranch: string | null;
  paymentNotes: string | null;
  status: CustomerStatus;
  addresses: CustomerAddressBody[];
}
