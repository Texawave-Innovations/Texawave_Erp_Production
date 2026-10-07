/** Mirrors apps/api/src/modules/hr/location-privilege/dto/location-privilege.dto.ts. */
export const LOCATION_MODES = ["OFFICE", "REMOTE"] as const;
export type LocationMode = (typeof LOCATION_MODES)[number];

/** Shape of GET /hr/location-privileges/employees/:employeeId. */
export interface EmployeeLocationPrivilege {
  employeeId: number;
  mode: LocationMode | null;
  source: "explicit" | "unset";
  updatedAt: string | null;
}

/** Shape of PUT /hr/location-privileges/employees/:employeeId response. */
export interface SetEmployeeLocationPrivilegeResult {
  employeeId: number;
  mode: LocationMode;
  changed: boolean;
}

/** Row of GET /hr/office-networks. */
export interface OfficeNetwork {
  id: number;
  ipAddress: string;
  label: string | null;
  isActive: boolean;
}
