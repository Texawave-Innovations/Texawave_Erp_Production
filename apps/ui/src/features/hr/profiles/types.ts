/** Postal address as stored on the profile (`presentAddress` / `permanentAddress`). */
export interface ProfileAddress {
  address: string;
  area?: string | null;
  district?: string | null;
  city: string;
  state: string;
  pincode: string;
  country?: string | null;
}

/** Summary of the employee record. Read-only here: owned by the Employees feature. */
export interface ProfileEmployeeSummary {
  id: number;
  employeeCode: string;
  fullName: string;
  workEmail: string | null;
  phone: string | null;
  dateOfJoining: string;
  status: string;
}

/** Shape of GET /hr/employees/:id/profile. `updatedAt` is null until a profile row exists. */
export interface EmployeeProfileView {
  employee: ProfileEmployeeSummary;
  profile: {
    title: string | null;
    dateOfBirth: string | null;
    gender: string | null;
    maritalStatus: string | null;
    bloodGroup: string | null;
    languages: string[];
    fatherName: string | null;
    motherName: string | null;
    spouseName: string | null;
    emergencyContact: {
      name: string | null;
      phone: string | null;
      relation: string | null;
    };
    presentAddress: ProfileAddress | null;
    permanentAddress: ProfileAddress | null;
    isFresher: boolean;
    experienceYears: number | null;
    previousCompany: string | null;
    previousRole: string | null;
    updatedAt: string | null;
  };
}

/** Shape of GET /hr/employees/:id/sensitive. Every read is audited server-side. */
export interface EmployeeSensitiveView {
  employeeId: number;
  panNumber: string | null;
  aadhaarNumber: string | null;
  esiNumber: string | null;
  pfNumber: string | null;
  bankName: string | null;
  bankBranch: string | null;
  bankAccountNo: string | null;
  bankIfsc: string | null;
  updatedAt: string | null;
}
